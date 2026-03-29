"""
Hybrid retriever that fuses dense vector search and sparse BM25 search.
"""

import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from src.config import rag_config
from src.utils import logger

from .embeddings import HybridEmbeddings, get_embeddings
from .vector_store import MilvusVectorStore, get_vector_store


@dataclass
class RetrievalResult:
    """Unified retrieval result."""

    chunk_id: str
    content: str
    full_text: str
    doc_id: str
    doc_title: str
    source: str
    category: str
    score: float
    match_type: str


class HybridRetriever:
    """Combine dense retrieval and BM25 retrieval with RRF fusion."""

    def __init__(
        self,
        vector_store: MilvusVectorStore = None,
        embeddings: HybridEmbeddings = None,
        dense_weight: float = None,
        sparse_weight: float = None,
        top_k: int = None,
    ):
        self.vector_store = vector_store or get_vector_store()
        self.embeddings = embeddings or get_embeddings()

        retrieval_config = rag_config.retrieval
        self.dense_weight = dense_weight or retrieval_config["dense_weight"]
        self.sparse_weight = sparse_weight or retrieval_config["sparse_weight"]
        self.top_k = top_k or retrieval_config["top_k"]

        self._chunk_id_to_index: Dict[str, int] = {}
        self._index_to_chunk: Dict[int, Dict[str, Any]] = {}
        self._sparse_corpus_built = False

    def retrieve(
        self,
        query: str,
        top_k: int = None,
        category_filter: Optional[str] = None,
        use_hybrid: bool = True,
    ) -> List[RetrievalResult]:
        """Run dense retrieval and optionally fuse with sparse retrieval."""
        top_k = top_k or self.top_k

        dense_results = self._dense_search(query, top_k * 2, category_filter)
        logger.debug("Dense retrieval returned %s results", len(dense_results))

        if not use_hybrid or not self.embeddings.use_sparse:
            return self._convert_to_results(dense_results, "dense")[:top_k]

        # 2. Sparse检索 (BM25)
        sparse_results = self._sparse_search(query, top_k * 2, category_filter)
        logger.debug(f"Sparse检索返回 {len(sparse_results)} 条结果")

        fused_results = self._rrf_fusion(dense_results, sparse_results, top_k)
        logger.info("Hybrid retrieval returned %s results", len(fused_results))
        return fused_results

    def retrieve_with_debug(
        self,
        query: str,
        top_k: int = None,
        category_filter: Optional[str] = None,
        use_hybrid: bool = True
    ) -> Dict[str, Any]:
        """
        返回混合检索的分层调试信息。

        用于阶段2的检索对比视图，展示 Dense / Sparse / RRF 三层结果。
        """
        bundle = self.retrieve_debug_bundle(
            query=query,
            top_k=top_k,
            category_filter=category_filter,
            use_hybrid=use_hybrid,
        )
        bundle.pop("dense_raw_results", None)
        bundle.pop("sparse_raw_results", None)
        bundle.pop("hybrid_raw_results", None)
        return bundle

    def retrieve_debug_bundle(
        self,
        query: str,
        top_k: int = None,
        category_filter: Optional[str] = None,
        use_hybrid: bool = True
    ) -> Dict[str, Any]:
        """
        返回混合检索的调试数据，并保留原始结果供后续阶段使用。
        """
        requested_top_k = top_k or self.top_k
        expanded_top_k = requested_top_k * 2
        started_at = time.perf_counter()

        dense_started = time.perf_counter()
        dense_results = self._dense_search(query, expanded_top_k, category_filter)
        dense_duration_ms = round((time.perf_counter() - dense_started) * 1000, 2)

        sparse_results: List[Tuple[str, float]] = []
        sparse_duration_ms = 0.0
        if use_hybrid and self.embeddings.use_sparse:
            sparse_started = time.perf_counter()
            sparse_results = self._sparse_search(query, expanded_top_k, category_filter)
            sparse_duration_ms = round((time.perf_counter() - sparse_started) * 1000, 2)

        fusion_started = time.perf_counter()
        if use_hybrid and self.embeddings.use_sparse:
            hybrid_results = self._rrf_fusion(dense_results, sparse_results, expanded_top_k)
        else:
            hybrid_results = self._convert_to_results(dense_results, "dense")[:expanded_top_k]
        fusion_duration_ms = round((time.perf_counter() - fusion_started) * 1000, 2)

        dense_converted = self._convert_to_results(dense_results, "dense")[:requested_top_k]
        sparse_converted = self._convert_sparse_results(sparse_results)[:requested_top_k]
        hybrid_display_results = hybrid_results[:requested_top_k]

        return {
            "query": query,
            "top_k": requested_top_k,
            "category_filter": category_filter,
            "dense_results": self._serialize_results(dense_converted),
            "sparse_results": self._serialize_results(sparse_converted),
            "hybrid_results": self._serialize_results(hybrid_display_results),
            "debug": {
                "use_hybrid": use_hybrid,
                "sparse_enabled": self.embeddings.use_sparse,
                "sparse_index_built": self._sparse_corpus_built,
                "dense_weight": self.dense_weight,
                "sparse_weight": self.sparse_weight,
                "dense_candidates": len(dense_results),
                "sparse_candidates": len(sparse_results),
                "hybrid_candidates": len(hybrid_results),
                "dense_duration_ms": dense_duration_ms,
                "sparse_duration_ms": sparse_duration_ms,
                "fusion_duration_ms": fusion_duration_ms,
                "total_duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            },
            "dense_raw_results": dense_converted,
            "sparse_raw_results": sparse_converted,
            "hybrid_raw_results": hybrid_results,
        }

    def _dense_search(
        self,
        query: str,
        top_k: int,
        category_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        try:
            query_embedding = self.embeddings.embed_query(query)
            return self.vector_store.search(
                query_embedding=query_embedding,
                top_k=top_k,
                category_filter=category_filter,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Dense retrieval failed: %s", exc)
            return []

    def _sparse_search(
        self,
        query: str,
        top_k: int,
        category_filter: Optional[str] = None
    ) -> List[Tuple[str, float]]:
        """Sparse BM25检索"""
        try:
            if not self._sparse_corpus_built:
                logger.warning("BM25 index is not ready")
                return []

            bm25_results = self.embeddings.sparse_search(query, top_k)

            # 转换为 (chunk_id, score)
            results = []
            for idx, score in bm25_results:
                if idx in self._index_to_chunk:
                    chunk = self._index_to_chunk[idx]
                    if category_filter and str(chunk.get("category")) != category_filter:
                        continue
                    chunk_id = chunk.get("chunk_id")
                    if chunk_id:
                        results.append((chunk_id, score))

            return results
        except Exception as exc:  # noqa: BLE001
            logger.error("Sparse retrieval failed: %s", exc)
            return []

    def _rrf_fusion(
        self,
        dense_results: List[Dict[str, Any]],
        sparse_results: List[Tuple[str, float]],
        top_k: int,
        k: int = 60,
    ) -> List[RetrievalResult]:
        """Fuse dense and sparse rankings with reciprocal rank fusion."""
        rrf_scores: Dict[str, float] = {}
        chunk_data: Dict[str, Dict[str, Any]] = {}

        for rank, result in enumerate(dense_results, 1):
            chunk_id = result["chunk_id"]
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + self.dense_weight / (k + rank)
            chunk_data[chunk_id] = result

        for rank, (chunk_id, _) in enumerate(sparse_results, 1):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + self.sparse_weight / (k + rank)
            if chunk_id not in chunk_data and chunk_id in self._chunk_id_to_index:
                chunk = self._index_to_chunk.get(self._chunk_id_to_index[chunk_id])
                if chunk:
                    chunk_data[chunk_id] = chunk

        results: List[RetrievalResult] = []
        for chunk_id, score in sorted(rrf_scores.items(), key=lambda item: item[1], reverse=True)[:top_k]:
            data = chunk_data.get(chunk_id)
            if not data:
                continue
            results.append(
                RetrievalResult(
                    chunk_id=chunk_id,
                    content=data.get("content", ""),
                    full_text=data.get("full_text", ""),
                    doc_id=data.get("doc_id", ""),
                    doc_title=data.get("doc_title", ""),
                    source=data.get("source", ""),
                    category=data.get("category", ""),
                    score=score,
                    match_type="hybrid",
                )
            )

        return results

    def _convert_to_results(
        self,
        dense_results: List[Dict[str, Any]],
        match_type: str,
    ) -> List[RetrievalResult]:
        return [
            RetrievalResult(
                chunk_id=result["chunk_id"],
                content=result.get("content", ""),
                full_text=result.get("full_text", ""),
                doc_id=result.get("doc_id", ""),
                doc_title=result.get("doc_title", ""),
                source=result.get("source", ""),
                category=result.get("category", ""),
                score=result.get("score", 0.0),
                match_type=match_type,
            )
            for result in dense_results
        ]

    def _convert_sparse_results(self, sparse_results: List[Tuple[str, float]]) -> List[RetrievalResult]:
        """转换Sparse结果为RetrievalResult。"""
        results: List[RetrievalResult] = []
        for chunk_id, score in sparse_results:
            chunk = self._chunk_data_for_sparse_result(chunk_id)
            if not chunk:
                continue
            results.append(RetrievalResult(
                chunk_id=chunk_id,
                content=chunk.get("content", ""),
                full_text=chunk.get("full_text", ""),
                doc_id=chunk.get("doc_id", ""),
                doc_title=chunk.get("doc_title", ""),
                source=chunk.get("source", ""),
                category=chunk.get("category", ""),
                score=score,
                match_type="sparse",
            ))
        return results

    def _chunk_data_for_sparse_result(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        idx = self._chunk_id_to_index.get(chunk_id)
        if idx is None:
            return None
        return self._index_to_chunk.get(idx)

    @staticmethod
    def _serialize_results(results: List[RetrievalResult]) -> List[Dict[str, Any]]:
        return [
            {
                "chunk_id": item.chunk_id,
                "doc_id": item.doc_id,
                "doc_title": item.doc_title,
                "source": item.source,
                "category": item.category,
                "content_preview": (item.content[:240] + "...") if len(item.content) > 240 else item.content,
                "full_text_preview": (item.full_text[:240] + "...") if len(item.full_text) > 240 else item.full_text,
                "score": item.score,
                "match_type": item.match_type,
            }
            for item in results
        ]

    def build_sparse_index(self, chunks: List[Dict[str, Any]]):
        """Rebuild the in-memory BM25 corpus from chunk payloads."""
        self._chunk_id_to_index = {}
        self._index_to_chunk = {}
        self._sparse_corpus_built = False

        if not chunks:
            self.clear_sparse_index()
            return

        # 构建映射
        self._chunk_id_to_index = {}
        self._index_to_chunk = {}
        corpus = []
        for i, chunk in enumerate(chunks):
            chunk_id = chunk.get("chunk_id")
            if not chunk_id:
                continue

            self._chunk_id_to_index[chunk_id] = index
            self._index_to_chunk[index] = chunk
            corpus.append(chunk.get("full_text") or chunk.get("content", ""))

        if not corpus:
            logger.info("Sparse index cleared because the chunk corpus is empty")
            return

        self.embeddings.build_sparse_index(corpus)
        self._sparse_corpus_built = self.embeddings.use_sparse
        logger.info("BM25 index rebuilt, chunk_count=%s", len(corpus))

    def has_sparse_index(self) -> bool:
        """Whether the in-memory sparse index is ready."""
        return self._sparse_corpus_built

    def sparse_corpus_size(self) -> int:
        """Return the number of chunks tracked by the sparse index."""
        return len(self._index_to_chunk)

    def clear_sparse_index(self):
        """清空BM25检索索引及映射。"""

        self._chunk_id_to_index = {}
        self._index_to_chunk = {}
        self._sparse_corpus_built = False
        if hasattr(self.embeddings, "clear_sparse_index"):
            self.embeddings.clear_sparse_index()


_retriever: Optional[HybridRetriever] = None


def get_retriever() -> HybridRetriever:
    """Return the singleton retriever instance."""
    global _retriever
    if _retriever is None:
        _retriever = HybridRetriever()
    return _retriever

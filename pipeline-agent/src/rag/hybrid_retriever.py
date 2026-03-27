"""
Hybrid retriever that fuses dense vector search and sparse BM25 search.
"""

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

        sparse_results = self._sparse_search(query, top_k * 2, category_filter)
        logger.debug("Sparse retrieval returned %s results", len(sparse_results))

        fused_results = self._rrf_fusion(dense_results, sparse_results, top_k)
        logger.info("Hybrid retrieval returned %s results", len(fused_results))
        return fused_results

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
        category_filter: Optional[str] = None,
    ) -> List[Tuple[str, float]]:
        try:
            if not self._sparse_corpus_built:
                logger.warning("BM25 index is not ready")
                return []

            bm25_results = self.embeddings.sparse_search(query, top_k)

            results: List[Tuple[str, float]] = []
            for index, score in bm25_results:
                chunk = self._index_to_chunk.get(index)
                if not chunk:
                    continue
                if category_filter and chunk.get("category") != category_filter:
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

    def build_sparse_index(self, chunks: List[Dict[str, Any]]):
        """Rebuild the in-memory BM25 corpus from chunk payloads."""
        self._chunk_id_to_index = {}
        self._index_to_chunk = {}
        self._sparse_corpus_built = False

        if not chunks:
            logger.info("Sparse index cleared because there are no chunks")
            return

        corpus: List[str] = []
        for index, chunk in enumerate(chunks):
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


_retriever: Optional[HybridRetriever] = None


def get_retriever() -> HybridRetriever:
    """Return the singleton retriever instance."""
    global _retriever
    if _retriever is None:
        _retriever = HybridRetriever()
    return _retriever

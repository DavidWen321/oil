"""
混合检索器
结合Dense（向量）和Sparse（BM25）检索
使用RRF（Reciprocal Rank Fusion）融合结果
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from src.config import settings, rag_config
from src.utils import logger
from .embeddings import HybridEmbeddings, get_embeddings
from .vector_store import MilvusVectorStore, get_vector_store


@dataclass
class RetrievalResult:
    """检索结果"""
    chunk_id: str
    content: str
    full_text: str
    doc_id: str
    doc_title: str
    source: str
    category: str
    score: float
    match_type: str  # "dense", "sparse", "hybrid"


class HybridRetriever:
    """
    混合检索器

    实现：
    1. Dense检索 - Milvus向量检索
    2. Sparse检索 - BM25关键词检索
    3. RRF融合 - 倒数排名融合
    """

    def __init__(
        self,
        vector_store: MilvusVectorStore = None,
        embeddings: HybridEmbeddings = None,
        dense_weight: float = None,
        sparse_weight: float = None,
        top_k: int = None
    ):
        """
        初始化混合检索器

        Args:
            vector_store: 向量存储实例
            embeddings: Embedding实例
            dense_weight: Dense检索权重
            sparse_weight: Sparse检索权重
            top_k: 返回数量
        """
        self.vector_store = vector_store or get_vector_store()
        self.embeddings = embeddings or get_embeddings()

        retrieval_config = rag_config.retrieval
        self.dense_weight = dense_weight or retrieval_config["dense_weight"]
        self.sparse_weight = sparse_weight or retrieval_config["sparse_weight"]
        self.top_k = top_k or retrieval_config["top_k"]

        # 用于BM25的文档映射
        self._chunk_id_to_index: Dict[str, int] = {}
        self._index_to_chunk: Dict[int, Dict] = {}
        self._sparse_corpus_built = False

    def retrieve(
        self,
        query: str,
        top_k: int = None,
        category_filter: Optional[str] = None,
        use_hybrid: bool = True
    ) -> List[RetrievalResult]:
        """
        混合检索

        Args:
            query: 查询文本
            top_k: 返回数量
            category_filter: 分类过滤
            use_hybrid: 是否使用混合检索

        Returns:
            检索结果列表
        """
        top_k = top_k or self.top_k

        # 1. Dense检索
        dense_results = self._dense_search(query, top_k * 2, category_filter)
        logger.debug(f"Dense检索返回 {len(dense_results)} 条结果")

        if not use_hybrid or not self.embeddings.use_sparse:
            # 仅Dense检索
            return self._convert_to_results(dense_results, "dense")[:top_k]

        # 2. Sparse检索 (BM25)
        sparse_results = self._sparse_search(query, top_k * 2)
        logger.debug(f"Sparse检索返回 {len(sparse_results)} 条结果")

        # 3. RRF融合
        fused_results = self._rrf_fusion(dense_results, sparse_results, top_k)
        logger.info(f"混合检索返回 {len(fused_results)} 条结果")

        return fused_results

    def _dense_search(
        self,
        query: str,
        top_k: int,
        category_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Dense向量检索"""
        try:
            # 生成查询向量
            query_embedding = self.embeddings.embed_query(query)

            # Milvus检索
            results = self.vector_store.search(
                query_embedding=query_embedding,
                top_k=top_k,
                category_filter=category_filter
            )

            return results
        except Exception as e:
            logger.error(f"Dense检索失败: {e}")
            return []

    def _sparse_search(self, query: str, top_k: int) -> List[Tuple[str, float]]:
        """Sparse BM25检索"""
        try:
            if not self._sparse_corpus_built:
                logger.warning("BM25索引未构建")
                return []

            # BM25检索返回 (index, score)
            bm25_results = self.embeddings.sparse_search(query, top_k)

            # 转换为 (chunk_id, score)
            results = []
            for idx, score in bm25_results:
                if idx in self._index_to_chunk:
                    chunk_id = self._index_to_chunk[idx].get("chunk_id")
                    if chunk_id:
                        results.append((chunk_id, score))

            return results
        except Exception as e:
            logger.error(f"Sparse检索失败: {e}")
            return []

    def _rrf_fusion(
        self,
        dense_results: List[Dict],
        sparse_results: List[Tuple[str, float]],
        top_k: int,
        k: int = 60
    ) -> List[RetrievalResult]:
        """
        RRF（Reciprocal Rank Fusion）融合

        公式: RRF(d) = Σ 1/(k + rank_i(d))

        Args:
            dense_results: Dense检索结果
            sparse_results: Sparse检索结果 [(chunk_id, score), ...]
            top_k: 返回数量
            k: RRF参数，通常设为60

        Returns:
            融合后的结果
        """
        rrf_scores: Dict[str, float] = {}
        chunk_data: Dict[str, Dict] = {}

        # 处理Dense结果
        for rank, result in enumerate(dense_results, 1):
            chunk_id = result["chunk_id"]
            rrf_score = self.dense_weight / (k + rank)
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0) + rrf_score
            chunk_data[chunk_id] = result

        # 处理Sparse结果
        for rank, (chunk_id, _) in enumerate(sparse_results, 1):
            rrf_score = self.sparse_weight / (k + rank)
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0) + rrf_score

            # 如果Dense没有这个chunk，从映射中获取
            if chunk_id not in chunk_data and chunk_id in self._chunk_id_to_index:
                idx = self._chunk_id_to_index[chunk_id]
                if idx in self._index_to_chunk:
                    chunk_data[chunk_id] = self._index_to_chunk[idx]

        # 按RRF分数排序
        sorted_chunks = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

        # 转换为结果
        results = []
        for chunk_id, score in sorted_chunks[:top_k]:
            if chunk_id in chunk_data:
                data = chunk_data[chunk_id]
                results.append(RetrievalResult(
                    chunk_id=chunk_id,
                    content=data.get("content", ""),
                    full_text=data.get("full_text", ""),
                    doc_id=data.get("doc_id", ""),
                    doc_title=data.get("doc_title", ""),
                    source=data.get("source", ""),
                    category=data.get("category", ""),
                    score=score,
                    match_type="hybrid"
                ))

        return results

    def _convert_to_results(
        self,
        dense_results: List[Dict],
        match_type: str
    ) -> List[RetrievalResult]:
        """转换Dense结果为RetrievalResult"""
        return [
            RetrievalResult(
                chunk_id=r["chunk_id"],
                content=r.get("content", ""),
                full_text=r.get("full_text", ""),
                doc_id=r.get("doc_id", ""),
                doc_title=r.get("doc_title", ""),
                source=r.get("source", ""),
                category=r.get("category", ""),
                score=r.get("score", 0.0),
                match_type=match_type
            )
            for r in dense_results
        ]

    def build_sparse_index(self, chunks: List[Dict[str, Any]]):
        """
        构建BM25稀疏索引

        Args:
            chunks: chunk数据列表，每个包含chunk_id和content
        """
        if not chunks:
            return

        # 构建映射
        corpus = []
        for i, chunk in enumerate(chunks):
            chunk_id = chunk.get("chunk_id")
            content = chunk.get("full_text") or chunk.get("content", "")

            self._chunk_id_to_index[chunk_id] = i
            self._index_to_chunk[i] = chunk
            corpus.append(content)

        # 构建BM25索引
        self.embeddings.build_sparse_index(corpus)
        self._sparse_corpus_built = True

        logger.info(f"已构建BM25索引，文档数: {len(corpus)}")


# 全局实例
_retriever: Optional[HybridRetriever] = None


def get_retriever() -> HybridRetriever:
    """获取检索器实例"""
    global _retriever
    if _retriever is None:
        _retriever = HybridRetriever()
    return _retriever

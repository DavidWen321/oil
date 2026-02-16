"""
RAG Pipeline
整合所有RAG组件的完整流程
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

from src.config import settings, rag_config
from src.utils import logger
from src.models.enums import RetrievalQuality, KnowledgeCategory
from src.knowledge_graph import get_knowledge_graph_builder

from .document_processor import DocumentProcessor, Document, create_document_processor
from .contextual_chunker import ContextualChunker, Chunk, create_contextual_chunker
from .embeddings import HybridEmbeddings, get_embeddings
from .vector_store import MilvusVectorStore, get_vector_store
from .hybrid_retriever import HybridRetriever, RetrievalResult, get_retriever
from .reranker import Reranker, RerankResult, get_reranker
from .self_rag import SelfRAG, RetrievalDecision, get_self_rag, get_query_rewriter
from .graph_rag import GraphRAGRetriever


@dataclass
class RAGResponse:
    """RAG响应"""
    context: str                               # 检索到的上下文
    sources: List[Dict[str, Any]]              # 来源引用
    retrieval_quality: RetrievalQuality        # 检索质量
    decision: RetrievalDecision                # 检索决策
    should_fallback: bool = False              # 是否需要降级
    query_rewritten: Optional[str] = None      # 改写后的查询
    metadata: Dict[str, Any] = field(default_factory=dict)


class RAGPipeline:
    """
    RAG Pipeline

    完整流程：
    1. Self-RAG决策 - 判断是否需要检索
    2. 查询改写 - 优化查询
    3. 混合检索 - Dense + Sparse
    4. 重排序 - BGE-Reranker
    5. CRAG评估 - 检索质量评估
    6. 上下文构建 - 组装最终上下文
    """

    def __init__(
        self,
        document_processor: DocumentProcessor = None,
        chunker: ContextualChunker = None,
        embeddings: HybridEmbeddings = None,
        vector_store: MilvusVectorStore = None,
        retriever: HybridRetriever = None,
        reranker: Reranker = None,
        self_rag: SelfRAG = None,
        graph_rag: GraphRAGRetriever = None,
    ):
        """初始化RAG Pipeline"""
        self.document_processor = document_processor or create_document_processor()
        self.chunker = chunker or create_contextual_chunker()
        self.embeddings = embeddings or get_embeddings()
        self.vector_store = vector_store or get_vector_store()
        self.retriever = retriever or get_retriever()
        self.reranker = reranker or get_reranker()
        self.self_rag = self_rag or get_self_rag()
        self.query_rewriter = get_query_rewriter()
        self.graph_rag = graph_rag or GraphRAGRetriever(get_knowledge_graph_builder())

    def index_documents(
        self,
        knowledge_base_path: str = "knowledge_base",
        recreate: bool = False
    ) -> int:
        """
        索引知识库文档

        Args:
            knowledge_base_path: 知识库路径
            recreate: 是否重建索引

        Returns:
            索引的文档数量
        """
        logger.info(f"开始索引知识库: {knowledge_base_path}")

        # 1. 加载文档
        self.document_processor = DocumentProcessor(knowledge_base_path)
        documents = self.document_processor.load_all_documents()

        if not documents:
            logger.warning("没有找到可索引的文档")
            return 0

        # 2. 创建/重建Collection
        self.vector_store.create_collection(recreate=recreate)

        # 3. 分块和向量化
        all_chunks = []
        all_embeddings = []
        bm25_corpus = []

        for doc in documents:
            logger.info(f"处理文档: {doc.title}")

            # 分块（含Contextual Retrieval和HyPE）
            chunks = self.chunker.chunk_document(doc)

            # 准备向量化文本
            texts_to_embed = []
            for chunk in chunks:
                # 使用full_text进行向量化（包含上下文）
                texts_to_embed.append(chunk.full_text or chunk.content)

                # 如果启用HyPE，也对假设问题进行向量化
                if chunk.hypothetical_questions:
                    # 这里简化处理，将问题拼接到主文本中
                    # 实际可以分别存储问题向量
                    pass

            # 批量向量化
            if texts_to_embed:
                embeddings = self.embeddings.embed_documents(texts_to_embed)
                all_chunks.extend(chunks)
                all_embeddings.extend(embeddings)

                # 收集BM25语料
                for chunk in chunks:
                    bm25_corpus.append({
                        "chunk_id": chunk.chunk_id,
                        "content": chunk.content,
                        "full_text": chunk.full_text
                    })

        # 4. 批量插入Milvus
        if all_chunks:
            self.vector_store.insert_chunks(all_chunks, all_embeddings)

        # 5. 构建BM25索引
        if bm25_corpus:
            self.retriever.build_sparse_index(bm25_corpus)

        logger.info(f"索引完成，共 {len(documents)} 个文档，{len(all_chunks)} 个分块")
        return len(documents)

    def retrieve(
        self,
        query: str,
        top_k: int = None,
        category_filter: Optional[str] = None,
        skip_self_rag: bool = False
    ) -> RAGResponse:
        """
        执行RAG检索

        Args:
            query: 用户查询
            top_k: 返回数量
            category_filter: 分类过滤
            skip_self_rag: 是否跳过Self-RAG决策

        Returns:
            RAG响应
        """
        top_k = top_k or rag_config.retrieval["final_k"]

        # 1. Self-RAG决策
        if skip_self_rag:
            decision = RetrievalDecision.RETRIEVE
            decision_reason = "跳过Self-RAG"
        else:
            decision, decision_reason = self.self_rag.should_retrieve(query)

        logger.info(f"Self-RAG决策: {decision.value} - {decision_reason}")

        # 如果不需要检索，直接返回
        if decision != RetrievalDecision.RETRIEVE:
            return RAGResponse(
                context="",
                sources=[],
                retrieval_quality=RetrievalQuality.HIGH,
                decision=decision,
                metadata={"reason": decision_reason}
            )

        # 2. 查询改写（可选）
        rewritten_query = query
        if rag_config.features.get("query_rewrite", False):
            rewritten_query = self.query_rewriter.rewrite(query)

        # 3. 混合检索
        retrieval_results = self.retriever.retrieve(
            query=rewritten_query,
            top_k=top_k * 2,  # 检索更多，留给重排序筛选
            category_filter=category_filter
        )

        if not retrieval_results:
            return RAGResponse(
                context="",
                sources=[],
                retrieval_quality=RetrievalQuality.LOW,
                decision=decision,
                should_fallback=True,
                query_rewritten=rewritten_query if rewritten_query != query else None,
                metadata={"reason": "无检索结果"}
            )

        # 4. 重排序
        rerank_results = self.reranker.rerank(
            query=rewritten_query,
            results=retrieval_results,
            top_k=top_k
        )

        # 4.5 Graph RAG检索
        graph_results = self.graph_rag.retrieve(query, top_k=3)

        # 5. CRAG质量评估
        quality, quality_reason = self.self_rag.evaluate_retrieval_quality(
            query=query,
            results=rerank_results
        )

        logger.info(f"CRAG评估: {quality.value} - {quality_reason}")

        # 6. 构建上下文
        context = self._build_context(rerank_results, quality, graph_results)

        # 7. 构建来源引用
        sources = self._build_sources(rerank_results, graph_results)

        return RAGResponse(
            context=context,
            sources=sources,
            retrieval_quality=quality,
            decision=decision,
            should_fallback=(quality == RetrievalQuality.LOW),
            query_rewritten=rewritten_query if rewritten_query != query else None,
            metadata={
                "decision_reason": decision_reason,
                "quality_reason": quality_reason,
                "num_results": len(rerank_results),
                "graph_results": len(graph_results),
            }
        )

    def _build_context(
        self,
        results: List[RerankResult],
        quality: RetrievalQuality,
        graph_results: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """构建检索上下文"""
        graph_results = graph_results or []

        if not results:
            graph_context = "\n\n".join([item.get("content", "") for item in graph_results if item.get("content")])
            return graph_context

        # 根据质量决定处理方式
        if quality == RetrievalQuality.HIGH:
            # 直接使用full_text
            parts = [r.full_text or r.content for r in results]
        elif quality == RetrievalQuality.MEDIUM:
            # 精炼上下文
            parts = [r.full_text or r.content for r in results]
        else:
            # 低质量，只取最相关的
            parts = [results[0].full_text or results[0].content] if results else []

        # 追加图谱上下文
        parts.extend([item.get("content", "") for item in graph_results if item.get("content")])

        return "\n\n---\n\n".join(parts)

    def _build_sources(
        self,
        results: List[RerankResult],
        graph_results: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """构建来源引用"""
        sources = []
        seen_docs = set()

        for r in results:
            if r.doc_id not in seen_docs:
                sources.append({
                    "doc_id": r.doc_id,
                    "doc_title": r.doc_title,
                    "source": r.source,
                    "category": r.category,
                    "score": r.final_score,
                    "content_preview": r.content[:200] + "..." if len(r.content) > 200 else r.content
                })
                seen_docs.add(r.doc_id)

        for index, graph_item in enumerate(graph_results or [], start=1):
            sources.append({
                "doc_id": f"graph_{index}",
                "doc_title": "知识图谱推理结果",
                "source": "knowledge_graph",
                "category": "graph",
                "score": graph_item.get("confidence", 0.0),
                "content_preview": graph_item.get("content", "")[:200],
            })

        return sources

    def add_document(self, file_path: str) -> bool:
        """
        添加单个文档到知识库

        Args:
            file_path: 文件路径

        Returns:
            是否成功
        """
        try:
            # 加载文档
            doc = self.document_processor.load_document(file_path)
            if not doc:
                return False

            # 分块
            chunks = self.chunker.chunk_document(doc)

            # 向量化
            texts = [c.full_text or c.content for c in chunks]
            embeddings = self.embeddings.embed_documents(texts)

            # 插入Milvus
            self.vector_store.insert_chunks(chunks, embeddings)

            # 更新BM25索引（需要重建）
            # 这里简化处理，实际可以增量更新

            logger.info(f"已添加文档: {file_path}")
            return True

        except Exception as e:
            logger.error(f"添加文档失败: {e}")
            return False

    def delete_document(self, doc_id: str) -> bool:
        """
        从知识库删除文档

        Args:
            doc_id: 文档ID

        Returns:
            是否成功
        """
        try:
            self.vector_store.delete_by_doc_id(doc_id)
            logger.info(f"已删除文档: {doc_id}")
            return True
        except Exception as e:
            logger.error(f"删除文档失败: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """获取知识库统计信息"""
        return self.vector_store.get_stats()


# 全局实例
_pipeline: Optional[RAGPipeline] = None


def get_rag_pipeline() -> RAGPipeline:
    """获取RAG Pipeline实例"""
    global _pipeline
    if _pipeline is None:
        _pipeline = RAGPipeline()
    return _pipeline

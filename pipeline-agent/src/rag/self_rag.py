"""
Self-RAG 和 CRAG (Corrective RAG) 实现
智能判断是否需要检索，以及检索质量评估
"""

from typing import List, Optional, Tuple
from enum import Enum

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from src.config import settings, rag_config
from src.utils import logger
from src.models.enums import RetrievalQuality
from .reranker import RerankResult


class RetrievalDecision(Enum):
    """检索决策"""
    RETRIEVE = "retrieve"       # 需要检索知识库
    DIRECT = "direct"          # 直接回答，不需要检索
    SQL = "sql"                # 需要查询数据库
    CALCULATE = "calculate"    # 需要计算


class SelfRAG:
    """
    Self-RAG: 自适应检索

    功能：
    1. 判断是否需要检索知识库
    2. 评估检索结果质量 (CRAG)
    3. 决定是否需要降级处理
    """

    # 检索决策Prompt
    DECISION_PROMPT = """你是一个智能助手，需要判断用户的问题应该如何处理。

用户问题: {query}

请判断这个问题属于以下哪种类型：
1. retrieve - 需要检索知识库回答的专业问题（如：概念解释、规范标准、原理说明）
2. direct - 可以直接回答的简单问题（如：闲聊、常识问题、简单计算）
3. sql - 需要查询数据库的数据问题（如：查询项目信息、管道参数、泵站数据）
4. calculate - 需要执行水力计算的问题（如：计算雷诺数、摩阻损失、泵扬程）

只输出类型名称（retrieve/direct/sql/calculate），不要输出其他内容。

类型："""

    # 检索质量评估Prompt (CRAG)
    QUALITY_PROMPT = """请评估以下检索结果与用户问题的相关性。

用户问题: {query}

检索结果:
{context}

请评估这些结果的相关性：
- high: 结果高度相关，可以直接用于回答
- medium: 结果部分相关，需要补充或提炼
- low: 结果不太相关，可能需要其他方式获取信息

只输出评估结果（high/medium/low），不要输出其他内容。

评估："""

    def __init__(self):
        """初始化Self-RAG"""
        self.enabled = rag_config.features["self_rag"]
        self._llm = None

    @property
    def llm(self):
        """获取LLM实例"""
        if self._llm is None:
            self._llm = ChatOpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_API_BASE,
                model=settings.LLM_MODEL,
                temperature=0,
                max_tokens=256,
            )
        return self._llm

    def should_retrieve(self, query: str) -> Tuple[RetrievalDecision, str]:
        """
        判断是否需要检索知识库

        Args:
            query: 用户查询

        Returns:
            (决策, 推理说明)
        """
        if not self.enabled:
            # 默认检索
            return RetrievalDecision.RETRIEVE, "Self-RAG未启用，默认检索"

        try:
            prompt = ChatPromptTemplate.from_template(self.DECISION_PROMPT)
            chain = prompt | self.llm | StrOutputParser()

            decision_text = chain.invoke({"query": query}).strip().lower()

            # 解析决策
            if "direct" in decision_text:
                return RetrievalDecision.DIRECT, "简单问题，无需检索"
            elif "sql" in decision_text:
                return RetrievalDecision.SQL, "数据查询，转SQL Agent"
            elif "calculate" in decision_text:
                return RetrievalDecision.CALCULATE, "计算需求，转Calc Agent"
            else:
                return RetrievalDecision.RETRIEVE, "专业问题，需要检索知识库"

        except Exception as e:
            logger.warning(f"Self-RAG决策失败: {e}")
            return RetrievalDecision.RETRIEVE, "决策失败，默认检索"

    def evaluate_retrieval_quality(
        self,
        query: str,
        results: List[RerankResult]
    ) -> Tuple[RetrievalQuality, str]:
        """
        CRAG: 评估检索质量

        Args:
            query: 用户查询
            results: 检索结果

        Returns:
            (质量评估, 说明)
        """
        if not results:
            return RetrievalQuality.LOW, "无检索结果"

        if not rag_config.features["crag"]:
            # CRAG未启用，根据分数简单判断
            avg_score = sum(r.final_score for r in results) / len(results)
            if avg_score >= 0.7:
                return RetrievalQuality.HIGH, f"平均分数 {avg_score:.2f}"
            elif avg_score >= 0.4:
                return RetrievalQuality.MEDIUM, f"平均分数 {avg_score:.2f}"
            else:
                return RetrievalQuality.LOW, f"平均分数 {avg_score:.2f}"

        try:
            # 构建上下文
            context_parts = []
            for i, r in enumerate(results[:5], 1):
                context_parts.append(f"[{i}] {r.content[:300]}...")
            context = "\n\n".join(context_parts)

            prompt = ChatPromptTemplate.from_template(self.QUALITY_PROMPT)
            chain = prompt | self.llm | StrOutputParser()

            quality_text = chain.invoke({
                "query": query,
                "context": context
            }).strip().lower()

            # 解析质量
            if "high" in quality_text:
                return RetrievalQuality.HIGH, "检索结果高度相关"
            elif "medium" in quality_text:
                return RetrievalQuality.MEDIUM, "检索结果部分相关，需要提炼"
            else:
                return RetrievalQuality.LOW, "检索结果相关性较低"

        except Exception as e:
            logger.warning(f"CRAG评估失败: {e}")
            # 回退到分数判断
            avg_score = sum(r.final_score for r in results) / len(results)
            if avg_score >= 0.5:
                return RetrievalQuality.MEDIUM, "评估失败，按分数判断为中等"
            else:
                return RetrievalQuality.LOW, "评估失败，按分数判断为低"

    def refine_context(
        self,
        query: str,
        results: List[RerankResult]
    ) -> str:
        """
        提炼/精炼上下文（CRAG中等质量时使用）

        Args:
            query: 用户查询
            results: 检索结果

        Returns:
            精炼后的上下文
        """
        if not results:
            return ""

        # 简单拼接（可以扩展为LLM精炼）
        refined_parts = []
        for r in results:
            # 使用full_text（包含上下文说明）
            text = r.full_text if r.full_text else r.content
            refined_parts.append(text)

        return "\n\n---\n\n".join(refined_parts)


class QueryRewriter:
    """
    查询改写���

    用于优化用户查询以提高检索效果
    """

    REWRITE_PROMPT = """请将用户的口语化问题改写为更适合知识库检索的形式。

原始问题: {query}

改写要求：
1. 保持原意不变
2. 使用专业术语
3. 去除口语化表达
4. 可以拆分为多个子问题

改写后的问题（直接输出，不要加前缀）："""

    def __init__(self):
        self._llm = None

    @property
    def llm(self):
        if self._llm is None:
            self._llm = ChatOpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_API_BASE,
                model=settings.LLM_MODEL,
                temperature=0.3,
                max_tokens=512,
            )
        return self._llm

    def rewrite(self, query: str) -> str:
        """改写查询"""
        try:
            prompt = ChatPromptTemplate.from_template(self.REWRITE_PROMPT)
            chain = prompt | self.llm | StrOutputParser()

            rewritten = chain.invoke({"query": query}).strip()
            logger.debug(f"查询改写: '{query}' -> '{rewritten}'")
            return rewritten
        except Exception as e:
            logger.warning(f"查询改写失败: {e}")
            return query


# 全局实例
_self_rag: Optional[SelfRAG] = None
_query_rewriter: Optional[QueryRewriter] = None


def get_self_rag() -> SelfRAG:
    """获取Self-RAG实例"""
    global _self_rag
    if _self_rag is None:
        _self_rag = SelfRAG()
    return _self_rag


def get_query_rewriter() -> QueryRewriter:
    """获取查询改写器实例"""
    global _query_rewriter
    if _query_rewriter is None:
        _query_rewriter = QueryRewriter()
    return _query_rewriter

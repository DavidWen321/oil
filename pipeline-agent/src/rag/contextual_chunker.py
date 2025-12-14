"""
上下文分块器 (Contextual Chunker)
实现Contextual Retrieval和HyPE技术
2025年最新RAG方案
"""

import re
import hashlib
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from src.config import settings
from src.utils import logger
from src.models.enums import KnowledgeCategory
from .document_processor import Document


@dataclass
class Chunk:
    """分块数据结构"""
    chunk_id: str                              # 分块ID
    content: str                               # 原始内容
    context: Optional[str] = None              # Contextual Retrieval生成的上下文
    full_text: Optional[str] = None            # 上下文+原始内容的完整文本
    hypothetical_questions: List[str] = field(default_factory=list)  # HyPE生成的假设问题
    doc_id: str = ""                           # 所属文档ID
    doc_title: str = ""                        # 文档标题
    source: str = ""                           # 来源
    category: Optional[KnowledgeCategory] = None  # 知识分类
    chunk_index: int = 0                       # 在文档中的位置
    metadata: Dict[str, Any] = field(default_factory=dict)


class ContextualChunker:
    """
    上下文分块器

    核心功能：
    1. 语义分块 - 基于语义边界切分文档
    2. Contextual Retrieval - 为每个chunk生成上下文说明
    3. HyPE - 为每个chunk预生成假设问题
    """

    # 上下文生成Prompt
    CONTEXT_PROMPT = """请为以下文档片段生成简短的上下文说明。

<document>
{whole_document}
</document>

<chunk>
{chunk_content}
</chunk>

请用1-2句话说明：
1. 这个片段来自文档的哪个部分
2. 主要讨论什么内容
3. 与整个文档的关系

上下文说明（直接输出，不要加前缀）："""

    # HyPE假设问题生成Prompt
    HYPE_PROMPT = """请为以下内容生成{num_questions}个用户可能会问的问题。

<content>
{chunk_content}
</content>

要求：
1. 问题要自然、多样化
2. 涵盖内容的不同方面
3. 包含专业术语和通俗表达
4. 每行一个问题，不要编号

问题列表："""

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        use_contextual: bool = True,
        use_hype: bool = True,
        hype_questions_per_chunk: int = 3
    ):
        """
        初始化上下文分块器

        Args:
            chunk_size: 分块大小（字符数）
            chunk_overlap: 分块重叠
            use_contextual: 是否使用Contextual Retrieval
            use_hype: 是否使用HyPE
            hype_questions_per_chunk: 每个chunk生成的假设问题数
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.use_contextual = use_contextual
        self.use_hype = use_hype
        self.hype_questions_per_chunk = hype_questions_per_chunk

        # 分隔符优先级
        self.separators = ["\n\n", "\n", "。", "；", ".", ";", " "]

        # LLM for context/question generation
        self._llm = None

    @property
    def llm(self):
        """获取LLM实例（懒加载）"""
        if self._llm is None:
            self._llm = ChatOpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_API_BASE,
                model=settings.LLM_MODEL,
                temperature=0.3,
                max_tokens=500
            )
        return self._llm

    def chunk_document(self, document: Document) -> List[Chunk]:
        """
        对文档进行分块

        Args:
            document: 文档对象

        Returns:
            Chunk列表
        """
        # 1. 基础分块
        raw_chunks = self._split_text(document.content)
        logger.info(f"文档 '{document.title}' 切分为 {len(raw_chunks)} 个块")

        chunks = []
        for i, chunk_content in enumerate(raw_chunks):
            chunk_id = self._generate_chunk_id(document.doc_id, i)

            chunk = Chunk(
                chunk_id=chunk_id,
                content=chunk_content,
                doc_id=document.doc_id,
                doc_title=document.title or "",
                source=document.source,
                category=document.category,
                chunk_index=i,
                metadata={
                    "doc_title": document.title,
                    "category": document.category.value if document.category else None
                }
            )

            # 2. Contextual Retrieval - 生成上下文
            if self.use_contextual:
                context = self._generate_context(document.content, chunk_content)
                chunk.context = context
                chunk.full_text = f"[上下文] {context}\n\n[原文] {chunk_content}"
            else:
                chunk.full_text = chunk_content

            # 3. HyPE - 生成假设问题
            if self.use_hype:
                questions = self._generate_hypothetical_questions(chunk_content)
                chunk.hypothetical_questions = questions

            chunks.append(chunk)

        return chunks

    def _split_text(self, text: str) -> List[str]:
        """
        语义分块

        使用分隔符优先级进行递归分割
        """
        chunks = []
        self._recursive_split(text, chunks, 0)
        return chunks

    def _recursive_split(self, text: str, chunks: List[str], sep_index: int):
        """递归分割文本"""
        if len(text) <= self.chunk_size:
            if text.strip():
                chunks.append(text.strip())
            return

        if sep_index >= len(self.separators):
            # 强制按字符切分
            for i in range(0, len(text), self.chunk_size - self.chunk_overlap):
                chunk = text[i:i + self.chunk_size]
                if chunk.strip():
                    chunks.append(chunk.strip())
            return

        separator = self.separators[sep_index]
        parts = text.split(separator)

        current_chunk = ""
        for part in parts:
            # 加上分隔符还原
            part_with_sep = part + separator if separator != " " else part + " "

            if len(current_chunk) + len(part_with_sep) <= self.chunk_size:
                current_chunk += part_with_sep
            else:
                if current_chunk.strip():
                    # 当前chunk已满，检查是否需要进一步分割
                    if len(current_chunk) > self.chunk_size:
                        self._recursive_split(current_chunk, chunks, sep_index + 1)
                    else:
                        chunks.append(current_chunk.strip())

                # 检查新part是否需要分割
                if len(part_with_sep) > self.chunk_size:
                    self._recursive_split(part_with_sep, chunks, sep_index + 1)
                    current_chunk = ""
                else:
                    current_chunk = part_with_sep

        # 处理剩余内容
        if current_chunk.strip():
            if len(current_chunk) > self.chunk_size:
                self._recursive_split(current_chunk, chunks, sep_index + 1)
            else:
                chunks.append(current_chunk.strip())

    def _generate_context(self, whole_document: str, chunk_content: str) -> str:
        """
        生成Contextual Retrieval上下文

        Args:
            whole_document: 完整文档内容
            chunk_content: 当前chunk内容

        Returns:
            上下文说明
        """
        try:
            # 截断文档以避免超出token限制
            max_doc_length = 3000
            if len(whole_document) > max_doc_length:
                # 保留开头和结尾，中间截断
                half = max_doc_length // 2
                whole_document = whole_document[:half] + "\n...[中间内容省略]...\n" + whole_document[-half:]

            prompt = ChatPromptTemplate.from_template(self.CONTEXT_PROMPT)
            chain = prompt | self.llm

            response = chain.invoke({
                "whole_document": whole_document,
                "chunk_content": chunk_content
            })

            return response.content.strip()
        except Exception as e:
            logger.warning(f"上下文生成失败: {e}")
            return ""

    def _generate_hypothetical_questions(self, chunk_content: str) -> List[str]:
        """
        生成HyPE假设问题

        Args:
            chunk_content: chunk内容

        Returns:
            假设问题列表
        """
        try:
            prompt = ChatPromptTemplate.from_template(self.HYPE_PROMPT)
            chain = prompt | self.llm

            response = chain.invoke({
                "chunk_content": chunk_content,
                "num_questions": self.hype_questions_per_chunk
            })

            # 解析问题列表
            questions = []
            for line in response.content.strip().split("\n"):
                line = line.strip()
                # 移除编号
                line = re.sub(r"^\d+[\.\)、]\s*", "", line)
                if line and len(line) > 5:  # 过滤太短的行
                    questions.append(line)

            return questions[:self.hype_questions_per_chunk]
        except Exception as e:
            logger.warning(f"假设问题生成失败: {e}")
            return []

    def _generate_chunk_id(self, doc_id: str, index: int) -> str:
        """生成chunk ID"""
        raw = f"{doc_id}_{index}"
        return hashlib.md5(raw.encode()).hexdigest()[:16]


def create_contextual_chunker() -> ContextualChunker:
    """根据配置创建上下文分块器"""
    from src.config import rag_config

    return ContextualChunker(
        chunk_size=rag_config.chunking["chunk_size"],
        chunk_overlap=rag_config.chunking["chunk_overlap"],
        use_contextual=rag_config.features["contextual"],
        use_hype=rag_config.features["hype"],
        hype_questions_per_chunk=rag_config.hype["questions_per_chunk"]
    )

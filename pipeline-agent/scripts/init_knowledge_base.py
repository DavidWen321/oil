"""
RAG知识库初始化脚本
负责将知识文档加载到Milvus向量数据库
"""

import os
import sys
from pathlib import Path
from typing import List

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Milvus
from langchain_community.embeddings import DashScopeEmbeddings

from src.config import settings
from src.utils import logger


def load_documents(knowledge_base_dir: str) -> List:
    """
    加载知识库文档

    Args:
        knowledge_base_dir: 知识库目录路径

    Returns:
        文档列表
    """
    logger.info(f"开始加载知识库文档: {knowledge_base_dir}")

    # 加载Markdown文档
    loader = DirectoryLoader(
        knowledge_base_dir,
        glob="**/*.md",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"}
    )

    documents = loader.load()
    logger.info(f"成功加载 {len(documents)} 个文档")

    return documents


def split_documents(documents: List) -> List:
    """
    分割文档为小块

    Args:
        documents: 原始文档列表

    Returns:
        分割后的文档块列表
    """
    logger.info("开始分割文档...")

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.RAG_CHUNK_SIZE,
        chunk_overlap=settings.RAG_CHUNK_OVERLAP,
        separators=["\n## ", "\n### ", "\n#### ", "\n\n", "\n", " ", ""],
        length_function=len,
    )

    chunks = text_splitter.split_documents(documents)
    logger.info(f"文档分割完成，共 {len(chunks)} 个块")

    return chunks


def init_milvus_collection(chunks: List) -> Milvus:
    """
    初始化Milvus集合并插入文档

    Args:
        chunks: 文档块列表

    Returns:
        Milvus向量存储实例
    """
    logger.info("开始初始化Milvus集合...")

    # 创建嵌入模型
    embeddings = DashScopeEmbeddings(
        model=settings.EMBEDDING_MODEL,
        dashscope_api_key=settings.DASHSCOPE_API_KEY,
    )

    # 创建Milvus向量存储
    vector_store = Milvus.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=settings.MILVUS_COLLECTION,
        connection_args={
            "host": settings.MILVUS_HOST,
            "port": settings.MILVUS_PORT,
            "user": settings.MILVUS_USER,
            "password": settings.MILVUS_PASSWORD,
        },
        drop_old=True,  # 删除旧集合
    )

    logger.info(f"Milvus集合 '{settings.MILVUS_COLLECTION}' 初始化完成")

    return vector_store


def verify_collection(vector_store: Milvus):
    """
    验证集合是否正常工作

    Args:
        vector_store: Milvus向量存储实例
    """
    logger.info("开始验证集合...")

    # 测试查询
    test_query = "管道水力计算的基本公式"
    results = vector_store.similarity_search(test_query, k=3)

    logger.info(f"测试查询: {test_query}")
    logger.info(f"返回 {len(results)} 个结果:")
    for i, doc in enumerate(results, 1):
        logger.info(f"  {i}. {doc.page_content[:100]}...")

    logger.info("集合验证完成")


def main():
    """主函数"""
    try:
        # 知识库目录
        knowledge_base_dir = os.path.join(project_root, "knowledge_base")

        if not os.path.exists(knowledge_base_dir):
            logger.error(f"知识库目录不存在: {knowledge_base_dir}")
            return

        # 1. 加载文档
        documents = load_documents(knowledge_base_dir)

        if not documents:
            logger.warning("未找到任何文档，跳过初始化")
            return

        # 2. 分割文档
        chunks = split_documents(documents)

        # 3. 初始化Milvus集合
        vector_store = init_milvus_collection(chunks)

        # 4. 验证集合
        verify_collection(vector_store)

        logger.info("✅ RAG知识库初始化成功！")

    except Exception as e:
        logger.error(f"❌ RAG知识库初始化失败: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

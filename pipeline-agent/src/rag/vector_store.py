"""
向量存储模块
使用Milvus作为向量数据库
"""

from typing import List, Optional, Dict, Any
from dataclasses import asdict

from src.config import settings
from src.utils import logger
from .contextual_chunker import Chunk


class MilvusVectorStore:
    """
    Milvus向量存储

    支持：
    1. Dense向量存储和检索
    2. 元数据过滤
    3. 批量操作
    """

    # Collection Schema字段
    FIELDS = {
        "chunk_id": "VARCHAR(64)",      # 主键
        "content": "VARCHAR(65535)",    # 原始内容
        "full_text": "VARCHAR(65535)",  # 上下文+内容
        "doc_id": "VARCHAR(64)",        # 文档ID
        "doc_title": "VARCHAR(256)",    # 文档标题
        "source": "VARCHAR(512)",       # 来源
        "category": "VARCHAR(32)",      # 分类
        "chunk_index": "INT64",         # 位置索引
        "embedding": f"FLOAT_VECTOR({settings.EMBEDDING_DIMENSION})"
    }

    def __init__(
        self,
        collection_name: str = None,
        host: str = None,
        port: int = None
    ):
        """
        初始化Milvus向量存储

        Args:
            collection_name: 集合名称
            host: Milvus主机
            port: Milvus端口
        """
        self.collection_name = collection_name or settings.MILVUS_COLLECTION
        self.host = host or settings.MILVUS_HOST
        self.port = port or settings.MILVUS_PORT
        self.dimension = settings.EMBEDDING_DIMENSION

        self._collection = None
        self._connected = False

    def connect(self):
        """连接到Milvus"""
        if self._connected:
            return

        try:
            from pymilvus import connections, Collection, utility

            connections.connect(
                alias="default",
                host=self.host,
                port=self.port
            )
            self._connected = True
            logger.info(f"已连接到Milvus: {self.host}:{self.port}")

            # 检查集合是否存在
            if utility.has_collection(self.collection_name):
                self._collection = Collection(self.collection_name)
                self._collection.load()
                logger.info(f"已加载集合: {self.collection_name}")
            else:
                logger.info(f"集合不存在，需要创建: {self.collection_name}")

        except Exception as e:
            logger.error(f"Milvus连接失败: {e}")
            raise

    def create_collection(self, recreate: bool = False):
        """
        创建Collection

        Args:
            recreate: 是否重建（删除现有）
        """
        from pymilvus import (
            Collection, CollectionSchema, FieldSchema, DataType, utility
        )

        self.connect()

        if utility.has_collection(self.collection_name):
            if recreate:
                utility.drop_collection(self.collection_name)
                logger.info(f"已删除旧集合: {self.collection_name}")
            else:
                self._collection = Collection(self.collection_name)
                return

        # 定义Schema
        fields = [
            FieldSchema(name="chunk_id", dtype=DataType.VARCHAR, max_length=64,
                        is_primary=True, auto_id=False),
            FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="full_text", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="doc_id", dtype=DataType.VARCHAR, max_length=64),
            FieldSchema(name="doc_title", dtype=DataType.VARCHAR, max_length=256),
            FieldSchema(name="source", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="category", dtype=DataType.VARCHAR, max_length=32),
            FieldSchema(name="chunk_index", dtype=DataType.INT64),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR,
                        dim=self.dimension)
        ]

        schema = CollectionSchema(
            fields=fields,
            description="Pipeline Knowledge Base"
        )

        self._collection = Collection(
            name=self.collection_name,
            schema=schema
        )

        # 创建索引
        index_params = {
            "metric_type": "COSINE",
            "index_type": "IVF_FLAT",
            "params": {"nlist": 128}
        }
        self._collection.create_index(
            field_name="embedding",
            index_params=index_params
        )

        logger.info(f"已创建集合: {self.collection_name}")

    def insert_chunks(
        self,
        chunks: List[Chunk],
        embeddings: List[List[float]]
    ) -> int:
        """
        插入分块数据

        Args:
            chunks: Chunk列表
            embeddings: 对应的向量列表

        Returns:
            插入的记录数
        """
        if not chunks or not embeddings:
            return 0

        if len(chunks) != len(embeddings):
            raise ValueError("chunks和embeddings长度不匹配")

        self.connect()
        if self._collection is None:
            self.create_collection()

        # 准备数据
        data = [
            [c.chunk_id for c in chunks],                                    # chunk_id
            [c.content[:65000] for c in chunks],                             # content
            [(c.full_text or c.content)[:65000] for c in chunks],            # full_text
            [c.doc_id for c in chunks],                                      # doc_id
            [c.doc_title[:250] for c in chunks],                             # doc_title
            [c.source[:500] for c in chunks],                                # source
            [c.category.value if c.category else "" for c in chunks],        # category
            [c.chunk_index for c in chunks],                                 # chunk_index
            embeddings                                                        # embedding
        ]

        self._collection.insert(data)
        self._collection.flush()

        logger.info(f"已插入 {len(chunks)} 条记录")
        return len(chunks)

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        category_filter: Optional[str] = None,
        score_threshold: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        向量检索

        Args:
            query_embedding: 查询向量
            top_k: 返回数量
            category_filter: 分类过滤
            score_threshold: 最低分数阈值

        Returns:
            检索结果列表
        """
        self.connect()
        if self._collection is None:
            logger.warning("集合不存在")
            return []

        # 构建过滤表达式
        expr = None
        if category_filter:
            expr = f'category == "{category_filter}"'

        # 搜索参数
        search_params = {
            "metric_type": "COSINE",
            "params": {"nprobe": 16}
        }

        # 执行搜索
        results = self._collection.search(
            data=[query_embedding],
            anns_field="embedding",
            param=search_params,
            limit=top_k,
            expr=expr,
            output_fields=["chunk_id", "content", "full_text", "doc_id",
                           "doc_title", "source", "category", "chunk_index"]
        )

        # 转换结果
        search_results = []
        for hits in results:
            for hit in hits:
                score = hit.score
                if score >= score_threshold:
                    search_results.append({
                        "chunk_id": hit.entity.get("chunk_id"),
                        "content": hit.entity.get("content"),
                        "full_text": hit.entity.get("full_text"),
                        "doc_id": hit.entity.get("doc_id"),
                        "doc_title": hit.entity.get("doc_title"),
                        "source": hit.entity.get("source"),
                        "category": hit.entity.get("category"),
                        "chunk_index": hit.entity.get("chunk_index"),
                        "score": score
                    })

        return search_results

    def delete_by_doc_id(self, doc_id: str) -> int:
        """
        删除指定文档的所有分块

        Args:
            doc_id: 文档ID

        Returns:
            删除的记录数
        """
        self.connect()
        if self._collection is None:
            return 0

        expr = f'doc_id == "{doc_id}"'
        self._collection.delete(expr)
        self._collection.flush()

        logger.info(f"已删除文档 {doc_id} 的所有分块")
        return 1

    def get_stats(self) -> Dict[str, Any]:
        """获取集合统计信息"""
        self.connect()
        if self._collection is None:
            return {"exists": False}

        return {
            "exists": True,
            "name": self.collection_name,
            "num_entities": self._collection.num_entities,
            "description": self._collection.description
        }

    def close(self):
        """关闭连接"""
        if self._connected:
            from pymilvus import connections
            connections.disconnect("default")
            self._connected = False
            logger.info("Milvus连接已关闭")


# 全局实例
_vector_store: Optional[MilvusVectorStore] = None


def get_vector_store() -> MilvusVectorStore:
    """获取向量存储实例"""
    global _vector_store
    if _vector_store is None:
        _vector_store = MilvusVectorStore()
    return _vector_store

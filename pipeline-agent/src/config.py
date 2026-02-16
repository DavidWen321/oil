"""
Pipeline Agent 配置管理
版本: 2025年11月
"""

from functools import lru_cache
from typing import Optional, Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
import redis as redis_lib


class Settings(BaseSettings):
    """应用配置 - 从环境变量加载"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # ===== 应用配置 =====
    APP_NAME: str = "Pipeline Agent"
    APP_VERSION: str = "4.0.0"
    DEBUG: bool = True

    # ===== LLM 配置 (Claude Opus 4.6) =====
    OPENAI_API_KEY: str = Field(default="sk-xxx")
    OPENAI_API_BASE: str = Field(default="https://api.penguinsaichat.dpdns.org/v1")
    LLM_MODEL: str = Field(default="claude-opus-4-6")
    LLM_TEMPERATURE: float = Field(default=0.1)
    LLM_MAX_TOKENS: int = Field(default=4096)

    # ===== Embedding 配置 (DashScope) =====
    EMBEDDING_API_KEY: str = Field(default="sk-xxx")
    EMBEDDING_API_BASE: str = Field(default="https://dashscope.aliyuncs.com/compatible-mode/v1")
    EMBEDDING_MODEL: str = Field(default="text-embedding-v3")
    EMBEDDING_DIMENSION: int = Field(default=1024)

    # ===== 数据库配置 =====
    DB_HOST: str = Field(default="localhost")
    DB_PORT: int = Field(default=3306)
    DB_USER: str = Field(default="root")
    DB_PASSWORD: str = Field(default="root")
    DB_NAME: str = Field(default="pipeline_cloud")

    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return f"mysql+aiomysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # ===== Redis 配置 =====
    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)
    REDIS_PASSWORD: str = Field(default="")
    REDIS_DB: int = Field(default=0)

    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # ===== Milvus 配置 =====
    MILVUS_HOST: str = Field(default="localhost")
    MILVUS_PORT: int = Field(default=19530)
    MILVUS_COLLECTION: str = Field(default="pipeline_knowledge")

    # ===== Java 服务配置 =====
    JAVA_GATEWAY_URL: str = Field(default="http://localhost:8080")
    JAVA_AUTH_USERNAME: str = Field(default="admin")
    JAVA_AUTH_PASSWORD: str = Field(default="admin123")
    JAVA_REQUEST_TIMEOUT: int = Field(default=30)

    # ===== Agent 配置 =====
    AGENT_MAX_ITERATIONS: int = Field(default=10)
    AGENT_MAX_RETRIES_PER_STEP: int = Field(default=2)
    AGENT_TIMEOUT: int = Field(default=60)

    # ===== RAG 配置 (2025最新) =====
    # 分块配置
    RAG_CHUNK_SIZE: int = Field(default=512)
    RAG_CHUNK_OVERLAP: int = Field(default=50)
    RAG_CHUNKING_METHOD: Literal["semantic", "fixed", "sentence"] = Field(default="semantic")

    # 检索配置
    RAG_TOP_K: int = Field(default=10)
    RAG_FINAL_K: int = Field(default=5)
    RAG_DENSE_WEIGHT: float = Field(default=0.7)
    RAG_SPARSE_WEIGHT: float = Field(default=0.3)

    # 高级RAG功能开关
    RAG_USE_HYPE: bool = Field(default=True)           # HyPE (2025新技术，替代HyDE)
    RAG_USE_CONTEXTUAL: bool = Field(default=True)    # Contextual Retrieval
    RAG_USE_CRAG: bool = Field(default=True)          # Corrective RAG
    RAG_USE_SELF_RAG: bool = Field(default=True)      # Self-RAG (自适应检索)
    RAG_USE_RERANKING: bool = Field(default=True)     # Re-ranking

    # HyPE 配置
    HYPE_QUESTIONS_PER_CHUNK: int = Field(default=3)  # 每个chunk生成的假设问题数

    # Reranker 配置
    RERANKER_MODEL: str = Field(default="gte-rerank")
    RERANKER_THRESHOLD: float = Field(default=0.5)
    RERANKER_MODE: Literal["api", "local", "llm"] = Field(
        default="api",
        description="api=DashScope gte-rerank; local=本地BGE模型; llm=用LLM打分"
    )

    # ===== API 配置 =====
    API_HOST: str = Field(default="0.0.0.0")
    API_PORT: int = Field(default=8100)
    API_WORKERS: int = Field(default=4)

    # ===== 日志配置 =====
    LOG_LEVEL: str = Field(default="INFO")
    LOG_FILE: Optional[str] = Field(default="logs/agent.log")

    # ===== LangSmith 追踪 (可选) =====
    LANGCHAIN_TRACING_V2: bool = Field(default=False)
    LANGCHAIN_API_KEY: Optional[str] = Field(default=None)
    LANGCHAIN_PROJECT: str = Field(default="pipeline-agent")


class RAGConfig:
    """RAG Pipeline 配置类"""

    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def chunking(self) -> dict:
        return {
            "method": self.settings.RAG_CHUNKING_METHOD,
            "chunk_size": self.settings.RAG_CHUNK_SIZE,
            "chunk_overlap": self.settings.RAG_CHUNK_OVERLAP,
            "separators": ["\n\n", "\n", "。", "；", ".", ";"]
        }

    @property
    def retrieval(self) -> dict:
        return {
            "dense_weight": self.settings.RAG_DENSE_WEIGHT,
            "sparse_weight": self.settings.RAG_SPARSE_WEIGHT,
            "top_k": self.settings.RAG_TOP_K,
            "final_k": self.settings.RAG_FINAL_K
        }

    @property
    def features(self) -> dict:
        return {
            "hype": self.settings.RAG_USE_HYPE,
            "contextual": self.settings.RAG_USE_CONTEXTUAL,
            "crag": self.settings.RAG_USE_CRAG,
            "self_rag": self.settings.RAG_USE_SELF_RAG,
            "reranking": self.settings.RAG_USE_RERANKING
        }

    @property
    def hype(self) -> dict:
        return {
            "enabled": self.settings.RAG_USE_HYPE,
            "questions_per_chunk": self.settings.HYPE_QUESTIONS_PER_CHUNK
        }

    @property
    def reranker(self) -> dict:
        return {
            "enabled": self.settings.RAG_USE_RERANKING,
            "model": self.settings.RERANKER_MODEL,
            "threshold": self.settings.RERANKER_THRESHOLD
        }


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


@lru_cache()
def get_rag_config() -> RAGConfig:
    """获取RAG配置单例"""
    return RAGConfig(get_settings())


# 全局配置实例
settings = get_settings()
rag_config = get_rag_config()


# ===== Redis 连接池工厂 =====

_redis_pool: Optional[redis_lib.ConnectionPool] = None


def get_redis_pool() -> redis_lib.ConnectionPool:
    """Return shared Redis connection pool (max 20 connections)."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis_lib.ConnectionPool.from_url(
            get_settings().REDIS_URL,
            max_connections=20,
            decode_responses=True,
        )
    return _redis_pool


def get_redis() -> redis_lib.Redis:
    """Return a Redis client backed by the shared connection pool."""
    return redis_lib.Redis(connection_pool=get_redis_pool())

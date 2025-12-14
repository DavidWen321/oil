import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Service Config
    APP_NAME: str = "Pipeline AI Agent"
    DEBUG: bool = True
    
    # Milvus Config
    MILVUS_HOST: str = "localhost"
    MILVUS_PORT: str = "19530"
    COLLECTION_NAME: str = "pipeline_knowledge"
    
    # LLM Config (OpenAI Compatible)
    OPENAI_API_KEY: str = "sk-..."  # Replace with actual key or env var
    OPENAI_API_BASE: str = "https://dashscope.aliyuncs.com/compatible-mode/v1" # Example: Qwen
    MODEL_NAME: str = "qwen-turbo"
    EMBEDDING_MODEL: str = "text-embedding-v1"

    # MySQL Config
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "root"
    DB_NAME: str = "pipeline_cloud"

    class Config:
        env_file = ".env"

settings = Settings()

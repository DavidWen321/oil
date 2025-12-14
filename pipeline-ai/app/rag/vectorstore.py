from langchain.vectorstores import Milvus
from langchain.embeddings import OpenAIEmbeddings
from app.config import settings

class VectorStoreManager:
    def __init__(self):
        self.embeddings = OpenAIEmbeddings(
            openai_api_key=settings.OPENAI_API_KEY,
            openai_api_base=settings.OPENAI_API_BASE,
            model=settings.EMBEDDING_MODEL
        )
        self.connection_args = {
            "host": settings.MILVUS_HOST,
            "port": settings.MILVUS_PORT
        }

    def get_vector_store(self):
        """Get existing Milvus vector store."""
        return Milvus(
            embedding_function=self.embeddings,
            collection_name=settings.COLLECTION_NAME,
            connection_args=self.connection_args
        )

    def create_vector_store(self, documents):
        """Create and populate Milvus vector store."""
        return Milvus.from_documents(
            documents,
            self.embeddings,
            collection_name=settings.COLLECTION_NAME,
            connection_args=self.connection_args
        )

from typing import List
from app.rag.loader import DocumentProcessor
from app.rag.vectorstore import VectorStoreManager
import os

class ETLService:
    def __init__(self):
        self.processor = DocumentProcessor()
        self.vector_manager = VectorStoreManager()

    def ingest_directory(self, directory_path: str) -> dict:
        """
        提取指定目录下的文档并存入向量数据库
        """
        if not os.path.exists(directory_path):
            return {"status": "error", "message": f"Directory not found: {directory_path}"}

        # 1. 加载并切分文档
        documents = self.processor.load_and_split(directory_path)
        
        if not documents:
            return {"status": "warning", "message": "No documents found or processed."}

        # 2. 存入 Milvus
        try:
            vector_store = self.vector_manager.create_vector_store(documents)
            return {
                "status": "success", 
                "message": f"Successfully ingested {len(documents)} chunks from {directory_path}",
                "chunks_count": len(documents)
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def query_knowledge(self, query: str, top_k: int = 3) -> List[str]:
        """
        查询知识库
        """
        vector_store = self.vector_manager.get_vector_store()
        docs = vector_store.similarity_search(query, k=top_k)
        return [doc.page_content for doc in docs]

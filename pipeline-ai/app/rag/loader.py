from typing import List
from langchain.document_loaders import UnstructuredFileLoader, DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

class DocumentProcessor:
    def __init__(self, chunk_size=500, chunk_overlap=50):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

    def load_and_split(self, directory_path: str) -> List[Document]:
        """Load documents from a directory and split them into chunks."""
        loader = DirectoryLoader(directory_path, glob="**/*.docx", loader_cls=UnstructuredFileLoader)
        documents = loader.load()
        return self.text_splitter.split_documents(documents)

    def process_file(self, file_path: str) -> List[Document]:
        """Load a single file and split it."""
        loader = UnstructuredFileLoader(file_path)
        documents = loader.load()
        return self.text_splitter.split_documents(documents)

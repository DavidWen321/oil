"""
Knowledge base routes.
"""

import tempfile
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from src.rag import get_rag_pipeline
from src.utils import logger

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])

ALLOWED_EXTENSIONS = {".md", ".txt", ".pdf", ".docx"}
ALLOWED_CATEGORIES = {"standards", "formulas", "operations", "cases", "faq"}


class IndexRequest(BaseModel):
    knowledge_base_path: str = "knowledge_base"
    recreate: bool = False


class IndexResponse(BaseModel):
    success: bool
    documents_indexed: int
    message: str


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    category: Optional[str] = None


class SearchResult(BaseModel):
    doc_id: str
    doc_title: str
    content_preview: str
    score: float
    category: Optional[str]


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int


@router.post("/index", response_model=IndexResponse)
async def index_knowledge_base(request: IndexRequest):
    logger.info("Start indexing knowledge base: %s", request.knowledge_base_path)

    try:
        pipeline = get_rag_pipeline()
        count = pipeline.index_documents(
            knowledge_base_path=request.knowledge_base_path,
            recreate=request.recreate,
        )
        return IndexResponse(success=True, documents_indexed=count, message=f"成功索引 {count} 个文档")
    except Exception as exc:
        logger.error("Knowledge index failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/search", response_model=SearchResponse)
async def search_knowledge(request: SearchRequest):
    logger.info("Knowledge search: %s", request.query)

    try:
        pipeline = get_rag_pipeline()
        rag_response = pipeline.retrieve(
            query=request.query,
            top_k=request.top_k,
            category_filter=request.category,
            skip_self_rag=True,
        )

        results = [
            SearchResult(
                doc_id=src.get("doc_id", ""),
                doc_title=src.get("doc_title", ""),
                content_preview=src.get("content_preview", "")[:300],
                score=src.get("score", 0.0),
                category=src.get("category"),
            )
            for src in rag_response.sources
        ]

        return SearchResponse(query=request.query, results=results, total=len(results))
    except Exception as exc:
        logger.error("Knowledge search failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(default="faq"),
):
    original_name = Path(file.filename or "").name
    if not original_name:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    file_ext = Path(original_name).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {file_ext}")

    normalized_category = category.strip().lower()
    if normalized_category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"不支持的知识分类: {category}")

    temp_root = Path(tempfile.gettempdir()) / "pipeline-agent-knowledge" / normalized_category
    temp_root.mkdir(parents=True, exist_ok=True)
    temp_path = (temp_root / f"{uuid4().hex}_{original_name}").resolve()
    if temp_root.resolve() not in temp_path.parents:
        raise HTTPException(status_code=400, detail="非法文件路径")

    try:
        content = await file.read()
        temp_path.write_bytes(content)
        logger.info("Temporary knowledge file saved: %s", temp_path)

        pipeline = get_rag_pipeline()
        result = pipeline.add_document(str(temp_path))
        success = bool(result.get("success"))

        return {
            "success": success,
            "file_name": original_name,
            "category": normalized_category,
            "doc_id": result.get("doc_id"),
            "doc_title": result.get("doc_title"),
            "chunk_count": result.get("chunk_count", 0),
            "message": result.get("message") or ("文档已上传并索引" if success else "文档入库失败"),
        }
    except Exception as exc:
        logger.error("Knowledge upload failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        try:
            if temp_path.exists():
                temp_path.unlink()
        except OSError as cleanup_error:
            logger.warning("Failed to clean temp knowledge file %s: %s", temp_path, cleanup_error)


@router.delete("/document/{doc_id}")
async def delete_document(doc_id: str):
    try:
        pipeline = get_rag_pipeline()
        success = pipeline.delete_document(doc_id)
        return {
            "success": success,
            "doc_id": doc_id,
            "message": "文档已删除" if success else "删除失败",
        }
    except Exception as exc:
        logger.error("Delete knowledge document failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/stats")
async def get_knowledge_stats():
    try:
        pipeline = get_rag_pipeline()
        stats = pipeline.get_stats()
        return {
            "collection_name": stats.get("name", "unknown"),
            "total_chunks": stats.get("num_entities", 0),
            "exists": stats.get("exists", False),
            "sparse_ready": stats.get("sparse_ready", False),
            "sparse_chunks": stats.get("sparse_chunks", 0),
        }
    except Exception as exc:
        logger.error("Get knowledge stats failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

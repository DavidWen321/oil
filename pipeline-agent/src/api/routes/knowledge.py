"""
知识库管理路由
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from src.config import settings
from src.utils import logger
from src.rag import get_rag_pipeline

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])


class IndexRequest(BaseModel):
    """索引请求"""
    knowledge_base_path: str = "knowledge_base"
    recreate: bool = False


class IndexResponse(BaseModel):
    """索引响应"""
    success: bool
    documents_indexed: int
    message: str


class SearchRequest(BaseModel):
    """搜索请求"""
    query: str
    top_k: int = 5
    category: Optional[str] = None


class SearchResult(BaseModel):
    """搜索结果"""
    doc_id: str
    doc_title: str
    content_preview: str
    score: float
    category: Optional[str]


class SearchResponse(BaseModel):
    """搜索响应"""
    query: str
    results: List[SearchResult]
    total: int


@router.post("/index", response_model=IndexResponse)
async def index_knowledge_base(request: IndexRequest):
    """
    索引知识库

    扫描知识库目录并建立向量索引
    """
    logger.info(f"开始索引知识库: {request.knowledge_base_path}")

    try:
        pipeline = get_rag_pipeline()
        count = pipeline.index_documents(
            knowledge_base_path=request.knowledge_base_path,
            recreate=request.recreate
        )

        return IndexResponse(
            success=True,
            documents_indexed=count,
            message=f"成功索引 {count} 个文档"
        )

    except Exception as e:
        logger.error(f"索引失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search", response_model=SearchResponse)
async def search_knowledge(request: SearchRequest):
    """
    搜索知识库

    根据查询检索相关文档
    """
    logger.info(f"知识库搜索: {request.query}")

    try:
        pipeline = get_rag_pipeline()
        rag_response = pipeline.retrieve(
            query=request.query,
            top_k=request.top_k,
            category_filter=request.category,
            skip_self_rag=True
        )

        results = []
        for src in rag_response.sources:
            results.append(SearchResult(
                doc_id=src.get("doc_id", ""),
                doc_title=src.get("doc_title", ""),
                content_preview=src.get("content_preview", "")[:300],
                score=src.get("score", 0.0),
                category=src.get("category")
            ))

        return SearchResponse(
            query=request.query,
            results=results,
            total=len(results)
        )

    except Exception as e:
        logger.error(f"搜索失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(default="faq")
):
    """
    上传文档到知识库

    支持 .md, .txt, .pdf, .docx 格式
    """
    allowed_extensions = {".md", ".txt", ".pdf", ".docx"}

    # 检查文件类型
    file_ext = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {file_ext}. 支持: {allowed_extensions}"
        )

    try:
        import os
        from pathlib import Path

        # 保存文件
        save_dir = Path("knowledge_base") / category
        save_dir.mkdir(parents=True, exist_ok=True)

        file_path = save_dir / file.filename
        content = await file.read()

        with open(file_path, "wb") as f:
            f.write(content)

        logger.info(f"文档已上传: {file_path}")

        # 索引新文档
        pipeline = get_rag_pipeline()
        success = pipeline.add_document(str(file_path))

        return {
            "success": success,
            "file_name": file.filename,
            "category": category,
            "message": "文档已上传并索引" if success else "文档已上传但索引失败"
        }

    except Exception as e:
        logger.error(f"文档上传失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/document/{doc_id}")
async def delete_document(doc_id: str):
    """
    删除知识库文档

    Args:
        doc_id: 文档ID

    Returns:
        删除结果
    """
    try:
        pipeline = get_rag_pipeline()
        success = pipeline.delete_document(doc_id)

        return {
            "success": success,
            "doc_id": doc_id,
            "message": "文档已删除" if success else "删除失败"
        }

    except Exception as e:
        logger.error(f"删除文档失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_knowledge_stats():
    """
    获取知识库统计信息
    """
    try:
        pipeline = get_rag_pipeline()
        stats = pipeline.get_stats()

        return {
            "collection_name": stats.get("name", "unknown"),
            "total_chunks": stats.get("num_entities", 0),
            "exists": stats.get("exists", False)
        }

    except Exception as e:
        logger.error(f"获取统计失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

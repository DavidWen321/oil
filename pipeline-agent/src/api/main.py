"""
FastAPI 主应用
Pipeline Agent API 服务
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.utils import logger

from .middleware.logging import LoggingMiddleware
from .middleware.auth import AuthMiddleware
from .routes import health, chat, knowledge, trace, report, graph_query


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理

    启动时初始化资源，关闭时清理
    """
    # 启动时
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Debug mode: {settings.DEBUG}")

    # 初始化工作流
    try:
        from src.workflows import get_workflow
        workflow = get_workflow()
        logger.info("Agent workflow initialized")
    except Exception as e:
        logger.warning(f"Workflow initialization failed: {e}")

    # 初始化知识库索引（增量）
    try:
        from src.rag.pipeline import get_rag_pipeline

        rag = get_rag_pipeline()
        count = rag.index_documents(knowledge_base_path="knowledge_base", recreate=False)
        logger.info(f"知识库索引完成，共 {count} 个文档")
    except Exception as e:
        logger.warning(f"知识库索引失败（非致命）: {e}")

    # 初始化知识图谱并同步数据库
    try:
        from src.knowledge_graph import get_knowledge_graph_builder

        kg = get_knowledge_graph_builder()
        logger.info(
            f"Knowledge graph initialized: nodes={kg.graph.number_of_nodes()}, edges={kg.graph.number_of_edges()}"
        )
    except Exception as e:
        logger.warning(f"Knowledge graph initialization failed: {e}")

    yield

    # 关闭时
    logger.info("Shutting down...")

    # 清理资源
    try:
        from src.rag import get_vector_store
        vs = get_vector_store()
        vs.close()
    except Exception as e:
        logger.warning(f"Cleanup error: {e}")


def create_app() -> FastAPI:
    """
    创建FastAPI应用

    Returns:
        配置好的FastAPI实例
    """
    app = FastAPI(
        title=settings.APP_NAME,
        description="管道能耗智能体系统 API",
        version=settings.APP_VERSION,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan
    )

    # 配置CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 生产环境应该限制
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
    )

    # 添加中间件
    app.add_middleware(LoggingMiddleware)

    # 生产环境添加认证中间件
    if not settings.DEBUG:
        app.add_middleware(AuthMiddleware)

    # 注册路由
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")
    app.include_router(knowledge.router, prefix="/api/v1")
    app.include_router(trace.router, prefix="/api/v1")
    app.include_router(report.router, prefix="/api/v1")
    app.include_router(graph_query.router, prefix="/api/v1")

    # 根路由
    @app.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running",
            "docs": "/docs" if settings.DEBUG else "disabled"
        }

    return app


# 创建应用实例
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.API_WORKERS
    )

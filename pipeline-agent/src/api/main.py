"""FastAPI 主应用。"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.utils import logger

from .middleware.auth import AuthMiddleware
from .middleware.logging import LoggingMiddleware
from .routes import chat, chat_v2, evaluation, graph_query, health, knowledge, mcp_v2, report, scheme, trace


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Debug mode: {settings.DEBUG}")

    try:
        from src.workflows import get_workflow

        get_workflow()
        logger.info("Agent workflow initialized")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Workflow initialization failed: {exc}")

    try:
        from src.rag.pipeline import get_rag_pipeline

        rag = get_rag_pipeline()
        count = rag.index_documents(knowledge_base_path="knowledge_base", recreate=False)
        logger.info(f"知识库索引完成，共 {count} 个文档")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"知识库索引失败（非致命）: {exc}")

    try:
        from src.knowledge_graph import get_knowledge_graph_builder

        kg = get_knowledge_graph_builder()
        logger.info(
            f"Knowledge graph initialized: nodes={kg.graph.number_of_nodes()}, edges={kg.graph.number_of_edges()}"
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Knowledge graph initialization failed: {exc}")

    try:
        from src.mcp import CalculationMCPServer, DatabaseMCPServer, KnowledgeMCPServer, get_mcp_hub
        from src.tool_search import sync_tool_registry_from_mcp

        mcp_hub = get_mcp_hub()
        server_factories = [
            ("database-mcp", DatabaseMCPServer),
            ("calculation-mcp", CalculationMCPServer),
            ("knowledge-mcp", KnowledgeMCPServer),
        ]
        total_tools = 0
        for server_name, factory in server_factories:
            if not mcp_hub.has_server(server_name):
                await mcp_hub.register(server_name, factory())
            tool_defs = await mcp_hub.list_tools(server_name)
            sync_tool_registry_from_mcp(server_name, tool_defs)
            total_tools += len(tool_defs)
            logger.info(f"MCP server ready: {server_name}, tools={len(tool_defs)}")

        logger.info(f"MCP hub initialized: servers={mcp_hub.server_names()}, total_tools={total_tools}")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"MCP hub initialization failed (non-fatal): {exc}")

    yield

    logger.info("Shutting down...")
    try:
        from src.rag import get_vector_store

        vs = get_vector_store()
        vs.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Cleanup error: {exc}")



def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description="管道能耗智能体系统 API",
        version=settings.APP_VERSION,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    cors_origins = settings.cors_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=(cors_origins != ["*"]),
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    app.add_middleware(LoggingMiddleware)
    if settings.AUTH_REQUIRED_IN_PRODUCTION:
        app.add_middleware(AuthMiddleware)

    app.include_router(health.router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")
    app.include_router(knowledge.router, prefix="/api/v1")
    app.include_router(trace.router, prefix="/api/v1")
    app.include_router(report.router, prefix="/api/v1")
    app.include_router(graph_query.router, prefix="/api/v1")
    app.include_router(evaluation.router, prefix="/api/v1")
    app.include_router(scheme.router, prefix="/api/v1")
    app.include_router(chat_v2.router, prefix="/api/v2")
    app.include_router(mcp_v2.router, prefix="/api/v2")

    @app.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running",
            "docs": "/docs" if settings.DEBUG else "disabled",
            "recommended_chat_api": "/api/v2/chat/stream",
        }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.API_WORKERS,
    )

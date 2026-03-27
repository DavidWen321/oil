<<<<<<< Updated upstream
"""
FastAPI 主应用
Pipeline Agent API 服务
"""
=======
"""FastAPI application entrypoint."""

from __future__ import annotations
>>>>>>> Stashed changes

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.utils import logger

from .middleware.logging import LoggingMiddleware
from .middleware.auth import AuthMiddleware
from .routes import health, chat, chat_v2, mcp_v2, knowledge, trace, report, graph_query


@asynccontextmanager
async def lifespan(app: FastAPI):
<<<<<<< Updated upstream
    """
    应用生命周期管理

    启动时初始化资源，关闭时清理
    """
    # 启动时
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Debug mode: {settings.DEBUG}")
=======
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    logger.info("Debug mode: %s", settings.DEBUG)
>>>>>>> Stashed changes

    # 初始化工作流
    try:
        from src.workflows import get_workflow
        workflow = get_workflow()
        logger.info("Agent workflow initialized")
<<<<<<< Updated upstream
    except Exception as e:
        logger.warning(f"Workflow initialization failed: {e}")
=======
    except Exception as exc:  # noqa: BLE001
        logger.warning("Workflow initialization failed: %s", exc)
>>>>>>> Stashed changes

    # 初始化知识库索引（增量）
    try:
        from src.rag.pipeline import get_rag_pipeline

        rag = get_rag_pipeline()
<<<<<<< Updated upstream
        count = rag.index_documents(knowledge_base_path="knowledge_base", recreate=False)
        logger.info(f"知识库索引完成，共 {count} 个文档")
    except Exception as e:
        logger.warning(f"知识库索引失败（非致命）: {e}")
=======
        stats = rag.get_stats()
        if not stats.get("exists") or stats.get("num_entities", 0) == 0:
            count = rag.index_documents(knowledge_base_path="knowledge_base", recreate=False)
            logger.info("Knowledge base startup index finished, documents=%s", count)
        else:
            sparse_chunks = rag.ensure_retriever_ready()
            logger.info(
                "Knowledge base collection already exists, skip startup re-index: entities=%s, sparse_chunks=%s",
                stats.get("num_entities", 0),
                sparse_chunks,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Knowledge base initialization failed (non-fatal): %s", exc)
>>>>>>> Stashed changes

    # 初始化知识图谱并同步数据库
    try:
        from src.knowledge_graph import get_knowledge_graph_builder

        kg = get_knowledge_graph_builder()
        logger.info(
            "Knowledge graph initialized: nodes=%s, edges=%s",
            kg.graph.number_of_nodes(),
            kg.graph.number_of_edges(),
        )
<<<<<<< Updated upstream
    except Exception as e:
        logger.warning(f"Knowledge graph initialization failed: {e}")
=======
    except Exception as exc:  # noqa: BLE001
        logger.warning("Knowledge graph initialization failed: %s", exc)
>>>>>>> Stashed changes

    # 初始化 MCP Hub（增量接入，不阻断主流程）
    try:
        from src.mcp import (
            CalculationMCPServer,
            DatabaseMCPServer,
            KnowledgeMCPServer,
            get_mcp_hub,
        )
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
            logger.info("MCP server ready: %s, tools=%s", server_name, len(tool_defs))

<<<<<<< Updated upstream
        logger.info(f"MCP hub initialized: servers={mcp_hub.server_names()}, total_tools={total_tools}")
    except Exception as e:
        logger.warning(f"MCP hub initialization failed (non-fatal): {e}")
=======
        logger.info("MCP hub initialized: servers=%s, total_tools=%s", mcp_hub.server_names(), total_tools)
    except Exception as exc:  # noqa: BLE001
        logger.warning("MCP hub initialization failed (non-fatal): %s", exc)
>>>>>>> Stashed changes

    yield

    # 关闭时
    logger.info("Shutting down...")

    # 清理资源
    try:
        from src.rag import get_vector_store
        vs = get_vector_store()
        vs.close()
<<<<<<< Updated upstream
    except Exception as e:
        logger.warning(f"Cleanup error: {e}")
=======
    except Exception as exc:  # noqa: BLE001
        logger.warning("Cleanup error: %s", exc)
>>>>>>> Stashed changes


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
    app.include_router(chat_v2.router, prefix="/api/v2")
    app.include_router(mcp_v2.router, prefix="/api/v2")

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

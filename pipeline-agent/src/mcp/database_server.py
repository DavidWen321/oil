"""Database MCP server skeleton."""

from __future__ import annotations

from pathlib import Path
import time
from typing import Any, Dict, List

from src.tools.agent_tools import query_database
from src.utils import logger

from .base import MCPServer
from .types import MCPResourceDefinition, MCPToolCallResult, MCPToolDefinition


class DatabaseMCPServer(MCPServer):
    """Expose database querying as MCP-compatible tool/resource."""

    SCHEMA_URI = "schema://pipeline_cloud"

    def __init__(self):
        self._tools = [
            MCPToolDefinition(
                name="query_database",
                description="查询管道能耗系统数据库，返回结构化数据或文本摘要。",
                input_schema={
                    "type": "object",
                    "properties": {
                        "question": {"type": "string", "description": "自然语言查询问题"},
                        "max_rows": {"type": "integer", "default": 100},
                    },
                    "required": ["question"],
                },
                input_examples=[
                    {"question": "查询项目A的所有管道直径", "max_rows": 50},
                    {"question": "统计各泵站的平均效率"},
                ],
                category="data",
                keywords=["数据库", "查询", "项目", "管道", "泵站", "油品", "SQL"],
            )
        ]
        self._resources = [
            MCPResourceDefinition(
                uri=self.SCHEMA_URI,
                name="pipeline_cloud_schema",
                description="管道能耗系统数据库 schema 信息",
                mime_type="text/sql",
            )
        ]
        self._schema_cache = self._load_schema_file()

    def _load_schema_file(self) -> str:
        candidates = [
            Path(__file__).resolve().parents[3] / "pipeline-energy-cloud/sql/schema.sql",
            Path(__file__).resolve().parents[2] / "knowledge_base/standards/pipeline_standards.md",
        ]
        for path in candidates:
            if path.exists():
                try:
                    text = path.read_text(encoding="utf-8")
                    if text.strip():
                        return text
                except Exception as exc:
                    logger.warning("Failed to read MCP schema candidate {}: {}", path, exc)
        return "-- schema unavailable"

    async def list_tools(self) -> List[MCPToolDefinition]:
        return list(self._tools)

    async def call_tool(self, tool_name: str, args: Dict[str, Any]) -> MCPToolCallResult:
        started = time.perf_counter()
        if tool_name != "query_database":
            return MCPToolCallResult(
                ok=False,
                content=None,
                error=f"unsupported tool: {tool_name}",
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )

        question = str(args.get("question", "")).strip()
        if not question:
            return MCPToolCallResult(
                ok=False,
                content=None,
                error="question is required",
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )

        _ = int(args.get("max_rows", 100) or 100)
        try:
            result = query_database.invoke({"question": question})
            return MCPToolCallResult(ok=True, content=result, duration_ms=round((time.perf_counter() - started) * 1000, 2))
        except Exception as exc:
            logger.error("MCP query_database failed: {}", exc)
            return MCPToolCallResult(
                ok=False,
                content=None,
                error=str(exc),
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )

    async def list_resources(self) -> List[MCPResourceDefinition]:
        return list(self._resources)

    async def read_resource(self, uri: str) -> str:
        if uri != self.SCHEMA_URI:
            raise ValueError(f"unknown resource uri: {uri}")
        return self._schema_cache

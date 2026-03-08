"""Knowledge MCP server skeleton."""

from __future__ import annotations

from pathlib import Path
import time
from typing import Any, Dict, List

from src.tools.agent_tools import (
    query_equipment_chain,
    query_fault_cause,
    query_standards,
    search_knowledge_base,
)
from src.utils import logger

from .base import MCPServer
from .types import MCPResourceDefinition, MCPToolCallResult, MCPToolDefinition


class KnowledgeMCPServer(MCPServer):
    """Expose knowledge retrieval and graph reasoning tools via MCP."""

    def __init__(self):
        self._tools = [
            MCPToolDefinition(
                name="search_knowledge_base",
                description="检索管道工程知识库中的规范、标准、原理和公式。",
                input_schema={
                    "type": "object",
                    "properties": {
                        "question": {"type": "string", "description": "知识检索问题"},
                    },
                    "required": ["question"],
                },
                input_examples=[
                    {"question": "达西摩阻系数在不同流态下怎么选取"},
                    {"question": "输油管道压降计算有哪些规范依据"},
                ],
                category="knowledge",
                keywords=["知识库", "规范", "标准", "公式", "原理", "检索"],
            ),
            MCPToolDefinition(
                name="query_fault_cause",
                description="基于知识图谱进行故障因果链与根因分析。",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "故障诊断问题"},
                    },
                    "required": ["query"],
                },
                input_examples=[
                    {"query": "泵站出口压力波动的可能根因"},
                    {"query": "流量异常下降可能涉及哪些设备故障"},
                ],
                category="graph",
                keywords=["故障", "根因", "因果链", "知识图谱", "诊断"],
            ),
            MCPToolDefinition(
                name="query_standards",
                description="查询标准规范、条款和合规要求。",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "标准规范查询问题"},
                    },
                    "required": ["query"],
                },
                input_examples=[
                    {"query": "输油管道设计压力的标准条款"},
                    {"query": "泵站日常巡检的规范要求"},
                ],
                category="knowledge",
                keywords=["标准", "规范", "条款", "合规", "GB", "SY/T"],
            ),
            MCPToolDefinition(
                name="query_equipment_chain",
                description="查询设备上下游关联链路和依赖关系。",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "设备链路查询问题"},
                    },
                    "required": ["query"],
                },
                input_examples=[
                    {"query": "泵站A的上下游设备链路"},
                    {"query": "阀门V-21与哪些关键设备关联"},
                ],
                category="graph",
                keywords=["设备", "链路", "上下游", "依赖", "拓扑", "知识图谱"],
            ),
        ]
        self._resource_map = self._load_resources()
        self._resources = [
            MCPResourceDefinition(
                uri=uri,
                name=meta["name"],
                description=meta["description"],
                mime_type=meta["mime_type"],
            )
            for uri, meta in self._resource_map.items()
        ]

    def _load_resources(self) -> Dict[str, Dict[str, str]]:
        base = Path(__file__).resolve().parents[2] / "knowledge_base"
        resource_defs = [
            (
                "knowledge://standards/pipeline",
                "pipeline_standards",
                "管道设计与运行标准",
                "text/markdown",
                base / "standards/pipeline_standards.md",
            ),
            (
                "knowledge://operations/pump_optimization",
                "pump_optimization_ops",
                "泵站优化运行知识",
                "text/markdown",
                base / "operations/pump_optimization.md",
            ),
            (
                "knowledge://formulas/hydraulic",
                "hydraulic_formulas",
                "水力计算公式",
                "text/markdown",
                base / "formulas/hydraulic_formulas.md",
            ),
        ]

        loaded: Dict[str, Dict[str, str]] = {}
        for uri, name, description, mime_type, path in resource_defs:
            content = "-- resource unavailable"
            if path.exists():
                try:
                    content = path.read_text(encoding="utf-8")
                except Exception as exc:
                    logger.warning("Failed to read knowledge MCP resource {}: {}", path, exc)
            loaded[uri] = {
                "name": name,
                "description": description,
                "mime_type": mime_type,
                "content": content,
            }
        return loaded

    async def list_tools(self) -> List[MCPToolDefinition]:
        return list(self._tools)

    async def call_tool(self, tool_name: str, args: Dict[str, Any]) -> MCPToolCallResult:
        started = time.perf_counter()
        query_text = str(args.get("question") or args.get("query") or "").strip()
        if not query_text:
            return MCPToolCallResult(
                ok=False,
                content=None,
                error="question/query is required",
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )

        try:
            if tool_name == "search_knowledge_base":
                result = search_knowledge_base.invoke({"question": query_text})
                return MCPToolCallResult(ok=True, content=result, duration_ms=round((time.perf_counter() - started) * 1000, 2))
            if tool_name == "query_fault_cause":
                result = query_fault_cause.invoke({"query": query_text})
                return MCPToolCallResult(ok=True, content=result, duration_ms=round((time.perf_counter() - started) * 1000, 2))
            if tool_name == "query_standards":
                result = query_standards.invoke({"query": query_text})
                return MCPToolCallResult(ok=True, content=result, duration_ms=round((time.perf_counter() - started) * 1000, 2))
            if tool_name == "query_equipment_chain":
                result = query_equipment_chain.invoke({"query": query_text})
                return MCPToolCallResult(ok=True, content=result, duration_ms=round((time.perf_counter() - started) * 1000, 2))
            return MCPToolCallResult(
                ok=False,
                content=None,
                error=f"unsupported tool: {tool_name}",
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )
        except Exception as exc:
            logger.error("MCP {} failed: {}", tool_name, exc)
            return MCPToolCallResult(
                ok=False,
                content=None,
                error=str(exc),
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )

    async def list_resources(self) -> List[MCPResourceDefinition]:
        return list(self._resources)

    async def read_resource(self, uri: str) -> str:
        meta = self._resource_map.get(uri)
        if meta is None:
            raise ValueError(f"unknown resource uri: {uri}")
        return meta["content"]

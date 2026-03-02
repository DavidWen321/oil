"""Calculation MCP server skeleton."""

from __future__ import annotations

from typing import Any, Dict, List

from src.tools.agent_tools import hydraulic_calculation, run_sensitivity_analysis
from src.utils import logger

from .base import MCPServer
from .types import MCPResourceDefinition, MCPToolCallResult, MCPToolDefinition


class CalculationMCPServer(MCPServer):
    """Expose calculation capabilities as MCP tools."""

    def __init__(self):
        self._tools = [
            MCPToolDefinition(
                name="hydraulic_calculation",
                description="执行管道水力计算，包括雷诺数、摩阻、压降、泵扬程等分析。",
                input_schema={
                    "type": "object",
                    "properties": {
                        "question": {"type": "string", "description": "自然语言计算需求"},
                    },
                    "required": ["question"],
                },
                input_examples=[
                    {"question": "计算流量1000m3/h时的雷诺数和沿程压降"},
                    {"question": "比较两种泵组合下的出口压力变化"},
                ],
            ),
            MCPToolDefinition(
                name="run_sensitivity_analysis",
                description="执行参数敏感性分析，评估变量变化对水力结果的影响。",
                input_schema={
                    "type": "object",
                    "properties": {
                        "question": {"type": "string", "description": "自然语言敏感性分析需求"},
                    },
                    "required": ["question"],
                },
                input_examples=[
                    {"question": "分析流量变化对摩阻损失的敏感性"},
                    {"question": "比较密度与粘度变化对压降影响"},
                ],
            ),
        ]

    async def list_tools(self) -> List[MCPToolDefinition]:
        return list(self._tools)

    async def call_tool(self, tool_name: str, args: Dict[str, Any]) -> MCPToolCallResult:
        question = str(args.get("question", "")).strip()
        if not question:
            return MCPToolCallResult(ok=False, content=None, error="question is required")

        try:
            if tool_name == "hydraulic_calculation":
                result = hydraulic_calculation.invoke({"question": question})
                return MCPToolCallResult(ok=True, content=result)
            if tool_name == "run_sensitivity_analysis":
                result = run_sensitivity_analysis.invoke({"question": question})
                return MCPToolCallResult(ok=True, content=result)
            return MCPToolCallResult(ok=False, content=None, error=f"unsupported tool: {tool_name}")
        except Exception as exc:
            logger.error("MCP {} failed: {}", tool_name, exc)
            return MCPToolCallResult(ok=False, content=None, error=str(exc))

    async def list_resources(self) -> List[MCPResourceDefinition]:
        return []

    async def read_resource(self, uri: str) -> str:
        raise ValueError(f"unknown resource uri: {uri}")


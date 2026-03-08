"""In-process MCP hub for server registration and tool dispatch."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from src.utils import logger

from .base import MCPServer
from .types import MCPResourceDefinition, MCPToolCallResult, MCPToolDefinition


class MCPHub:
    """Lightweight MCP hub used for incremental migration."""

    def __init__(self):
        self._servers: Dict[str, MCPServer] = {}
        self._tool_index: Dict[str, Tuple[str, MCPToolDefinition]] = {}
        self._server_tools: Dict[str, List[MCPToolDefinition]] = {}

    @staticmethod
    def _normalize_keywords(tool: MCPToolDefinition, server_name: str) -> List[str]:
        raw_keywords = list(tool.keywords or [])
        if not raw_keywords:
            raw_keywords = [tool.name, server_name, tool.category or "mcp"]

        normalized: List[str] = []
        seen = set()
        for keyword in raw_keywords:
            value = str(keyword or "").strip()
            if not value:
                continue
            lowered = value.lower()
            if lowered in seen:
                continue
            normalized.append(value)
            seen.add(lowered)
        return normalized

    async def register(self, name: str, server: MCPServer) -> None:
        self._servers[name] = server
        self._tool_index = {tool_name: item for tool_name, item in self._tool_index.items() if item[0] != name}

        tools = await server.list_tools()
        normalized_tools: List[MCPToolDefinition] = []
        for tool in tools:
            if not str(tool.description or "").strip():
                raise ValueError(f"工具 {tool.name} 缺少 description")
            if not isinstance(tool.input_schema, dict) or not tool.input_schema:
                raise ValueError(f"工具 {tool.name} 缺少 input_schema 定义")

            normalized_tool = MCPToolDefinition(
                name=tool.name,
                description=tool.description,
                input_schema=tool.input_schema,
                input_examples=list(tool.input_examples or []),
                server_name=name,
                category=str(tool.category or name.replace("-mcp", "") or "mcp"),
                keywords=self._normalize_keywords(tool, name),
            )
            normalized_tools.append(normalized_tool)
            self._tool_index[normalized_tool.name] = (name, normalized_tool)

        self._server_tools[name] = normalized_tools
        logger.info("MCP server registered: {} (tools={})", name, len(normalized_tools))

    def has_server(self, name: str) -> bool:
        return name in self._servers

    def server_names(self) -> List[str]:
        return list(self._servers.keys())

    def resolve_tool(self, tool_name: str) -> Tuple[str, MCPToolDefinition] | None:
        return self._tool_index.get(str(tool_name or "").strip())

    def list_tool_index(self) -> Dict[str, Dict[str, Any]]:
        return {
            tool_name: {
                "server_name": server_name,
                "category": tool.category,
                "keywords": list(tool.keywords),
                "description": tool.description,
            }
            for tool_name, (server_name, tool) in self._tool_index.items()
        }

    async def list_tools(self, server_name: str | None = None) -> List[MCPToolDefinition]:
        if server_name:
            if server_name not in self._servers:
                return []
            return list(self._server_tools.get(server_name, []))

        merged: List[MCPToolDefinition] = []
        for name in self._servers:
            merged.extend(self._server_tools.get(name, []))
        return merged

    async def list_resources(self, server_name: str | None = None) -> List[MCPResourceDefinition]:
        if server_name:
            server = self._servers.get(server_name)
            if server is None:
                return []
            return await server.list_resources()

        merged: List[MCPResourceDefinition] = []
        for server in self._servers.values():
            merged.extend(await server.list_resources())
        return merged

    async def call_tool(self, server_name: str, tool_name: str, args: Dict[str, Any]) -> MCPToolCallResult:
        server = self._servers.get(server_name)
        if server is None:
            return MCPToolCallResult(ok=False, content=None, error=f"server not found: {server_name}")
        return await server.call_tool(tool_name, args)

    async def call_tool_auto(self, tool_name: str, args: Dict[str, Any]) -> MCPToolCallResult:
        resolved = self.resolve_tool(tool_name)
        if resolved is None:
            return MCPToolCallResult(ok=False, content=None, error=f"tool not found: {tool_name}")
        server_name, _ = resolved
        return await self.call_tool(server_name, tool_name, args)

    async def read_resource(self, server_name: str, uri: str) -> str:
        server = self._servers.get(server_name)
        if server is None:
            raise ValueError(f"server not found: {server_name}")
        return await server.read_resource(uri)


_mcp_hub: MCPHub | None = None


def get_mcp_hub() -> MCPHub:
    global _mcp_hub
    if _mcp_hub is None:
        _mcp_hub = MCPHub()
    return _mcp_hub

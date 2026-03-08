"""MCP diagnostic and invocation endpoints for v2 API."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from src.config import settings
from src.mcp import get_mcp_hub

router = APIRouter(prefix="/mcp", tags=["mcp-v2"])


def _ensure_mcp_authorized(request: Request) -> None:
    if not settings.AUTH_REQUIRED_IN_PRODUCTION:
        return
    if getattr(request.state, "is_trusted_gateway", False):
        return
    user_id = str(getattr(request.state, "user_id", "anonymous") or "anonymous")
    if user_id != "anonymous":
        return
    raise HTTPException(status_code=401, detail="unauthorized mcp tool invocation")


class MCPToolCallRequest(BaseModel):
    server: Optional[str] = Field(default=None, description="Optional MCP server name; auto-resolved when omitted")
    tool: str = Field(..., description="MCP tool name")
    args: Dict[str, Any] = Field(default_factory=dict, description="Tool input args")


@router.get("/servers")
async def list_mcp_servers():
    hub = get_mcp_hub()
    servers = []
    for name in hub.server_names():
        tools = await hub.list_tools(name)
        resources = await hub.list_resources(name)
        servers.append(
            {
                "name": name,
                "tool_count": len(tools),
                "resource_count": len(resources),
                "tools": [tool.name for tool in tools],
            }
        )
    return {"servers": servers, "count": len(servers)}


@router.get("/tools")
async def list_mcp_tools(server: Optional[str] = Query(default=None)):
    hub = get_mcp_hub()
    if server and not hub.has_server(server):
        raise HTTPException(status_code=404, detail=f"server not found: {server}")

    tools = await hub.list_tools(server)
    return {
        "server": server,
        "tools": [asdict(tool) for tool in tools],
        "count": len(tools),
    }


@router.get("/tools/index")
async def list_mcp_tool_index():
    hub = get_mcp_hub()
    index = hub.list_tool_index()
    return {"items": index, "count": len(index)}


@router.get("/tools/{tool_name}")
async def get_mcp_tool(tool_name: str):
    hub = get_mcp_hub()
    resolved = hub.resolve_tool(tool_name)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"tool not found: {tool_name}")

    server_name, tool = resolved
    return {"server": server_name, "tool": asdict(tool)}


@router.post("/call")
async def call_mcp_tool(request: MCPToolCallRequest, http_request: Request):
    _ensure_mcp_authorized(http_request)
    hub = get_mcp_hub()
    if request.server:
        if not hub.has_server(request.server):
            raise HTTPException(status_code=404, detail=f"server not found: {request.server}")
        result = await hub.call_tool(request.server, request.tool, request.args)
        resolved_server = request.server
    else:
        resolved = hub.resolve_tool(request.tool)
        if resolved is None:
            raise HTTPException(status_code=404, detail=f"tool not found: {request.tool}")
        resolved_server, _ = resolved
        result = await hub.call_tool_auto(request.tool, request.args)

    payload = asdict(result)
    payload["server"] = resolved_server
    payload["tool"] = request.tool
    if not result.ok:
        raise HTTPException(status_code=400, detail=payload)
    return payload


@router.get("/resources")
async def list_mcp_resources(server: Optional[str] = Query(default=None)):
    hub = get_mcp_hub()
    if server and not hub.has_server(server):
        raise HTTPException(status_code=404, detail=f"server not found: {server}")

    resources = await hub.list_resources(server)
    return {
        "server": server,
        "resources": [asdict(resource) for resource in resources],
        "count": len(resources),
    }


@router.get("/resource")
async def read_mcp_resource(
    server: str = Query(..., description="MCP server name"),
    uri: str = Query(..., description="resource URI"),
    max_len: int = Query(default=20000, ge=0, le=200000),
):
    hub = get_mcp_hub()
    if not hub.has_server(server):
        raise HTTPException(status_code=404, detail=f"server not found: {server}")

    try:
        content = await hub.read_resource(server, uri)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    full_length = len(content)
    truncated = False
    if max_len > 0 and full_length > max_len:
        content = content[:max_len]
        truncated = True

    return {
        "server": server,
        "uri": uri,
        "content": content,
        "truncated": truncated,
        "content_length": len(content),
        "full_length": full_length,
    }

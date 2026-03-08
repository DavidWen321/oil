"""Core MCP data structures aligned with the current local MCP hub contract."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class MCPToolParameter:
    """Tool parameter metadata."""

    name: str
    type: str
    description: str
    required: bool = True
    enum: Optional[List[str]] = None
    default: Any = None


@dataclass(frozen=True)
class MCPToolDefinition:
    """Metadata for a callable MCP tool."""

    name: str
    description: str
    input_schema: Dict[str, Any] = field(default_factory=dict)
    input_examples: List[Dict[str, Any]] = field(default_factory=list)
    server_name: str = ""
    category: str = ""
    keywords: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class MCPResourceDefinition:
    """Metadata for an MCP resource endpoint."""

    uri: str
    name: str = ""
    description: str = ""
    mime_type: str = "text/plain"


@dataclass(frozen=True)
class MCPToolCallResult:
    """Standard MCP tool call result wrapper."""

    ok: bool
    content: Any = None
    error: Optional[str] = None
    duration_ms: float = 0.0
    token_usage: Optional[Dict[str, Any]] = None

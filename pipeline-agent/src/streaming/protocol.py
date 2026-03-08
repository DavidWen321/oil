"""Unified streaming event protocol for v2 chat endpoints."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict

from pydantic import BaseModel


class StreamEventType(str, Enum):
    """Unified event names for multi-channel streaming."""

    TRACE_INIT = "trace_init"
    DONE = "done"
    ERROR = "error"

    THINKING_DELTA = "thinking_delta"
    THINKING_DONE = "thinking_done"

    CONTENT_DELTA = "content_delta"
    CONTENT_DONE = "content_done"

    TOOL_SEARCH = "tool_search"
    TOOL_USE_START = "tool_use_start"
    TOOL_USE_DELTA = "tool_use_delta"
    TOOL_RESULT = "tool_result"
    TOOL_USE_RESULT = "tool_use_result"
    TOOL_USE_DONE = "tool_use_done"

    PLAN_CREATED = "plan_created"
    PLAN_STEP_START = "plan_step_start"
    PLAN_STEP_DONE = "plan_step_done"
    PLAN_UPDATED = "plan_updated"

    ARTIFACT_CREATE = "artifact_create"
    ARTIFACT_DELTA = "artifact_delta"
    ARTIFACT_DONE = "artifact_done"

    HITL_REQUEST = "hitl_request"
    HITL_RESUMED = "hitl_resumed"
    STATE_SYNC = "state_sync"


class StreamEvent(BaseModel):
    """Canonical stream event payload."""

    event: StreamEventType
    data: Dict[str, Any]
    timestamp: float
    sequence: int
    trace_id: str

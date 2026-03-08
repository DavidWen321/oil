"""Tool-call guardrails for session-level throttling."""

from __future__ import annotations

from collections import defaultdict
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from typing import DefaultDict, Optional

from src.config import settings


_CURRENT_SESSION_ID: ContextVar[Optional[str]] = ContextVar("tool_guard_session_id", default=None)


@dataclass
class ToolCallLimiter:
    """Per-session tool call limiter."""

    max_calls_per_session: int = settings.TOOL_MAX_CALLS_PER_SESSION
    max_calls_per_tool: int = settings.TOOL_MAX_CALLS_PER_TOOL
    _session_counts: DefaultDict[str, int] = field(default_factory=lambda: defaultdict(int))
    _tool_counts: DefaultDict[str, DefaultDict[str, int]] = field(
        default_factory=lambda: defaultdict(lambda: defaultdict(int))
    )

    def check(self, session_id: str, tool_name: str) -> tuple[bool, str]:
        sid = str(session_id or "anonymous")
        name = str(tool_name or "unknown")
        self._session_counts[sid] += 1
        self._tool_counts[sid][name] += 1

        if self._session_counts[sid] > self.max_calls_per_session:
            return False, f"会话工具调用次数超限（最大 {self.max_calls_per_session} 次）"
        if self._tool_counts[sid][name] > self.max_calls_per_tool:
            return False, f"工具 {name} 调用次数超限（最大 {self.max_calls_per_tool} 次）"
        return True, ""

    def reset(self, session_id: str) -> None:
        sid = str(session_id or "anonymous")
        self._session_counts.pop(sid, None)
        self._tool_counts.pop(sid, None)


def set_session_context(session_id: str) -> Token:
    return _CURRENT_SESSION_ID.set(str(session_id or ""))


def reset_session_context(token: Token) -> None:
    _CURRENT_SESSION_ID.reset(token)


def get_current_session_id() -> Optional[str]:
    return _CURRENT_SESSION_ID.get()


tool_call_limiter = ToolCallLimiter()

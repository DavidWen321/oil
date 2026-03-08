"""Query-level cache for tool search results."""

from __future__ import annotations

import time
from typing import Any, Dict, Optional


class ToolSearchCache:
    """Tiny in-memory TTL cache for tool search."""

    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = ttl_seconds
        self._items: Dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        item = self._items.get(key)
        if item is None:
            return None
        expires_at, value = item
        if expires_at < time.time():
            self._items.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._items[key] = (time.time() + self.ttl_seconds, value)

    def clear(self) -> None:
        self._items.clear()


_tool_search_cache: ToolSearchCache | None = None


def get_tool_search_cache() -> ToolSearchCache:
    global _tool_search_cache
    if _tool_search_cache is None:
        _tool_search_cache = ToolSearchCache()
    return _tool_search_cache

"""Workflow checkpointer factory."""

from __future__ import annotations

from typing import Any

from langgraph.checkpoint.memory import MemorySaver

from src.config import settings
from src.utils import logger


def create_checkpointer() -> Any:
    """Create a workflow checkpointer based on settings."""

    backend = str(settings.CHECKPOINT_BACKEND).strip().lower()

    if backend == "redis":
        try:
            from langgraph.checkpoint.redis import RedisSaver
        except Exception as exc:
            raise RuntimeError(f"Redis checkpointer 不可用，请确认已安装 langgraph[redis]: {exc}") from exc

        if hasattr(RedisSaver, "from_conn_string"):
            return RedisSaver.from_conn_string(settings.CHECKPOINT_REDIS_URL)
        return RedisSaver(settings.CHECKPOINT_REDIS_URL)

    if backend == "memory":
        return MemorySaver()

    raise RuntimeError(f"Unsupported CHECKPOINT_BACKEND={settings.CHECKPOINT_BACKEND}")

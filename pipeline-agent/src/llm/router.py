"""LLM model router with lightweight token usage tracking."""

from __future__ import annotations

from enum import Enum
import threading
from typing import Dict, Optional

from langchain_core.callbacks import BaseCallbackHandler
from langchain_openai import ChatOpenAI

from src.config import get_settings


class TaskTier(str, Enum):
    LIGHT = "light"
    MEDIUM = "medium"
    HEAVY = "heavy"


TASK_TIER_MAP = {
    "intent_classification": TaskTier.LIGHT,
    "query_rewrite": TaskTier.LIGHT,
    "message_summary": TaskTier.LIGHT,
    "tool_result_format": TaskTier.LIGHT,
    "chat_response": TaskTier.LIGHT,
    "should_retrieve": TaskTier.LIGHT,
    "data_analysis": TaskTier.MEDIUM,
    "knowledge_qa": TaskTier.MEDIUM,
    "report_section": TaskTier.MEDIUM,
    "context_generation": TaskTier.MEDIUM,
    "synthesis": TaskTier.MEDIUM,
    "plan_creation": TaskTier.HEAVY,
    "reflexion": TaskTier.HEAVY,
    "fault_diagnosis": TaskTier.HEAVY,
    "react_reasoning": TaskTier.HEAVY,
    "scheme_comparison": TaskTier.HEAVY,
}


class TokenUsageTracker(BaseCallbackHandler):
    """Track token usage and approximate cost across routed models."""

    PRICING = {
        "claude-haiku-3-5": {"input": 0.25, "output": 1.25},
        "claude-sonnet-4": {"input": 3.0, "output": 15.0},
        "claude-opus-4-6": {"input": 15.0, "output": 75.0},
    }

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost_usd = 0.0
        self.call_count = 0
        self.calls = []

    def on_llm_end(self, response, **kwargs) -> None:  # noqa: ANN001
        llm_output = getattr(response, "llm_output", {}) or {}
        usage = llm_output.get("token_usage", {}) or {}
        model = llm_output.get("model_name") or llm_output.get("model") or ""
        input_tokens = int(usage.get("prompt_tokens", 0) or 0)
        output_tokens = int(usage.get("completion_tokens", 0) or 0)

        pricing = self.PRICING.get(model, self.PRICING["claude-opus-4-6"])
        cost = (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000

        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.total_cost_usd += cost
        self.call_count += 1
        self.calls.append(
            {
                "model": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": round(cost, 6),
            }
        )

    def get_summary(self) -> dict:
        return {
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_cost_usd": round(self.total_cost_usd, 6),
            "call_count": self.call_count,
            "calls": list(self.calls),
        }


_tracker = TokenUsageTracker()
_llm_cache: Dict[str, ChatOpenAI] = {}
_llm_cache_lock = threading.Lock()


def _model_config(task_type: str) -> dict:
    settings = get_settings()
    tier = TASK_TIER_MAP.get(task_type, TaskTier.HEAVY)
    if tier == TaskTier.LIGHT:
        return {"model": settings.LLM_LIGHT_MODEL, "temperature": 0.0, "max_tokens": 1024}
    if tier == TaskTier.MEDIUM:
        return {"model": settings.LLM_MEDIUM_MODEL, "temperature": 0.1, "max_tokens": 4096}
    return {
        "model": settings.LLM_HEAVY_MODEL or settings.LLM_MODEL,
        "temperature": settings.LLM_TEMPERATURE,
        "max_tokens": max(settings.LLM_MAX_TOKENS, 4096),
    }


def get_llm(task_type: str = "react_reasoning", *, streaming: bool = False) -> ChatOpenAI:
    settings = get_settings()
    cfg = _model_config(task_type)
    return ChatOpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE,
        model=cfg["model"],
        temperature=cfg["temperature"],
        max_tokens=cfg["max_tokens"],
        streaming=streaming,
        callbacks=[_tracker],
    )


def get_cached_llm(task_type: str = "react_reasoning", *, streaming: bool = False) -> ChatOpenAI:
    cache_key = f"{task_type}|stream={int(bool(streaming))}"
    llm = _llm_cache.get(cache_key)
    if llm is None:
        with _llm_cache_lock:
            llm = _llm_cache.get(cache_key)
            if llm is None:
                llm = get_llm(task_type=task_type, streaming=streaming)
                _llm_cache[cache_key] = llm
    return llm


def get_token_usage_tracker() -> TokenUsageTracker:
    return _tracker


def reset_token_usage_tracker() -> None:
    _tracker.reset()

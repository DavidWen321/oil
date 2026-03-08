"""
主工作流编排：
- Level 1：规则直达（问候 / 帮助 / 感谢 / 告别）
- Level 2：ReAct + Tool Search 动态工具选择
- Level 3：复杂任务按需进入 Plan-and-Execute 子图

架构：
  quick_rule_match -> direct_response
                  -> START --> agent --> tools_condition --> tools --> agent（循环）
                                                               -> __end__
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from threading import Lock
from typing import Any, Dict, List, Optional

from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import MessagesState, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.types import Command

from src.config import settings
from src.guardrails import reset_session_context, set_session_context, tool_call_limiter
from src.llm import get_cached_llm, get_token_usage_tracker, reset_token_usage_tracker
from src.memory import LongTermMemoryItem, get_long_term_store, get_memory_manager, get_summarizer
from src.observability import TraceEventType, create_tracer, get_tracer, pop_tracer
from src.persistence import save_trace_end, save_trace_start
from src.tool_search import get_tool_search_engine
from src.workflows.checkpointer import create_checkpointer
from src.tools.agent_tools import (
    ALWAYS_LOADED_TOOL_NAMES,
    REACT_TOOLS,
    TOOL_NAME_TO_TOOL,
    get_all_tool_names,
    get_tools_by_names,
)
from src.utils import generate_session_id, generate_trace_id, logger


# ═══════════════════════════════════════════════════════════════
# System Prompt — 不包含任何"对问候语直接回复"的指令
# ═══════════════════════════════════════════════════════════════

REACT_SYSTEM_PROMPT = """你是管道能耗分析系统的 AI 助手。

## 你的能力
你可以自然地与用户对话，也可以在需要时调用以下工具：
1. query_database — 查询数据库中的项目、管道、泵站、油品数据
2. hydraulic_calculation — 执行水力计算（雷诺数、摩阻、压降、泵优化）
3. search_knowledge_base — 检索管道工程知识库（规范、标准、原理）
4. query_fault_cause — 通过知识图谱进行故障因果推理
5. query_standards — 查询相关标准规范
6. query_equipment_chain — 查询设备关联链路
7. run_sensitivity_analysis — 执行参数敏感性分析
8. plan_complex_task — 对需要多步协作的复杂任务进行规划和分步执行

## 行为准则
- 你是一个自然、智能的对话伙伴。对于问候、闲聊、感谢、告别等，自然地回应即可。
- 当用户的问题需要查数据、做计算、检索知识时，调用对应的工具。
- 执行计算前如果缺少管道参数，先调用 query_database 获取。
- 只有真正需要多步协作（查数据→计算→对比→出报告）的复杂任务才使用 plan_complex_task。
- 用与用户相同的语言回答。
- 数值结果保留合适的有效数字并带单位。
- 引用规范时注明出处编号。
"""


# ═══════════════════════════════════════════════════════════════
# LLM 实例（单例）
# ═══════════════════════════════════════════════════════════════

_base_llm: Optional[ChatOpenAI] = None
_llm_tools_cache: Dict[str, Any] = {}
_base_llm_lock = Lock()
_llm_tools_cache_lock = Lock()
_workflow_lock = Lock()

_QUICK_GREETING_SET = {"你好", "您好", "hi", "hello", "嗨", "hey"}
_QUICK_FAREWELL_SET = {"再见", "拜拜", "bye", "goodbye", "谢谢", "感谢", "thx", "thanks"}
_QUICK_HELP_PATTERNS = (
    re.compile(r"^(你能做什么|你会什么|帮助|help|功能介绍)\s*[？?]?\s*$", re.IGNORECASE),
    re.compile(r"^(怎么用|如何使用|使用说明)\s*[？?]?\s*$", re.IGNORECASE),
)


def _get_base_llm() -> ChatOpenAI:
    global _base_llm
    if _base_llm is None:
        with _base_llm_lock:
            if _base_llm is None:
                _base_llm = get_cached_llm("react_reasoning", streaming=True)
    return _base_llm


def _extract_latest_user_query(messages: List[Any]) -> str:
    for message in reversed(messages):
        if isinstance(message, dict) and message.get("role") == "user":
            return str(message.get("content", ""))
        msg_type = getattr(message, "type", "")
        if msg_type == "human":
            return str(getattr(message, "content", ""))
    if messages:
        return str(getattr(messages[-1], "content", ""))
    return ""


def _merge_tool_names(always_loaded: List[str], dynamic: List[str]) -> List[str]:
    merged: List[str] = []
    seen = set()
    for name in always_loaded + dynamic:
        if name in seen:
            continue
        if name not in TOOL_NAME_TO_TOOL:
            continue
        merged.append(name)
        seen.add(name)
    return merged


def _parse_csv_setting(raw: str) -> List[str]:
    return [item.strip() for item in str(raw).split(",") if item.strip()]


def _select_active_tools(user_query: str) -> Dict[str, Any]:
    if not settings.TOOL_SEARCH_ENABLED:
        names = get_all_tool_names()
        return {
            "selected_names": names,
            "scored_tools": [{"name": name, "score": 1.0, "forced": False} for name in names],
            "total_tools": len(names),
            "duration_ms": 0.0,
            "mode": "all",
        }

    started = time.perf_counter()
    search_engine = get_tool_search_engine()
    allowed_categories = _parse_csv_setting(settings.TOOL_SEARCH_ALLOWED_CATEGORIES)
    allowed_sources = _parse_csv_setting(settings.TOOL_SEARCH_ALLOWED_SOURCES)
    dynamic_scored = search_engine.search_with_scores(
        user_query,
        top_k=max(1, settings.TOOL_SEARCH_TOP_K),
        min_score=max(0.0, settings.TOOL_SEARCH_MIN_SCORE),
        categories=allowed_categories or None,
        sources=allowed_sources or None,
    )
    # 低分兜底，避免因为阈值过高导致无工具可用。
    if not dynamic_scored:
        dynamic_scored = search_engine.search_with_scores(
            user_query,
            top_k=max(1, settings.TOOL_SEARCH_TOP_K),
            min_score=0.0,
            categories=allowed_categories or None,
            sources=allowed_sources or None,
        )

    dynamic_tools = [name for name, _ in dynamic_scored]
    selected = _merge_tool_names(ALWAYS_LOADED_TOOL_NAMES, dynamic_tools)
    if not selected:
        selected = get_all_tool_names()

    score_map = {name: float(score) for name, score in dynamic_scored}
    scored_tools = []
    for name in selected:
        scored_tools.append(
            {
                "name": name,
                "score": round(score_map.get(name, 1.0 if name in ALWAYS_LOADED_TOOL_NAMES else 0.0), 4),
                "forced": name in ALWAYS_LOADED_TOOL_NAMES and name not in score_map,
            }
        )

    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    return {
        "selected_names": selected,
        "scored_tools": scored_tools,
        "total_tools": len(get_all_tool_names()),
        "duration_ms": duration_ms,
        "mode": "hybrid",
        "filters": {
            "categories": allowed_categories,
            "sources": allowed_sources,
        },
    }


def _get_llm_with_tools(tool_names: List[str]) -> Any:
    selected_names = [name for name in tool_names if name in TOOL_NAME_TO_TOOL]
    if not selected_names:
        selected_names = get_all_tool_names()

    cache_key = "|".join(sorted(selected_names))
    cached = _llm_tools_cache.get(cache_key)
    if cached is not None:
        return cached

    with _llm_tools_cache_lock:
        cached = _llm_tools_cache.get(cache_key)
        if cached is not None:
            return cached
        selected_tools = get_tools_by_names(selected_names)
        llm_with_tools = _get_base_llm().bind_tools(selected_tools)
        if len(_llm_tools_cache) >= 64:
            oldest_key = next(iter(_llm_tools_cache), None)
            if oldest_key is not None:
                _llm_tools_cache.pop(oldest_key, None)
        _llm_tools_cache[cache_key] = llm_with_tools
        return llm_with_tools


# ═══════════════════════════════════════════════════════════════
# 图节点 — 主体仍为 ReAct，快速分流在图外处理
# ═══════════════════════════════════════════════════════════════


def agent_node(state: MessagesState) -> dict:
    """
    ReAct Agent 核心节点。
    仅处理未命中 Level 1 快速分流的请求。
    由 LLM 自主决定是直接回复还是调用工具。
    """
    messages = state["messages"]
    user_query = _extract_latest_user_query(list(messages))
    selection = _select_active_tools(user_query)
    active_tool_names = selection["selected_names"]
    llm = _get_llm_with_tools(active_tool_names)
    logger.info(
        "Tool search selected {} tools for query='{}' (mode={}, {}ms): {}",
        len(active_tool_names),
        user_query[:80],
        selection.get("mode", "hybrid"),
        selection.get("duration_ms", 0.0),
        ", ".join(active_tool_names),
    )
    full_messages = [SystemMessage(content=REACT_SYSTEM_PROMPT)] + list(messages)
    response = llm.invoke(full_messages)
    return {"messages": [response]}


# ═══════════════════════════════════════════════════════════════
# 构建主图
# ═══════════════════════════════════════════════════════════════


def create_react_graph() -> StateGraph:
    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", ToolNode(REACT_TOOLS))
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", tools_condition)
    graph.add_edge("tools", "agent")
    return graph


# ═══════════════════════════════════════════════════════════════
# AgentWorkflow 封装
# ═══════════════════════════════════════════════════════════════


class AgentWorkflow:
    def __init__(self):
        self.graph = create_react_graph()
        self.checkpointer = create_checkpointer()
        self.app = self.graph.compile(checkpointer=self.checkpointer)

    @staticmethod
    def _runtime_config(session_id: str) -> dict:
        return {
            "configurable": {"thread_id": session_id},
            "recursion_limit": max(12, settings.AGENT_MAX_ITERATIONS * 2 + 5),
        }

    @staticmethod
    def _resolve_user_scope(session_id: str, user_id: Optional[str] = None) -> str:
        scope = str(user_id or session_id or "").strip()
        return scope or "anonymous"

    @staticmethod
    def _try_rule_match(user_input: str) -> Optional[str]:
        text = str(user_input or "").strip()
        if not text:
            return None

        compact = re.sub(r"\s+", "", text).lower()
        if compact in _QUICK_GREETING_SET:
            return (
                "您好！我是管道能耗分析智能助手。"
                "我可以帮您查询项目数据、进行水力分析、检索规范知识、做故障排查和生成分析报告。"
                "请直接告诉我您的需求。"
            )

        if any(pattern.match(text) for pattern in _QUICK_HELP_PATTERNS):
            return (
                "我可以帮您完成这些任务：\n"
                "1. 数据查询：项目、管道、泵站、油品等业务数据\n"
                "2. 水力分析：雷诺数、摩阻损失、水力坡降、压降分析\n"
                "3. 方案优化：泵站优化、敏感性分析、方案对比\n"
                "4. 知识检索：标准规范、公式原理、操作规程\n"
                "5. 故障诊断：因果链推理、设备链路分析、告警辅助判断\n"
                "6. 报告生成：自动汇总分析结论与建议\n\n"
                "您可以直接说，例如：‘分析 1 号管道当前工况’、‘查询项目 A 的泵站参数’。"
            )

        if compact in _QUICK_FAREWELL_SET:
            return "感谢使用！如果后续还需要做分析、查询或方案对比，随时告诉我。"

        return None

    def _build_direct_response(self, session_id: str, trace_id: str, response_text: str) -> Dict[str, Any]:
        return {
            "response": response_text,
            "session_id": session_id,
            "trace_id": trace_id,
            "intent": "chat",
            "sources": [],
            "confidence": 1.0,
            "tool_calls": [],
            "response_type": "text",
            "token_usage": self._token_usage_summary(),
        }

    def _prepare_user_input(self, session_id: str, user_input: str, user_id: Optional[str] = None) -> str:
        user_input = str(user_input or "").strip()
        if not user_input:
            return user_input

        user_scope = self._resolve_user_scope(session_id, user_id)
        summary_text = ""
        session_memory_lines: List[str] = []
        preference_lines: List[str] = []
        working_lines: List[str] = []
        try:
            store = get_long_term_store()
            existing_summary = store.get(session_id, "conversation_summary")
            if isinstance(existing_summary, dict):
                summary_text = str(existing_summary.get("value", "") or "")

            state = self.get_state(session_id) or {}
            raw_messages = state.get("messages", [])
            history_payload = []
            for message in raw_messages:
                msg_type = getattr(message, "type", "")
                if msg_type in ("human", "ai"):
                    history_payload.append(
                        {
                            "role": "user" if msg_type == "human" else "assistant",
                            "content": str(getattr(message, "content", "")),
                        }
                    )

            if history_payload:
                generated_summary = get_summarizer().summarize(history_payload, threshold=8)
                if generated_summary:
                    summary_text = generated_summary
                    store.upsert(
                        session_id,
                        LongTermMemoryItem(
                            key="conversation_summary",
                            value=generated_summary,
                            metadata={"type": "summary"},
                        ),
                    )

            memory_items = store.list_by_session(session_id)
            for item in sorted(memory_items, key=lambda value: str(value.get("timestamp", "")))[-5:]:
                key = str(item.get("key", "")).strip()
                value = str(item.get("value", "")).strip()
                if not key or not value or key.startswith("turn_"):
                    continue
                session_memory_lines.append(f"- {key}: {value[:300]}")

            memory_manager = get_memory_manager()
            preferences = memory_manager.get_user_preferences(user_scope)
            for key, value in list(preferences.items())[-6:]:
                preview = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value)
                preference_lines.append(f"- {key}: {preview[:220]}")

            working_memory = memory_manager.list_working(session_id, limit=6)
            for key, value in working_memory.items():
                preview = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value)
                if not preview.strip():
                    continue
                working_lines.append(f"- {key}: {preview[:220]}")
        except Exception as exc:  # noqa: BLE001
            logger.debug(f"Prepare user input memory skipped: {exc}")

        if not summary_text and not session_memory_lines and not preference_lines and not working_lines:
            return user_input

        sections = ["以下是当前会话的辅助上下文，仅供参考，请优先处理用户当前问题。"]
        if summary_text:
            sections.append(f"[会话摘要]\n{summary_text}")
        if preference_lines:
            sections.append("[用户偏好]\n" + "\n".join(preference_lines))
        if working_lines:
            sections.append("[工作记忆]\n" + "\n".join(working_lines))
        if session_memory_lines:
            sections.append("[长期记忆]\n" + "\n".join(session_memory_lines))
        sections.append(f"[当前问题]\n{user_input}")
        return "\n\n".join(sections)

    def _persist_turn_memory(
        self,
        session_id: str,
        user_input: str,
        response_text: str,
        tool_calls: List[dict],
        user_id: Optional[str] = None,
        intent: Optional[str] = None,
    ) -> None:
        try:
            store = get_long_term_store()
            store.upsert(
                session_id,
                LongTermMemoryItem(key="last_user_input", value=user_input[:500], metadata={"type": "user_input"}),
            )
            store.upsert(
                session_id,
                LongTermMemoryItem(key="last_response", value=response_text[:1000], metadata={"type": "assistant_response"}),
            )
            store.upsert(
                session_id,
                LongTermMemoryItem(
                    key=f"turn_{int(time.time() * 1000)}",
                    value=json.dumps(
                        {
                            "user_input": user_input[:500],
                            "response": response_text[:1000],
                            "tool_calls": tool_calls[:10],
                        },
                        ensure_ascii=False,
                    )[:1800],
                    metadata={"type": "turn"},
                ),
            )

            memory_manager = get_memory_manager()
            memory_manager.set_working(session_id, "last_user_input", user_input[:500])
            memory_manager.set_working(session_id, "last_response", response_text[:1000])
            memory_manager.set_working(session_id, "last_tool_calls", tool_calls[:5])
            memory_manager.set_working(session_id, "last_response_type", self._infer_response_type(response_text))
            if intent:
                memory_manager.set_working(session_id, "last_intent", intent)
            memory_manager.extract_and_store(
                self._resolve_user_scope(session_id, user_id),
                session_id,
                user_input,
                response_text,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug(f"Persist turn memory skipped: {exc}")

    @staticmethod
    def _infer_response_type(response_text: str) -> str:
        text = str(response_text or "").strip()
        if not text:
            return "text"
        try:
            payload = json.loads(text)
        except Exception:
            return "text"
        if isinstance(payload, dict) and payload.get("card_id") and payload.get("schemes") is not None:
            return "scheme_card"
        return "text"

    @staticmethod
    def _token_usage_summary() -> dict:
        tracker = get_token_usage_tracker()
        summary = tracker.get_summary()
        return {
            **summary,
            "total_tokens": int(summary.get("total_input_tokens", 0) or 0) + int(summary.get("total_output_tokens", 0) or 0),
        }

    def _start_trace(self, trace_id: str, session_id: str, user_input: str):
        reset_token_usage_tracker()
        tracer = create_tracer(trace_id)
        save_trace_start(trace_id=trace_id, session_id=session_id, user_input=user_input)
        tracer.emit(
            TraceEventType.WORKFLOW_STARTED,
            {"session_id": session_id, "user_input": user_input[:500]},
        )
        return tracer

    def _finish_trace(self, trace_id: str, status: str, final_response: Optional[str], plan: Optional[list] = None) -> dict:
        tracer = get_tracer(trace_id)
        metrics = dict(tracer.metrics if tracer else {})
        token_usage = self._token_usage_summary()
        metrics["total_tokens"] = max(int(metrics.get("total_tokens", 0) or 0), int(token_usage.get("total_tokens", 0) or 0))
        save_trace_end(
            trace_id=trace_id,
            status=status,
            final_response=final_response,
            plan=plan or [],
            metrics=metrics,
        )
        pop_tracer(trace_id)
        return metrics

    def invoke(
        self,
        user_input: str,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        session_id = session_id or generate_session_id()
        trace_id = trace_id or generate_trace_id()
        config = self._runtime_config(session_id)
        tracer = self._start_trace(trace_id, session_id, user_input)
        tracer.emit(TraceEventType.AGENT_THINKING, {"phase": "invoke"})
        token = set_session_context(session_id)
        try:
            quick_response = self._try_rule_match(user_input)
            if quick_response is not None:
                tracer.emit(TraceEventType.STATE_SYNC, {"stage": "rule_match", "mode": "direct", "intent": "chat"})
                response = self._build_direct_response(session_id, trace_id, quick_response)
                self._persist_turn_memory(session_id, user_input, quick_response, [], user_id=user_id, intent="chat")
                tracer.emit(
                    TraceEventType.WORKFLOW_COMPLETED,
                    {"response_length": len(quick_response), "tool_calls": 0, "response_type": "text"},
                )
                self._finish_trace(trace_id, "completed", quick_response, [])
                return response

            prepared_input = self._prepare_user_input(session_id, user_input, user_id=user_id)
            result = self.app.invoke(
                {"messages": [{"role": "user", "content": prepared_input}]},
                config=config,
            )
            response = self._build_response(result, session_id, trace_id)
            response["token_usage"] = self._token_usage_summary()
            response["response_type"] = self._infer_response_type(response.get("response", ""))
            self._persist_turn_memory(
                session_id,
                user_input,
                response.get("response", ""),
                response.get("tool_calls", []),
                user_id=user_id,
                intent=response.get("intent"),
            )
            tracer.emit(
                TraceEventType.WORKFLOW_COMPLETED,
                {
                    "response_length": len(str(response.get("response", ""))),
                    "tool_calls": len(response.get("tool_calls", [])),
                    "response_type": response.get("response_type", "text"),
                },
            )
            self._finish_trace(trace_id, "completed", response.get("response"), [])
            return response
        except Exception as exc:  # noqa: BLE001
            tracer.emit(TraceEventType.WORKFLOW_ERROR, {"error": str(exc), "error_type": type(exc).__name__})
            self._finish_trace(trace_id, "error", None, [])
            logger.error(f"Workflow invoke failed: {exc}")
            return {
                "response": f"处理失败: {exc}",
                "session_id": session_id,
                "trace_id": trace_id,
                "error": str(exc),
                "response_type": "text",
                "token_usage": self._token_usage_summary(),
            }
        finally:
            reset_session_context(token)

    async def ainvoke(
        self,
        user_input: str,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        session_id = session_id or generate_session_id()
        trace_id = trace_id or generate_trace_id()
        config = self._runtime_config(session_id)
        tracer = self._start_trace(trace_id, session_id, user_input)
        tracer.emit(TraceEventType.AGENT_THINKING, {"phase": "ainvoke"})
        token = set_session_context(session_id)
        try:
            quick_response = self._try_rule_match(user_input)
            if quick_response is not None:
                tracer.emit(TraceEventType.STATE_SYNC, {"stage": "rule_match", "mode": "direct", "intent": "chat"})
                response = self._build_direct_response(session_id, trace_id, quick_response)
                self._persist_turn_memory(session_id, user_input, quick_response, [], user_id=user_id, intent="chat")
                tracer.emit(
                    TraceEventType.WORKFLOW_COMPLETED,
                    {"response_length": len(quick_response), "tool_calls": 0, "response_type": "text"},
                )
                self._finish_trace(trace_id, "completed", quick_response, [])
                return response

            prepared_input = await asyncio.to_thread(self._prepare_user_input, session_id, user_input, user_id)
            result = await self.app.ainvoke(
                {"messages": [{"role": "user", "content": prepared_input}]},
                config=config,
            )
            response = self._build_response(result, session_id, trace_id)
            response["token_usage"] = self._token_usage_summary()
            response["response_type"] = self._infer_response_type(response.get("response", ""))
            self._persist_turn_memory(
                session_id,
                user_input,
                response.get("response", ""),
                response.get("tool_calls", []),
                user_id=user_id,
                intent=response.get("intent"),
            )
            tracer.emit(
                TraceEventType.WORKFLOW_COMPLETED,
                {
                    "response_length": len(str(response.get("response", ""))),
                    "tool_calls": len(response.get("tool_calls", [])),
                    "response_type": response.get("response_type", "text"),
                },
            )
            self._finish_trace(trace_id, "completed", response.get("response"), [])
            return response
        except Exception as exc:  # noqa: BLE001
            tracer.emit(TraceEventType.WORKFLOW_ERROR, {"error": str(exc), "error_type": type(exc).__name__})
            self._finish_trace(trace_id, "error", None, [])
            logger.error(f"Workflow ainvoke failed: {exc}")
            return {
                "response": f"处理失败: {exc}",
                "session_id": session_id,
                "trace_id": trace_id,
                "error": str(exc),
                "response_type": "text",
                "token_usage": self._token_usage_summary(),
            }
        finally:
            reset_session_context(token)

    async def astream(
        self,
        user_input: str,
        session_id: str,
        trace_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        """True streaming output based on LangGraph astream_events(version="v2")."""
        trace_id = trace_id or generate_trace_id()
        config = self._runtime_config(session_id)
        final_content = ""
        tool_calls_record: List[dict] = []
        tracer = self._start_trace(trace_id, session_id, user_input)
        trace_finished = False

        token = set_session_context(session_id)
        try:
            quick_response = self._try_rule_match(user_input)
            if quick_response is not None:
                final_content = quick_response
                tracer.emit(TraceEventType.STATE_SYNC, {"stage": "rule_match", "mode": "direct", "intent": "chat"})
                tracer.emit(TraceEventType.RESPONSE_CHUNK, {"chunk": quick_response})
                yield {"type": "state_sync", "data": {"stage": "rule_match", "mode": "direct", "intent": "chat"}}
                yield {"type": "token", "content": quick_response}
                response_payload = self._build_direct_response(session_id, trace_id, quick_response)
                self._persist_turn_memory(session_id, user_input, quick_response, [], user_id=user_id, intent="chat")
                tracer.emit(
                    TraceEventType.WORKFLOW_COMPLETED,
                    {"response_length": len(quick_response), "tool_calls": 0, "response_type": "text"},
                )
                self._finish_trace(trace_id, "completed", quick_response, [])
                trace_finished = True
                yield {"type": "done", "response": response_payload}
                return

            prepared_input = await asyncio.to_thread(self._prepare_user_input, session_id, user_input, user_id)
            input_data = {"messages": [{"role": "user", "content": prepared_input}]}
            selection = _select_active_tools(user_input)
            tracer.emit(
                TraceEventType.STATE_SYNC,
                {
                    "stage": "tool_search",
                    "selected_tools": selection["selected_names"],
                    "mode": selection.get("mode", "hybrid"),
                },
            )
            yield {
                "type": "tool_search",
                "query": user_input,
                "selected_tools": selection["selected_names"],
                "selected_scores": selection["scored_tools"],
                "total_tools": selection["total_tools"],
                "duration_ms": selection["duration_ms"],
                "mode": selection["mode"],
                "filters": selection.get("filters", {}),
            }

            async for event in self.app.astream_events(input_data, config=config, version="v2"):
                kind = event["event"]

                if kind == "on_chat_model_start":
                    tracer.emit(TraceEventType.AGENT_THINKING, {"phase": "react_reasoning"})

                elif kind == "on_chat_model_stream":
                    chunk = event["data"].get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        if not (hasattr(chunk, "tool_calls") and chunk.tool_calls):
                            final_content += chunk.content
                            tracer.emit(TraceEventType.RESPONSE_CHUNK, {"chunk": chunk.content})
                            yield {"type": "token", "content": chunk.content}

                elif kind == "on_tool_start":
                    tool_name = event.get("name", "")
                    tool_input = event.get("data", {}).get("input", {})
                    call_id = str(event.get("run_id") or event.get("id") or "")
                    allowed, reason = tool_call_limiter.check(session_id, tool_name)
                    if not allowed:
                        tracer.emit(TraceEventType.WORKFLOW_ERROR, {"error": reason, "tool": tool_name})
                        self._finish_trace(trace_id, "blocked", final_content or None, [])
                        trace_finished = True
                        yield {"type": "error", "error": reason}
                        return

                    tool_calls_record.append({"tool": tool_name, "args": tool_input, "call_id": call_id})
                    tracer.emit(
                        TraceEventType.TOOL_CALLED,
                        {"tool": tool_name, "input": tool_input, "call_id": call_id},
                        agent="react_agent",
                    )
                    yield {
                        "type": "tool_start",
                        "tool": tool_name,
                        "call_id": call_id,
                        "input": tool_input,
                    }

                elif kind == "on_tool_end":
                    tool_name = event.get("name", "")
                    call_id = str(event.get("run_id") or event.get("id") or "")
                    tool_output = str(event.get("data", {}).get("output", ""))

                    if tool_output.startswith("[HITL_WAITING]"):
                        hitl_payload = tool_output[len("[HITL_WAITING]") :]
                        try:
                            hitl_data = json.loads(hitl_payload)
                        except Exception:
                            hitl_data = {"raw": hitl_payload}
                        tracer.emit(TraceEventType.HITL_WAITING, hitl_data)
                        yield {"type": "hitl_waiting", "data": hitl_data}

                    tracer.emit(
                        TraceEventType.TOOL_RESULT,
                        {"tool": tool_name, "call_id": call_id, "output_preview": tool_output[:500]},
                        agent="react_agent",
                    )
                    if len(tool_output) > 1000:
                        tool_output = tool_output[:1000] + "...(已截断)"
                    yield {
                        "type": "tool_end",
                        "tool": tool_name,
                        "call_id": call_id,
                        "output": tool_output,
                    }

            state = self.app.get_state(config)
            if state and state.values:
                msgs = state.values.get("messages", [])
                if msgs and hasattr(msgs[-1], "content") and msgs[-1].content:
                    final_content = msgs[-1].content

            intent = self._infer_intent(tool_calls_record)
            response_type = self._infer_response_type(final_content)
            response_payload = {
                "response": final_content,
                "session_id": session_id,
                "trace_id": trace_id,
                "intent": intent,
                "tool_calls": tool_calls_record,
                "sources": [],
                "confidence": 0.85 if tool_calls_record else 0.95,
                "response_type": response_type,
                "token_usage": self._token_usage_summary(),
            }
            self._persist_turn_memory(
                session_id,
                user_input,
                final_content,
                tool_calls_record,
                user_id=user_id,
                intent=intent,
            )
            tracer.emit(
                TraceEventType.WORKFLOW_COMPLETED,
                {
                    "response_length": len(final_content),
                    "tool_calls": len(tool_calls_record),
                    "response_type": response_type,
                },
            )
            self._finish_trace(trace_id, "completed", final_content, [])
            trace_finished = True
            yield {"type": "done", "response": response_payload}
        except Exception as exc:  # noqa: BLE001
            tracer.emit(TraceEventType.WORKFLOW_ERROR, {"error": str(exc), "error_type": type(exc).__name__})
            if not trace_finished:
                self._finish_trace(trace_id, "error", final_content or None, [])
                trace_finished = True
            logger.error(f"Workflow astream failed: {exc}")
            yield {"type": "error", "error": str(exc)}
        finally:
            reset_session_context(token)
            if not trace_finished:
                self._finish_trace(trace_id, "error", final_content or None, [])

    async def resume_from_hitl(self, session_id: str, user_choice: dict, user_id: Optional[str] = None) -> Dict[str, Any]:
        """从 HITL 中断恢复执行。"""
        request_id = str(user_choice.get("request_id", "")).strip()
        if request_id:
            try:
                from src.workflows.subgraph import resume_plan_execute

                resumed = await asyncio.to_thread(resume_plan_execute, request_id=request_id, user_choice=user_choice)
                resumed_status = resumed.get("status")

                if resumed_status == "completed":
                    response_text = str(resumed.get("response", ""))
                    response_type = self._infer_response_type(response_text)
                    self._persist_turn_memory(
                        session_id,
                        json.dumps(user_choice, ensure_ascii=False),
                        response_text,
                        [{"tool": "plan_complex_task", "args": {"request_id": request_id}}],
                        user_id=user_id,
                        intent="complex",
                    )
                    return {
                        "response": response_text,
                        "session_id": session_id,
                        "trace_id": "",
                        "intent": "complex",
                        "sources": [],
                        "confidence": 0.9,
                        "tool_calls": [{"tool": "plan_complex_task", "args": {"request_id": request_id}}],
                        "response_type": response_type,
                        "token_usage": self._token_usage_summary(),
                    }

                if resumed_status == "hitl_waiting":
                    return {
                        "response": "任务仍需人工确认，请继续选择方案。",
                        "session_id": session_id,
                        "trace_id": "",
                        "intent": "complex",
                        "sources": [],
                        "confidence": 0.85,
                        "tool_calls": [{"tool": "plan_complex_task", "args": {"request_id": request_id}}],
                        "hitl_request": resumed.get("hitl_data"),
                        "response_type": "text",
                        "token_usage": self._token_usage_summary(),
                    }

                if resumed_status == "error":
                    return {
                        "response": f"恢复执行失败: {resumed.get('error', '未知错误')}",
                        "session_id": session_id,
                        "trace_id": "",
                        "error": str(resumed.get("error", "")),
                        "response_type": "text",
                        "token_usage": self._token_usage_summary(),
                    }
            except Exception as exc:  # noqa: BLE001
                logger.error(f"Subgraph resume bridge failed: {exc}")

        config = self._runtime_config(session_id)
        token = set_session_context(session_id)
        try:
            result = await self.app.ainvoke(Command(resume=user_choice), config=config)
            response = self._build_response(result, session_id, None)
            response["response_type"] = self._infer_response_type(response.get("response", ""))
            response["token_usage"] = self._token_usage_summary()
            self._persist_turn_memory(
                session_id,
                json.dumps(user_choice, ensure_ascii=False),
                response.get("response", ""),
                response.get("tool_calls", []),
                user_id=user_id,
                intent=response.get("intent"),
            )
            return response
        except Exception as exc:  # noqa: BLE001
            logger.error(f"HITL resume failed: {exc}")
            return {
                "response": f"恢复执行失败: {exc}",
                "session_id": session_id,
                "trace_id": "",
                "error": str(exc),
                "response_type": "text",
                "token_usage": self._token_usage_summary(),
            }
        finally:
            reset_session_context(token)

    def get_state(self, session_id: str) -> Optional[Dict[str, Any]]:
        config = {"configurable": {"thread_id": session_id}}
        try:
            state = self.app.get_state(config)
            return state.values if state else None
        except Exception as exc:  # noqa: BLE001
            logger.error(f"Failed to get state: {exc}")
            return None

    @staticmethod
    def _infer_intent(tool_calls: list) -> str:
        tool_names = {item.get("tool") for item in tool_calls if item.get("tool")}
        if "plan_complex_task" in tool_names:
            return "complex"
        if "hydraulic_calculation" in tool_names or "run_sensitivity_analysis" in tool_names:
            return "calculate"
        if "query_database" in tool_names:
            return "query"
        if tool_names & {
            "search_knowledge_base",
            "query_fault_cause",
            "query_standards",
            "query_equipment_chain",
        }:
            return "knowledge"
        return "chat"

    @staticmethod
    def _build_response(
        result: dict,
        session_id: str,
        trace_id: Optional[str],
    ) -> Dict[str, Any]:
        messages = result.get("messages", [])
        final_message = messages[-1] if messages else None
        response_text = final_message.content if final_message else ""

        current_turn_messages = messages
        for idx in range(len(messages) - 1, -1, -1):
            if getattr(messages[idx], "type", "") == "human":
                current_turn_messages = messages[idx + 1 :]
                break

        tool_calls = []
        for msg in current_turn_messages:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_calls.append({"tool": tc.get("name", ""), "args": tc.get("args", {})})

        intent = AgentWorkflow._infer_intent(tool_calls)
        response_type = AgentWorkflow._infer_response_type(response_text)
        return {
            "response": response_text,
            "session_id": session_id,
            "trace_id": trace_id or "",
            "intent": intent,
            "sources": [],
            "confidence": 0.85 if tool_calls else 0.95,
            "tool_calls": tool_calls,
            "response_type": response_type,
        }


# ═══════════════════════════════════════════════════════════════
# 单例
# ═══════════════════════════════════════════════════════════════

_workflow: Optional[AgentWorkflow] = None


def get_workflow() -> AgentWorkflow:
    global _workflow
    if _workflow is None:
        with _workflow_lock:
            if _workflow is None:
                _workflow = AgentWorkflow()
    return _workflow

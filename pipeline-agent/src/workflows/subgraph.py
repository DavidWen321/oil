"""
Plan-and-Execute 子图。
仅在 plan_complex_task 工具被调用时进入。

HITL 处理策略（重构后）：
当子图触发 interrupt()（泵站方案选择），
中断会通过 SSE 传递到前端，由用户真实选择方案。
不再自动选择。
"""

from __future__ import annotations

import json
import time
from threading import Lock
from typing import Any, Dict, Optional

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.types import Command

from src.models.state import AgentState, create_initial_state
from src.observability import create_tracer
from src.utils import generate_session_id, generate_trace_id, logger

from .edges import route_after_hitl, route_after_reflexion, route_after_step, route_to_agent
from .nodes import (
    calc_agent_node,
    data_agent_node,
    executor_node,
    graph_agent_node,
    hitl_check_node,
    knowledge_agent_node,
    planner_node,
    reflexion_node,
    report_agent_node,
    step_evaluator_node,
    synthesizer_node,
)


def _create_plan_execute_subgraph():
    """构建 Plan-and-Execute 子图。带 MemorySaver 以支持 interrupt/resume。"""
    graph = StateGraph(AgentState)

    graph.add_node("planner", planner_node)
    graph.add_node("executor", executor_node)
    graph.add_node("data_agent", data_agent_node)
    graph.add_node("calc_agent", calc_agent_node)
    graph.add_node("knowledge_agent", knowledge_agent_node)
    graph.add_node("graph_agent", graph_agent_node)
    graph.add_node("report_agent", report_agent_node)
    graph.add_node("step_evaluator", step_evaluator_node)
    graph.add_node("reflexion", reflexion_node)
    graph.add_node("hitl_check", hitl_check_node)
    graph.add_node("synthesizer", synthesizer_node)

    graph.set_entry_point("planner")
    graph.add_edge("planner", "executor")

    graph.add_conditional_edges(
        "executor",
        route_to_agent,
        {
            "data_agent": "data_agent",
            "calc_agent": "calc_agent",
            "knowledge_agent": "knowledge_agent",
            "graph_agent": "graph_agent",
            "report_agent": "report_agent",
            "synthesizer": "synthesizer",
        },
    )

    for node in ["data_agent", "calc_agent", "knowledge_agent", "graph_agent", "report_agent"]:
        graph.add_edge(node, "step_evaluator")

    graph.add_conditional_edges(
        "step_evaluator",
        route_after_step,
        {"reflexion": "reflexion", "hitl_check": "hitl_check", "synthesizer": "synthesizer"},
    )

    graph.add_conditional_edges(
        "reflexion",
        route_after_reflexion,
        {"executor": "executor", "planner": "planner", "synthesizer": "synthesizer"},
    )

    graph.add_conditional_edges(
        "hitl_check",
        route_after_hitl,
        {"executor": "executor", "planner": "planner", "synthesizer": "synthesizer"},
    )

    graph.add_edge("synthesizer", END)
    return graph.compile(checkpointer=MemorySaver())


_subgraph_app = None

# request_id -> {"app": app, "config": config, "updated_at": ts}
_pending_subgraph_runs: Dict[str, Dict[str, Any]] = {}
_pending_lock = Lock()
_PENDING_TTL_SECONDS = 1800


def _get_subgraph():
    global _subgraph_app
    if _subgraph_app is None:
        _subgraph_app = _create_plan_execute_subgraph()
    return _subgraph_app


def _cleanup_pending_runs(now: float):
    expired = [
        request_id
        for request_id, info in _pending_subgraph_runs.items()
        if now - float(info.get("updated_at", 0.0)) > _PENDING_TTL_SECONDS
    ]
    for request_id in expired:
        _pending_subgraph_runs.pop(request_id, None)


def _cache_pending_run(request_id: str, app, config: dict):
    if not request_id:
        return
    with _pending_lock:
        now = time.time()
        _cleanup_pending_runs(now)
        _pending_subgraph_runs[request_id] = {
            "app": app,
            "config": config,
            "updated_at": now,
        }


def _take_pending_run(request_id: str) -> Optional[Dict[str, Any]]:
    if not request_id:
        return None
    with _pending_lock:
        now = time.time()
        _cleanup_pending_runs(now)
        return _pending_subgraph_runs.pop(request_id, None)


def run_plan_execute(task_description: str) -> str:
    """
    Plan-and-Execute 子图入口。被 plan_complex_task 工具调用。

    重构后的行为：
    - 不再自动选择泵方案（删除了 _auto_select_scheme）
    - 如果子图触发 HITL interrupt，返回提示信息，
      告知前端需要用户选择方案
    - 前端通过 /chat/confirm 接口提交选择后，
      由 AgentWorkflow.resume_from_hitl() 恢复执行
    """
    session_id = generate_session_id()
    trace_id = generate_trace_id()
    create_tracer(trace_id)

    initial_state = create_initial_state(
        user_input=task_description,
        session_id=session_id,
        max_iterations=10,
        max_retries_per_step=2,
        trace_id=trace_id,
    )

    config = {"configurable": {"thread_id": session_id}}
    app = _get_subgraph()

    try:
        result = app.invoke(initial_state, config=config)

        # 检查是否因 HITL interrupt 暂停
        state_snapshot = app.get_state(config)
        if state_snapshot and state_snapshot.next:
            hitl_data = _extract_interrupt_value(app, config)
            if hitl_data:
                request_id = str(hitl_data.get("request_id", "")).strip()
                if request_id:
                    _cache_pending_run(request_id, app, config)
                return f"[HITL_WAITING]{json.dumps(hitl_data, ensure_ascii=False)}"

        final_response = result.get("final_response", "")
        if final_response:
            return final_response
        return "复杂任务执行完成，但未生成最终回复。"

    except Exception as e:
        logger.error(f"Plan-Execute subgraph failed: {e}")
        return f"复杂任务执行失败: {str(e)}"


def resume_plan_execute(request_id: str, user_choice: dict) -> Dict[str, Any]:
    """
    根据 request_id 恢复被中断的 Plan-and-Execute 子图。

    Returns:
      {
        "status": "completed" | "hitl_waiting" | "not_found" | "error",
        "response": "...",          # completed 时存在
        "hitl_data": {...},          # hitl_waiting 时存在
        "error": "...",             # error 时存在
      }
    """
    pending = _take_pending_run(request_id)
    if not pending:
        return {
            "status": "not_found",
            "error": f"未找到 request_id={request_id} 对应的待恢复子图状态，可能已过期。",
        }

    app = pending["app"]
    config = pending["config"]

    try:
        result = app.invoke(Command(resume=user_choice), config=config)

        # 恢复后如果再次中断，继续返回新的 hitl_data 并缓存
        state_snapshot = app.get_state(config)
        if state_snapshot and state_snapshot.next:
            hitl_data = _extract_interrupt_value(app, config)
            if hitl_data:
                next_request_id = str(hitl_data.get("request_id", "")).strip()
                if next_request_id:
                    _cache_pending_run(next_request_id, app, config)
                return {"status": "hitl_waiting", "hitl_data": hitl_data}

        final_response = result.get("final_response", "")
        if not final_response:
            final_response = "复杂任务执行完成，但未生成最终回复。"
        return {"status": "completed", "response": final_response}

    except Exception as e:
        logger.error(f"Plan-Execute resume failed: {e}")
        return {"status": "error", "error": str(e)}


def _extract_interrupt_value(app, config: dict):
    """从子图状态快照中提取 interrupt() 传入的 HITL 请求数据。"""
    try:
        state_snapshot = app.get_state(config)
        if not state_snapshot or not state_snapshot.next:
            return None
        for task in getattr(state_snapshot, "tasks", []):
            for intr in getattr(task, "interrupts", []):
                value = getattr(intr, "value", None)
                if value is not None:
                    return value
    except Exception as e:
        logger.debug(f"Failed to extract interrupt value: {e}")
    return None

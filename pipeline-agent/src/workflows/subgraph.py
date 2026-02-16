"""
Plan-and-Execute 子图。
仅在 plan_complex_task 工具被调用时进入。
内部节点和边全部复用现有实现（nodes.py / edges.py），不做任何修改。

HITL 处理策略：
当子图执行过程中触发 interrupt()（泵站方案选择），
自动选择最优方案（最低能耗 + 末站压力可行）并恢复执行。
"""

from __future__ import annotations

from typing import Optional

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
    """
    构建 Plan-and-Execute 子图。
    与旧版 create_plan_execute_graph() 结构完全一致。
    带 MemorySaver checkpointer 以支持 interrupt/resume（HITL 自动审批）。
    """
    graph = StateGraph(AgentState)

    # ── 注册节点（全部复用 nodes.py 中的函数） ──
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

    # ── 入口 ──
    graph.set_entry_point("planner")

    # ── 边（全部复用 edges.py 中的函数） ──
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
        {
            "reflexion": "reflexion",
            "hitl_check": "hitl_check",
            "synthesizer": "synthesizer",
        },
    )

    graph.add_conditional_edges(
        "reflexion",
        route_after_reflexion,
        {
            "executor": "executor",
            "planner": "planner",
            "synthesizer": "synthesizer",
        },
    )

    graph.add_conditional_edges(
        "hitl_check",
        route_after_hitl,
        {
            "executor": "executor",
            "planner": "planner",
            "synthesizer": "synthesizer",
        },
    )

    graph.add_edge("synthesizer", END)

    return graph.compile(checkpointer=MemorySaver())


# 单例
_subgraph_app = None


def _get_subgraph():
    global _subgraph_app
    if _subgraph_app is None:
        _subgraph_app = _create_plan_execute_subgraph()
    return _subgraph_app


# ═══════════════════════════════════════════════════════════════
# HITL 自动审批
# ═══════════════════════════════════════════════════════════════


def _auto_select_scheme(hitl_request: Optional[dict]) -> dict:
    """
    HITL 自动审批：从泵站优化方案列表中选择最优方案。

    选择策略：在末站压力可行（> 0.1 MPa）的方案中选能耗最低的。
    如果没有可行方案，退选第一个。

    返回格式与 hitl_check_node 中 interrupt() 预期的 user_choice 一致：
    {"selected_option": "scheme_N", "comment": "..."}
    """
    if not hitl_request:
        return {"selected_option": "scheme_0", "comment": "自动选择默认方案"}

    schemes = hitl_request.get("data", {}).get("schemes_detail", [])
    if not schemes:
        return {"selected_option": "scheme_0", "comment": "自动选择默认方案"}

    best_idx = 0
    best_energy = float("inf")

    for i, scheme in enumerate(schemes):
        try:
            end_pressure = float(scheme.get("end_pressure", 0))
            energy = float(scheme.get("energy_consumption", float("inf")))
        except (ValueError, TypeError):
            continue

        if end_pressure > 0.1 and energy < best_energy:
            best_energy = energy
            best_idx = i

    selected = f"scheme_{best_idx}"
    logger.info(f"HITL auto-approve: selected {selected} (energy={best_energy})")
    return {
        "selected_option": selected,
        "comment": "系统自动选择最优方案（最低能耗且末站压力可行）",
    }


def _extract_interrupt_value(app, config: dict) -> Optional[dict]:
    """
    从子图状态快照中提取 interrupt() 传入的值（即 HITL 请求数据）。

    LangGraph >= 1.0 中，interrupt 后：
    - app.get_state(config).next 为非空（有待执行的节点）
    - app.get_state(config).tasks 中包含 interrupts 列表
    - 每个 interrupt 的 .value 就是 interrupt(hitl_request) 传入的 hitl_request
    """
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


# ═══════════════════════════════════════════════════════════════
# 子图入口
# ═══════════════════════════════════════════════════════════════


def run_plan_execute(task_description: str) -> str:
    """
    Plan-and-Execute 子图的入口函数。
    被 plan_complex_task 工具调用。

    当子图触发 HITL 中断（泵站方案选择）时，
    自动选择最优方案并恢复执行，不需要前端交互。

    Args:
        task_description: 用户的完整任务描述

    Returns:
        最终回复文本
    """
    session_id = generate_session_id()
    trace_id = generate_trace_id()

    # 创建 tracer 供子图节点使用
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

    # 防止 HITL 无限循环
    max_hitl_rounds = 3

    try:
        result = app.invoke(initial_state, config=config)

        # 检查是否因 HITL interrupt 暂停，自动审批并恢复
        for _ in range(max_hitl_rounds):
            hitl_request = _extract_interrupt_value(app, config)
            if hitl_request is None:
                break  # 没有中断，正常完成

            auto_response = _auto_select_scheme(hitl_request)
            result = app.invoke(Command(resume=auto_response), config=config)

        final_response = result.get("final_response", "")
        if final_response:
            return final_response
        return "复杂任务执行完成，但未生成最终回复。"
    except Exception as e:
        logger.error(f"Plan-Execute subgraph failed: {e}")
        return f"复杂任务执行失败: {str(e)}"

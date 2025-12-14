"""
LangGraph 边条件函数
定义工作流中的路由逻辑
"""

from typing import Literal

from src.models.state import AgentState
from src.utils import logger


def route_after_intent(state: AgentState) -> Literal["supervisor", "end", "error_handler"]:
    """
    意图路由后的分支

    根据意图分析结果决定下一步
    """
    intent = state.get("intent")
    final_response = state.get("final_response")
    error_message = state.get("error_message")

    logger.debug(f"路由决策: intent={intent}, has_response={bool(final_response)}")

    # 如果有错误
    if error_message:
        return "error_handler"

    # 如果已有最终响应（如闲聊）
    if final_response:
        return "end"

    # 否则进入Supervisor调度
    return "supervisor"


def route_after_supervisor(
    state: AgentState
) -> Literal["data_agent", "calc_agent", "knowledge_agent", "end", "error_handler"]:
    """
    Supervisor后的分支

    根据next_agent决定调用哪个Agent
    """
    next_agent = state.get("next_agent")
    error_message = state.get("error_message")
    final_response = state.get("final_response")

    logger.debug(f"Supervisor路由: next_agent={next_agent}")

    # 如果有错误
    if error_message:
        return "error_handler"

    # 如果已有最终响应
    if final_response:
        return "end"

    # 根据next_agent路由
    if next_agent == "data_agent":
        return "data_agent"
    elif next_agent == "calc_agent":
        return "calc_agent"
    elif next_agent == "knowledge_agent":
        return "knowledge_agent"
    else:
        # 没有更多任务
        return "end"


def route_after_agent(
    state: AgentState
) -> Literal["supervisor", "end", "error_handler"]:
    """
    Agent执行后的分支

    检查是否需要继续执行其他任务
    """
    sub_tasks = state.get("sub_tasks", [])
    current_index = state.get("current_task_index", 0)
    error_count = state.get("error_count", 0)
    final_response = state.get("final_response")

    logger.debug(f"Agent后路由: index={current_index}, total={len(sub_tasks)}")

    # 如果已有最终响应
    if final_response:
        return "end"

    # 如果错误次数过多
    if error_count >= 3:
        return "error_handler"

    # 如果还有任务未完成
    if current_index < len(sub_tasks):
        return "supervisor"

    # 所有任务完成，回到Supervisor汇总
    return "supervisor"


def route_after_error(
    state: AgentState
) -> Literal["knowledge_agent", "end"]:
    """
    错误处理后的分支
    """
    final_response = state.get("final_response")
    error_count = state.get("error_count", 0)

    if final_response or error_count >= 3:
        return "end"

    # 降级到知识问答
    return "knowledge_agent"


def should_continue(state: AgentState) -> bool:
    """
    检查是否应该继续执行

    防止无限循环
    """
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 10)
    final_response = state.get("final_response")

    if final_response:
        return False

    if iteration >= max_iterations:
        logger.warning(f"达到最大迭代次数: {max_iterations}")
        return False

    return True

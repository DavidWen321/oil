"""
LangGraph 节点函数
定义工作流中的各个处理节点
"""

import time
from typing import Dict, Any

from langchain_core.messages import HumanMessage, AIMessage

from src.utils import logger, generate_task_id
from src.models.state import AgentState, ExecutionStep
from src.models.enums import IntentType
from src.agents import (
    get_supervisor,
    get_data_agent,
    get_calc_agent,
    get_knowledge_agent
)


def intent_router_node(state: AgentState) -> Dict[str, Any]:
    """
    意图路由节点

    分析用户意图，决定后续流程
    """
    start_time = time.perf_counter()

    user_input = state.get("user_input", "")
    logger.info(f"意图路由: {user_input[:50]}...")

    try:
        supervisor = get_supervisor()
        decision = supervisor.analyze_intent(user_input)

        intent = decision.get("intent", "knowledge")
        sub_tasks = supervisor.create_sub_tasks(decision)

        # 记录执行步骤
        step = ExecutionStep(
            step=len(state.get("execution_trace", [])) + 1,
            agent="intent_router",
            action="analyze_intent",
            input=user_input,
            output={"intent": intent, "tasks": len(sub_tasks)},
            duration_ms=int((time.perf_counter() - start_time) * 1000)
        )

        # 处理闲聊
        if intent == "chat":
            chat_response = supervisor.handle_chat(user_input)
            return {
                "intent": intent,
                "sub_tasks": [],
                "final_response": chat_response,
                "execution_trace": state.get("execution_trace", []) + [step],
                "next_agent": None
            }

        # 确定第一个Agent
        next_agent = sub_tasks[0]["agent"] if sub_tasks else None

        return {
            "intent": intent,
            "sub_tasks": sub_tasks,
            "current_task_index": 0,
            "next_agent": next_agent,
            "execution_trace": state.get("execution_trace", []) + [step]
        }

    except Exception as e:
        logger.error(f"意图路由失败: {e}")
        return {
            "intent": "knowledge",
            "error_message": str(e),
            "error_count": state.get("error_count", 0) + 1
        }


def supervisor_node(state: AgentState) -> Dict[str, Any]:
    """
    Supervisor节点

    任务调度和结果汇总
    """
    start_time = time.perf_counter()

    sub_tasks = state.get("sub_tasks", [])
    completed_tasks = state.get("completed_tasks", [])
    current_index = state.get("current_task_index", 0)

    # 检查是否所有任务完成
    if current_index >= len(sub_tasks):
        # 汇总结果
        supervisor = get_supervisor()
        final_response = supervisor.synthesize_response(
            user_input=state.get("user_input", ""),
            completed_tasks=completed_tasks,
            intent=state.get("intent", "")
        )

        step = ExecutionStep(
            step=len(state.get("execution_trace", [])) + 1,
            agent="supervisor",
            action="synthesize",
            input={"completed_tasks": len(completed_tasks)},
            output={"response_length": len(final_response)},
            duration_ms=int((time.perf_counter() - start_time) * 1000)
        )

        return {
            "final_response": final_response,
            "next_agent": None,
            "execution_trace": state.get("execution_trace", []) + [step]
        }

    # 确定下一个Agent
    current_task = sub_tasks[current_index]
    next_agent = current_task.get("agent")

    return {
        "next_agent": next_agent
    }


def data_agent_node(state: AgentState) -> Dict[str, Any]:
    """
    Data Agent节点

    执行数据库查询
    """
    start_time = time.perf_counter()

    sub_tasks = state.get("sub_tasks", [])
    current_index = state.get("current_task_index", 0)
    completed_tasks = state.get("completed_tasks", [])

    if current_index >= len(sub_tasks):
        return {}

    current_task = sub_tasks[current_index]
    task_desc = current_task.get("task", state.get("user_input", ""))

    logger.info(f"Data Agent执行: {task_desc[:50]}...")

    try:
        agent = get_data_agent()
        result = agent.execute(task_desc)

        # 标记任务完成
        current_task["status"] = "completed"
        current_task["result"] = result
        completed_tasks.append(current_task)

        step = ExecutionStep(
            step=len(state.get("execution_trace", [])) + 1,
            agent="data_agent",
            action="query",
            input=task_desc,
            output=result[:200] + "..." if len(result) > 200 else result,
            duration_ms=int((time.perf_counter() - start_time) * 1000)
        )

        # 解析结果存储到state（简化处理）
        pipeline_data = None
        if "管道" in result and "长度" in result:
            pipeline_data = {"raw": result}

        return {
            "completed_tasks": completed_tasks,
            "current_task_index": current_index + 1,
            "pipeline_data": pipeline_data,
            "execution_trace": state.get("execution_trace", []) + [step]
        }

    except Exception as e:
        logger.error(f"Data Agent失败: {e}")
        current_task["status"] = "failed"
        current_task["result"] = f"查询失败: {str(e)}"

        return {
            "completed_tasks": completed_tasks + [current_task],
            "current_task_index": current_index + 1,
            "error_message": str(e),
            "error_count": state.get("error_count", 0) + 1
        }


def calc_agent_node(state: AgentState) -> Dict[str, Any]:
    """
    Calc Agent节点

    执行水力计算
    """
    start_time = time.perf_counter()

    sub_tasks = state.get("sub_tasks", [])
    current_index = state.get("current_task_index", 0)
    completed_tasks = state.get("completed_tasks", [])

    if current_index >= len(sub_tasks):
        return {}

    current_task = sub_tasks[current_index]
    task_desc = current_task.get("task", state.get("user_input", ""))

    logger.info(f"Calc Agent执行: {task_desc[:50]}...")

    try:
        agent = get_calc_agent()

        # 收集已有数据
        available_data = {}
        if state.get("pipeline_data"):
            available_data["pipeline"] = state["pipeline_data"]
        if state.get("oil_property_data"):
            available_data["oil"] = state["oil_property_data"]

        result = agent.execute(task_desc, available_data)

        # 标记任务完成
        current_task["status"] = "completed"
        current_task["result"] = result
        completed_tasks.append(current_task)

        step = ExecutionStep(
            step=len(state.get("execution_trace", [])) + 1,
            agent="calc_agent",
            action="calculate",
            input=task_desc,
            output=result[:200] + "..." if len(result) > 200 else result,
            duration_ms=int((time.perf_counter() - start_time) * 1000)
        )

        return {
            "completed_tasks": completed_tasks,
            "current_task_index": current_index + 1,
            "calculation_result": {"raw": result},
            "execution_trace": state.get("execution_trace", []) + [step]
        }

    except Exception as e:
        logger.error(f"Calc Agent失败: {e}")
        current_task["status"] = "failed"
        current_task["result"] = f"计算失败: {str(e)}"

        return {
            "completed_tasks": completed_tasks + [current_task],
            "current_task_index": current_index + 1,
            "error_message": str(e),
            "error_count": state.get("error_count", 0) + 1
        }


def knowledge_agent_node(state: AgentState) -> Dict[str, Any]:
    """
    Knowledge Agent节点

    执行知识检索和问答
    """
    start_time = time.perf_counter()

    sub_tasks = state.get("sub_tasks", [])
    current_index = state.get("current_task_index", 0)
    completed_tasks = state.get("completed_tasks", [])

    if current_index >= len(sub_tasks):
        # 没有任务时，直接处理用户输入
        task_desc = state.get("user_input", "")
    else:
        current_task = sub_tasks[current_index]
        task_desc = current_task.get("task", state.get("user_input", ""))

    logger.info(f"Knowledge Agent执行: {task_desc[:50]}...")

    try:
        agent = get_knowledge_agent()
        result = agent.execute(task_desc)

        step = ExecutionStep(
            step=len(state.get("execution_trace", [])) + 1,
            agent="knowledge_agent",
            action="retrieve_and_answer",
            input=task_desc,
            output=result[:200] + "..." if len(result) > 200 else result,
            duration_ms=int((time.perf_counter() - start_time) * 1000)
        )

        if current_index < len(sub_tasks):
            current_task = sub_tasks[current_index]
            current_task["status"] = "completed"
            current_task["result"] = result
            completed_tasks.append(current_task)

            return {
                "completed_tasks": completed_tasks,
                "current_task_index": current_index + 1,
                "knowledge_context": result,
                "execution_trace": state.get("execution_trace", []) + [step]
            }
        else:
            # 直接作为最终响应
            return {
                "final_response": result,
                "knowledge_context": result,
                "execution_trace": state.get("execution_trace", []) + [step],
                "next_agent": None
            }

    except Exception as e:
        logger.error(f"Knowledge Agent失败: {e}")
        if current_index < len(sub_tasks):
            current_task = sub_tasks[current_index]
            current_task["status"] = "failed"
            current_task["result"] = f"检索失败: {str(e)}"
            completed_tasks.append(current_task)

        return {
            "completed_tasks": completed_tasks,
            "current_task_index": current_index + 1,
            "error_message": str(e),
            "error_count": state.get("error_count", 0) + 1
        }


def error_handler_node(state: AgentState) -> Dict[str, Any]:
    """
    错误处理节点
    """
    error_message = state.get("error_message", "未知错误")
    error_count = state.get("error_count", 0)

    logger.warning(f"错误处理: {error_message}, 错误次数: {error_count}")

    if error_count >= 3:
        # 错误次数过多，终止
        return {
            "final_response": f"抱歉，处理过程中遇到问题：{error_message}。请稍后重试或换一种方式提问。",
            "next_agent": None
        }

    # 尝试降级处理
    return {
        "error_message": None,  # 清除错误
        "next_agent": "knowledge_agent"  # 降级到知识问答
    }


def end_node(state: AgentState) -> Dict[str, Any]:
    """
    结束节点

    添加最终处理
    """
    final_response = state.get("final_response", "")

    if not final_response:
        completed_tasks = state.get("completed_tasks", [])
        if completed_tasks:
            # 拼接所有结果
            results = [t.get("result", "") for t in completed_tasks if t.get("result")]
            final_response = "\n\n".join(results)
        else:
            final_response = "抱歉，无法处理您的请求。"

    # 添加消息到历史
    messages = state.get("messages", [])
    messages.append(AIMessage(content=final_response))

    return {
        "final_response": final_response,
        "messages": messages,
        "confidence_score": 0.8  # 可以根据实际情况计算
    }

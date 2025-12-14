"""
LangGraph 工作流定义
构建完整的多Agent协作图
"""

from typing import Optional, Dict, Any
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from src.config import settings
from src.utils import logger, generate_session_id
from src.models.state import AgentState, create_initial_state

from .nodes import (
    intent_router_node,
    supervisor_node,
    data_agent_node,
    calc_agent_node,
    knowledge_agent_node,
    error_handler_node,
    end_node
)

from .edges import (
    route_after_intent,
    route_after_supervisor,
    route_after_agent,
    route_after_error
)


def create_agent_graph() -> StateGraph:
    """
    创建Agent工作流图

    工作流结构：
    ```
    intent_router --> supervisor --> data_agent --|
                          |                       |
                          +--> calc_agent --------|
                          |                       |
                          +--> knowledge_agent ---|
                          |                       v
                          +<------ (loop back) <--+
                          |
                          v
                         end
    ```

    Returns:
        配置好的StateGraph
    """
    # 创建图
    graph = StateGraph(AgentState)

    # 添加节点
    graph.add_node("intent_router", intent_router_node)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("data_agent", data_agent_node)
    graph.add_node("calc_agent", calc_agent_node)
    graph.add_node("knowledge_agent", knowledge_agent_node)
    graph.add_node("error_handler", error_handler_node)
    graph.add_node("end", end_node)

    # 设置入口
    graph.set_entry_point("intent_router")

    # 添加边 - 意图路由后
    graph.add_conditional_edges(
        "intent_router",
        route_after_intent,
        {
            "supervisor": "supervisor",
            "end": "end",
            "error_handler": "error_handler"
        }
    )

    # 添加边 - Supervisor后
    graph.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {
            "data_agent": "data_agent",
            "calc_agent": "calc_agent",
            "knowledge_agent": "knowledge_agent",
            "end": "end",
            "error_handler": "error_handler"
        }
    )

    # 添加边 - 各Agent后
    graph.add_conditional_edges(
        "data_agent",
        route_after_agent,
        {
            "supervisor": "supervisor",
            "end": "end",
            "error_handler": "error_handler"
        }
    )

    graph.add_conditional_edges(
        "calc_agent",
        route_after_agent,
        {
            "supervisor": "supervisor",
            "end": "end",
            "error_handler": "error_handler"
        }
    )

    graph.add_conditional_edges(
        "knowledge_agent",
        route_after_agent,
        {
            "supervisor": "supervisor",
            "end": "end",
            "error_handler": "error_handler"
        }
    )

    # 添加边 - 错误处理后
    graph.add_conditional_edges(
        "error_handler",
        route_after_error,
        {
            "knowledge_agent": "knowledge_agent",
            "end": "end"
        }
    )

    # 添加边 - 结束节点到END
    graph.add_edge("end", END)

    return graph


class AgentWorkflow:
    """
    Agent工作流

    封装LangGraph工作流的执行
    """

    def __init__(self, use_checkpointer: bool = True):
        """
        初始化工作流

        Args:
            use_checkpointer: 是否使用checkpointer（支持断点恢复）
        """
        self.graph = create_agent_graph()

        # 配置checkpointer
        if use_checkpointer:
            self.checkpointer = MemorySaver()
            self.app = self.graph.compile(checkpointer=self.checkpointer)
        else:
            self.checkpointer = None
            self.app = self.graph.compile()

    def invoke(
        self,
        user_input: str,
        session_id: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        执行工作流

        Args:
            user_input: 用户输入
            session_id: 会话ID
            **kwargs: 其他参数

        Returns:
            执行结果
        """
        session_id = session_id or generate_session_id()

        # 创建初始状态
        initial_state = create_initial_state(
            user_input=user_input,
            session_id=session_id,
            max_iterations=settings.AGENT_MAX_ITERATIONS
        )

        # 配置
        config = {
            "configurable": {
                "thread_id": session_id
            }
        }

        try:
            logger.info(f"开始执行工作流: session={session_id}")

            # 执行
            result = self.app.invoke(initial_state, config=config)

            logger.info(f"工作流完成: session={session_id}")

            return {
                "response": result.get("final_response", ""),
                "session_id": session_id,
                "intent": result.get("intent"),
                "sources": result.get("knowledge_sources", []),
                "confidence": result.get("confidence_score", 0.0),
                "execution_trace": result.get("execution_trace", [])
            }

        except Exception as e:
            logger.error(f"工作流执行失败: {e}")
            return {
                "response": f"处理失败: {str(e)}",
                "session_id": session_id,
                "error": str(e)
            }

    async def ainvoke(
        self,
        user_input: str,
        session_id: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        异步执行工作流

        Args:
            user_input: 用户输入
            session_id: 会话ID
            **kwargs: 其他参数

        Returns:
            执行结果
        """
        session_id = session_id or generate_session_id()

        initial_state = create_initial_state(
            user_input=user_input,
            session_id=session_id,
            max_iterations=settings.AGENT_MAX_ITERATIONS
        )

        config = {
            "configurable": {
                "thread_id": session_id
            }
        }

        try:
            logger.info(f"开始异步执行工作流: session={session_id}")

            result = await self.app.ainvoke(initial_state, config=config)

            logger.info(f"异步工作流完成: session={session_id}")

            return {
                "response": result.get("final_response", ""),
                "session_id": session_id,
                "intent": result.get("intent"),
                "sources": result.get("knowledge_sources", []),
                "confidence": result.get("confidence_score", 0.0),
                "execution_trace": result.get("execution_trace", [])
            }

        except Exception as e:
            logger.error(f"异步工作流执行失败: {e}")
            return {
                "response": f"处理失败: {str(e)}",
                "session_id": session_id,
                "error": str(e)
            }

    async def astream(
        self,
        user_input: str,
        session_id: Optional[str] = None,
        **kwargs
    ):
        """
        流式执行工作流

        Args:
            user_input: 用户输入
            session_id: 会话ID
            **kwargs: 其他参数

        Yields:
            流式事件
        """
        session_id = session_id or generate_session_id()

        initial_state = create_initial_state(
            user_input=user_input,
            session_id=session_id,
            max_iterations=settings.AGENT_MAX_ITERATIONS
        )

        config = {
            "configurable": {
                "thread_id": session_id
            }
        }

        try:
            async for event in self.app.astream_events(
                initial_state,
                config=config,
                version="v2"
            ):
                yield event

        except Exception as e:
            logger.error(f"流式工作流执行失败: {e}")
            yield {
                "event": "error",
                "data": str(e)
            }

    def get_state(self, session_id: str) -> Optional[Dict]:
        """
        获取会话状态

        Args:
            session_id: 会话ID

        Returns:
            会话状态
        """
        if not self.checkpointer:
            return None

        config = {"configurable": {"thread_id": session_id}}

        try:
            state = self.app.get_state(config)
            return state.values if state else None
        except Exception as e:
            logger.error(f"获取状态失败: {e}")
            return None


# 全局工作流实例
_workflow: Optional[AgentWorkflow] = None


def get_workflow() -> AgentWorkflow:
    """获取工作流实例"""
    global _workflow
    if _workflow is None:
        _workflow = AgentWorkflow()
    return _workflow

"""
AgentState 统一状态定义
基于 LangGraph 1.0
"""

from typing import TypedDict, Annotated, List, Optional, Any
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage

from .enums import IntentType, TaskStatus


class SubTask(TypedDict):
    """子任务定义"""
    id: str                      # 任务ID
    agent: str                   # 执行的Agent
    task: str                    # 任务描述
    depends_on: List[str]        # 依赖的任务ID列表
    status: str                  # 任务状态
    result: Optional[Any]        # 执行结果


class KnowledgeSource(TypedDict):
    """知识来源引用"""
    doc_name: str                # 文档名称
    chunk_id: str                # 分块ID
    content: str                 # 内容片段
    score: float                 # 相关性分数
    category: str                # 知识分类


class ExecutionStep(TypedDict):
    """执行轨迹步骤"""
    step: int                    # 步骤序号
    agent: str                   # 执行的Agent
    action: str                  # 执行的动作
    input: Any                   # 输入
    output: Any                  # 输出
    duration_ms: int             # 耗时(毫秒)


class AgentState(TypedDict):
    """统一的Agent状态定义 - LangGraph 1.0"""

    # ===== 消息管理 =====
    messages: Annotated[List[BaseMessage], add_messages]  # 对话历史(自动追加)
    user_input: str                                        # 当前用户输入

    # ===== 意图与任务 =====
    intent: Optional[str]                # 识别的意图类型
    intent_confidence: float             # 意图置信度
    sub_tasks: List[SubTask]             # 分解的子任务列表
    current_task_index: int              # 当前执行的任务索引
    completed_tasks: List[SubTask]       # 已完成的任务

    # ===== 数据存储 =====
    project_data: Optional[dict]         # 项目数据
    pipeline_data: Optional[dict]        # 管道数据
    pump_station_data: Optional[dict]    # 泵站数据
    oil_property_data: Optional[dict]    # 油品数据
    calculation_result: Optional[dict]   # 计算结果
    optimization_result: Optional[dict]  # 优化结果

    # ===== 知识检索 =====
    knowledge_context: Optional[str]     # 知识检索结果(合并后的文本)
    knowledge_sources: List[KnowledgeSource]  # 引用来源列表
    retrieval_quality: Optional[str]     # CRAG评估的检索质量

    # ===== 流程控制 =====
    next_agent: Optional[str]            # 下一个执行的Agent
    should_retrieve: bool                # Self-RAG: 是否需要检索
    should_calculate: bool               # 是否需要调用计算服务
    iteration: int                       # 当前迭代次数
    max_iterations: int                  # 最大迭代次数(防止死循环)

    # ===== 错误处理 =====
    error_message: Optional[str]         # 错误信息
    error_count: int                     # 错误计数
    last_error_agent: Optional[str]      # 最后出错的Agent

    # ===== Memory =====
    session_id: str                      # 会话ID
    chat_history_summary: Optional[str]  # 历史对话摘要(长对话压缩)

    # ===== 输出 =====
    final_response: Optional[str]        # 最终响应
    confidence_score: float              # 回答置信度
    execution_trace: List[ExecutionStep] # 执行轨迹(用于调试)


def create_initial_state(
    user_input: str,
    session_id: str,
    max_iterations: int = 10
) -> AgentState:
    """创建初始状态"""
    return AgentState(
        messages=[],
        user_input=user_input,
        intent=None,
        intent_confidence=0.0,
        sub_tasks=[],
        current_task_index=0,
        completed_tasks=[],
        project_data=None,
        pipeline_data=None,
        pump_station_data=None,
        oil_property_data=None,
        calculation_result=None,
        optimization_result=None,
        knowledge_context=None,
        knowledge_sources=[],
        retrieval_quality=None,
        next_agent=None,
        should_retrieve=False,
        should_calculate=False,
        iteration=0,
        max_iterations=max_iterations,
        error_message=None,
        error_count=0,
        last_error_agent=None,
        session_id=session_id,
        chat_history_summary=None,
        final_response=None,
        confidence_score=0.0,
        execution_trace=[]
    )

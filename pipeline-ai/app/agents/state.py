from typing import TypedDict, Annotated, Sequence
from langchain.schema import BaseMessage
import operator

class AgentState(TypedDict):
    """
    LangGraph 代理状态定义
    """
    messages: Annotated[Sequence[BaseMessage], operator.add]
    next_step: str

"""
ReAct 主图 —— pipeline-agent v5.0 核心工作流。

架构：
  START --> agent --> tools_condition --> tools --> agent（循环）
                                     -> __end__（结束）

LLM 通过 bind_tools(tool_choice="auto") 自行决定是否调用工具。
简单问候/闲聊不会触发任何工具调用。
复杂多步任务通过调用 plan_complex_task 工具进入 Plan-Execute 子图。
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from langchain_core.messages import AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import MessagesState, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from src.config import settings
from src.tools.agent_tools import REACT_TOOLS
from src.utils import generate_session_id, logger


# ═══════════════════════════════════════════════════════════════
# System Prompt — 唯一一份，给 ReAct Agent 用
# ═══════════════════════════════════════════════════════════════

REACT_SYSTEM_PROMPT = """你是管道能耗分析智能助手。

## 你的能力
你可以通过以下工具完成任务：
1. query_database — 查询数据库中的项目、管道、泵站、油品数据
2. hydraulic_calculation — 执行水力计算（雷诺数、摩阻、压降、泵优化）
3. search_knowledge_base — 检索管道工程知识库（规范、标准、原理）
4. query_knowledge_graph — 通过知识图谱进行故障因果推理和关系查询
5. run_sensitivity_analysis — 执行敏感性分析
6. plan_complex_task — 对需要 3 步以上的复杂任务进行规划和执行

## 核心规则
1. **只在用户的问题确实需要外部数据、计算或知识检索时才调用工具**
2. 对于问候（你好/hello/hi）、闲聊、感谢、告别、常识问题，直接用文本回复，绝对不要调用任何工具
3. 执行计算前如果缺少管道参数，先调用 query_database 获取
4. 只有真正需要多步协作（查数据→计算→对比→出报告）的复杂任务才使用 plan_complex_task
5. 用与用户相同的语言回答
6. 数值结果保留合适的有效数字并带单位

## 回答风格
- 简洁专业，不冗长
- 计算结果解释物理意义
- 引用规范时注明出处编号
"""


# ═══════════════════════════════════════════════════════════════
# 规则快速路径 — 零成本拦截纯闲聊
# ═══════════════════════════════════════════════════════════════

_CHAT_PHRASES = frozenset(
    [
        "你好",
        "hello",
        "hi",
        "嗨",
        "在吗",
        "在不在",
        "谢谢",
        "感谢",
        "thanks",
        "thank you",
        "再见",
        "拜拜",
        "bye",
        "goodbye",
        "你是谁",
        "你叫什么",
        "你能做什么",
        "帮我什么",
        "好的",
        "ok",
        "嗯",
        "哦",
        "哈哈",
        "呵呵",
        "早上好",
        "下午好",
        "晚上好",
        "good morning",
        "你好啊",
        "hi there",
        "hey",
    ]
)

_DOMAIN_KEYWORDS = frozenset(
    [
        "管道",
        "泵站",
        "油品",
        "项目",
        "压力",
        "流量",
        "计算",
        "优化",
        "水力",
        "摩阻",
        "粘度",
        "密度",
        "能耗",
        "分析",
        "诊断",
        "故障",
        "报告",
        "雷诺",
        "扬程",
        "排量",
        "粗糙度",
        "壁厚",
        "管径",
        "查询",
        "数据",
        "参数",
        "规范",
        "标准",
        "公式",
        "碳排放",
        "敏感性",
        "方案",
        "对比",
        "监控",
        "知识图谱",
        "因果",
        "pipeline",
        "pump",
        "hydraulic",
        "reynolds",
        "friction",
    ]
)

_SUFFIXES_TO_STRIP = "!！?？~。.，,、 \t\n"


def _is_trivial_chat(text: str) -> bool:
    """
    规则快速路径：识别不需要调 LLM 的纯闲聊。
    返回 True 表示应直接返回硬编码回复。
    """
    t = text.strip().lower().strip(_SUFFIXES_TO_STRIP)
    if not t:
        return True
    if t in _CHAT_PHRASES:
        return True
    # 短输入 + 无领域关键词 → 大概率闲聊
    if len(t) <= 10 and not any(k in t for k in _DOMAIN_KEYWORDS):
        return True
    return False


def _quick_chat_response(text: str) -> str:
    """根据闲聊类型生成硬编码回复。"""
    t = text.strip().lower()

    if any(w in t for w in ["你好", "hello", "hi", "嗨", "早上好", "下午好", "晚上好", "hey"]):
        return (
            "你好！我是管道能耗分析智能助手，可以帮你：\n\n"
            "- **数据查询** — 项目、管道、泵站、油品参数\n"
            "- **水力计算** — 雷诺数、摩阻、压降分析\n"
            "- **泵站优化** — 最优泵组合方案\n"
            "- **知识问答** — 管道工程规范、标准、原理\n"
            "- **故障诊断** — 异常工况因果分析\n"
            "- **敏感性分析** — 参数变化对结果的影响\n\n"
            "请描述你的需求。"
        )

    if any(w in t for w in ["谢谢", "感谢", "thanks", "thank you"]):
        return "不客气！还有其他管道分析需求可以继续问我。"

    if any(w in t for w in ["再见", "拜拜", "bye", "goodbye"]):
        return "再见！有需要随时来找我。"

    if any(w in t for w in ["你是谁", "你叫什么", "你能做什么", "帮我什么"]):
        return (
            "我是管道能耗分析智能助手，核心能力包括：\n\n"
            "1. **水力计算** — 雷诺数、沿程摩阻、泵扬程等\n"
            "2. **泵站优化** — 自动搜索最优泵组合方案\n"
            "3. **数据查询** — 项目、管道、泵站、油品参数查询\n"
            "4. **故障诊断** — 基于知识图谱的因果推理\n"
            "5. **知识问答** — 管道工程规范、标准、原理检索\n"
            "6. **报告生成** — 自动生成分析报告\n\n"
            "请问有什么可以帮您？"
        )

    return "好的，请问有什么管道能耗方面的问题需要我帮忙分析？"


# ═══════════════════════════════════════════════════════════════
# LLM 实例
# ═══════════════════════════════════════════════════════════════

_llm_with_tools = None


def _get_llm_with_tools():
    """返回绑定了工具的 LLM 单例。tool_choice 默认为 "auto"。"""
    global _llm_with_tools
    if _llm_with_tools is None:
        llm = ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE,
            model=settings.LLM_MODEL,
            temperature=0,
            max_tokens=4096,
        )
        _llm_with_tools = llm.bind_tools(REACT_TOOLS)  # tool_choice 默认 "auto"
    return _llm_with_tools


# ═══════════════════════════════════════════════════════════════
# 图节点
# ═══════════════════════════════════════════════════════════════


def agent_node(state: MessagesState) -> dict:
    """
    ReAct Agent 核心节点。

    执行逻辑：
    1. 如果当前轮用户输入命中规则快速路径 → 直接返回硬编码回复（0 次 LLM 调用）
    2. 否则调用 LLM（带 bind_tools），LLM 自行决定是否调用工具
    """
    messages = state["messages"]

    # ── 快速路径：每轮入口若为 human 消息则可直接拦截 ──
    if messages and getattr(messages[-1], "type", "") == "human":
        user_text = messages[-1].content
        if _is_trivial_chat(user_text):
            return {"messages": [AIMessage(content=_quick_chat_response(user_text))]}

    # ── 正常路径：调 LLM ──
    llm = _get_llm_with_tools()
    full_messages = [SystemMessage(content=REACT_SYSTEM_PROMPT)] + list(messages)
    response = llm.invoke(full_messages)
    return {"messages": [response]}


# ═══════════════════════════════════════════════════════════════
# 构建主图
# ═══════════════════════════════════════════════════════════════


def create_react_graph() -> StateGraph:
    """
    构建 ReAct 主图。

    结构：
      START --> agent --> tools_condition --> tools --> agent（循环）
                                          -> __end__（结束）
    """
    graph = StateGraph(MessagesState)

    graph.add_node("agent", agent_node)
    graph.add_node("tools", ToolNode(REACT_TOOLS))

    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", tools_condition)
    graph.add_edge("tools", "agent")

    return graph


# ═══════════════════════════════════════════════════════════════
# Workflow 封装（对外接口保持兼容）
# ═══════════════════════════════════════════════════════════════


class AgentWorkflow:
    """
    Agent 工作流封装。
    对外暴露 invoke / ainvoke / get_state 接口。
    """

    def __init__(self):
        self.graph = create_react_graph()
        self.checkpointer = MemorySaver()
        self.app = self.graph.compile(checkpointer=self.checkpointer)

    def invoke(
        self,
        user_input: str,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """同步调用。"""
        session_id = session_id or generate_session_id()
        config = {"configurable": {"thread_id": session_id}}

        try:
            result = self.app.invoke(
                {"messages": [{"role": "user", "content": user_input}]},
                config=config,
            )
            return self._build_response(result, session_id, trace_id)
        except Exception as exc:
            logger.error(f"Workflow invoke failed: {exc}")
            return {
                "response": f"处理失败: {exc}",
                "session_id": session_id,
                "trace_id": trace_id or "",
                "error": str(exc),
            }

    async def ainvoke(
        self,
        user_input: str,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """异步调用。"""
        session_id = session_id or generate_session_id()
        config = {"configurable": {"thread_id": session_id}}

        try:
            result = await self.app.ainvoke(
                {"messages": [{"role": "user", "content": user_input}]},
                config=config,
            )
            return self._build_response(result, session_id, trace_id)
        except Exception as exc:
            logger.error(f"Workflow ainvoke failed: {exc}")
            return {
                "response": f"处理失败: {exc}",
                "session_id": session_id,
                "trace_id": trace_id or "",
                "error": str(exc),
            }

    async def resume_from_hitl(self, session_id: str, response: dict) -> Dict[str, Any]:
        """兼容旧接口：ReAct 主图默认不支持主图级 HITL 恢复。"""

        logger.warning("resume_from_hitl called in ReAct workflow; not supported in main graph")
        return {
            "response": "当前 ReAct 主图不支持从主图断点恢复，请重新发起任务。",
            "session_id": session_id,
            "trace_id": "",
            "intent": "chat",
            "sources": [],
            "confidence": 0.5,
            "tool_calls": [],
            "hitl_response": response,
        }

    def get_state(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取 checkpointer 中的会话状态。"""
        config = {"configurable": {"thread_id": session_id}}
        try:
            state = self.app.get_state(config)
            return state.values if state else None
        except Exception as exc:
            logger.error(f"Failed to get state: {exc}")
            return None

    @staticmethod
    def _build_response(
        result: dict,
        session_id: str,
        trace_id: Optional[str],
    ) -> Dict[str, Any]:
        """从 MessagesState 结果构建统一响应格式。"""
        messages = result.get("messages", [])
        final_message = messages[-1] if messages else None
        response_text = final_message.content if final_message else ""

        # 仅提取“最后一条用户消息之后”的工具调用，避免混入历史轮次
        current_turn_messages = messages
        for idx in range(len(messages) - 1, -1, -1):
            msg = messages[idx]
            if getattr(msg, "type", "") == "human":
                current_turn_messages = messages[idx + 1 :]
                break

        # 提取本轮工具调用记录
        tool_calls = []
        for msg in current_turn_messages:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_calls.append(
                        {
                            "tool": tc.get("name", ""),
                            "args": tc.get("args", {}),
                        }
                    )

        # 推断 intent
        intent = "chat"
        if tool_calls:
            tool_names = {tc["tool"] for tc in tool_calls}
            if "plan_complex_task" in tool_names:
                intent = "complex"
            elif "hydraulic_calculation" in tool_names or "run_sensitivity_analysis" in tool_names:
                intent = "calculate"
            elif "query_database" in tool_names:
                intent = "query"
            elif "search_knowledge_base" in tool_names:
                intent = "knowledge"
            elif "query_knowledge_graph" in tool_names:
                intent = "knowledge"

        return {
            "response": response_text,
            "session_id": session_id,
            "trace_id": trace_id or "",
            "intent": intent,
            "sources": [],
            "confidence": 0.85 if tool_calls else 0.95,
            "tool_calls": tool_calls,
        }


# ═══════════════════════════════════════════════════════════════
# 单例
# ═══════════════════════════════════════════════════════════════

_workflow: Optional[AgentWorkflow] = None


def get_workflow() -> AgentWorkflow:
    """返回单例 AgentWorkflow。"""
    global _workflow
    if _workflow is None:
        _workflow = AgentWorkflow()
    return _workflow

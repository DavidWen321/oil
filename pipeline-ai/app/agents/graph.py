from langgraph.graph import StateGraph, END
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema import HumanMessage, SystemMessage
from app.config import settings
from app.agents.state import AgentState
from app.agents.tools import ALL_TOOLS
from langchain.agents import AgentExecutor, create_openai_tools_agent

# 初始化 LLM
llm = ChatOpenAI(
    openai_api_key=settings.OPENAI_API_KEY,
    openai_api_base=settings.OPENAI_API_BASE,
    model_name=settings.MODEL_NAME,
    temperature=0
)

# 1. 定义 Agent 节点

def create_agent(llm, tools, system_prompt):
    """创建通用的 Tool Agent"""
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder(variable_name="messages"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    agent = create_openai_tools_agent(llm, tools, prompt)
    return AgentExecutor(agent=agent, tools=tools)

# --- Router / Orchestrator (简单的基于 LLM 的路由) ---
def router_node(state: AgentState):
    """
    路由节点：分析用户意图，决定下一步去哪里
    """
    messages = state['messages']
    last_message = messages[-1]
    
    # 这里可以使用更复杂的 LLM 决策，简化起见，我们让 LLM 直接分类
    # 或者直接使用一个通用的 Agent 来处理所有事情，如果需要专门化，则分发
    
    # 在这个简化版本中，我们使用一个统一的 "Super Agent" 拥有所有工具
    # 实际生产中可以使用 LangGraph 的条件边进行路由
    return {"next_step": "general_agent"}

# --- General Agent (拥有所有工具) ---
system_prompt = """你是一个专业的管道能耗分析系统智能助手。
你可以访问数据库查询项目数据，访问知识库查询文档，以及调用计算服务进行水力分析。
请根据用户的问题，选择合适的工具进行回答。
如果需要查询数据库，请先查看表结构（虽然你已经知道 schema）。
回答要专业、简洁，并使用中文。
"""
general_agent_executor = create_agent(llm, ALL_TOOLS, system_prompt)

def general_agent_node(state: AgentState):
    result = general_agent_executor.invoke({"messages": state['messages']})
    return {"messages": [result['output']]}

# 2. 构建图
workflow = StateGraph(AgentState)

workflow.add_node("router", router_node)
workflow.add_node("general_agent", general_agent_node)

workflow.set_entry_point("router")

workflow.add_edge("router", "general_agent")
workflow.add_edge("general_agent", END)

app_graph = workflow.compile()

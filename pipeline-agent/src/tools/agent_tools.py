"""
ReAct 主图可用的工具集。
所有工具使用 @tool 装饰器定义，由 LLM 通过 bind_tools 自主决定调用。
"""

from __future__ import annotations

from typing import Any, Dict, List

from langchain_core.tools import tool

from src.agents import (
    get_calc_agent,
    get_data_agent,
    get_graph_agent,
    get_knowledge_agent,
)
from src.tools.error_handler import safe_tool_call
from src.utils import logger


# ═══════════════════════════════════════════════════════════════
# 数据库查询工具
# ═══════════════════════════════════════════════════════════════


@tool
@safe_tool_call("query_database")
def query_database(question: str) -> str:
    """查询数据库获取项目、管道、泵站、油品的具体数据。

    当用户询问具体的项目信息、管道参数（直径、长度、壁厚）、
    泵站配置（效率、排量、扬程）、油品属性（密度、粘度）等
    存储在数据库中的结构化数据时使用此工具。

    Args:
        question: 数据查询问题，如"查询项目A的管道直径"、"有哪些项目"
    """
    try:
        agent = get_data_agent()
        result = agent.execute(question)
        return result
    except Exception as e:
        logger.error(f"query_database failed: {e}")
        return f"数据库查询失败: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# 水力计算工具
# ═══════════════════════════════════════════════════════════════


@tool
@safe_tool_call("hydraulic_calculation")
def hydraulic_calculation(question: str) -> str:
    """执行管道水力计算，包括雷诺数、沿程摩阻、压降分析、泵站优化。

    当用户需要进行水力学相关的工程计算时使用此工具。
    支持的计算类型：雷诺数计算、摩阻系数计算、沿程水头损失、
    泵站扬程需求、泵组合优化方案搜索。

    Args:
        question: 计算需求描述，如"计算流量800时的雷诺数和摩阻"
    """
    try:
        agent = get_calc_agent()
        result = agent.execute(question)
        return result
    except Exception as e:
        logger.error(f"hydraulic_calculation failed: {e}")
        return f"水力计算失败: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# 知识库检索工具
# ═══════════════════════════════════════════════════════════════


@tool
@safe_tool_call("search_knowledge_base")
def search_knowledge_base(question: str) -> str:
    """检索管道工程知识库，获取规范、标准、原理、公式等专业知识。

    当用户询问管道工程领域的专业知识、行业标准、设计规范、
    计算公式的理论依据、工程原理解释等内容时使用此工具。

    Args:
        question: 知识检索问题，如"管道摩阻系数的计算公式是什么"
    """
    try:
        agent = get_knowledge_agent()
        result = agent.execute(question)
        return result
    except Exception as e:
        logger.error(f"search_knowledge_base failed: {e}")
        return f"知识库检索失败: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# 知识图谱工具 — 拆分为 3 个独立工具，由 LLM 自主选择
# ═══════════════════════════════════════════════════════════════


@tool
@safe_tool_call("query_fault_cause")
def query_fault_cause(query: str) -> str:
    """通过知识图谱进行故障因果推理。

    当用户询问某个故障的原因、某个异常现象的因果链、
    设备故障的根因分析等问题时使用此工具。

    Args:
        query: 故障查询，如"泵站压力异常的可能原因"、"管道泄漏的因果分析"
    """
    try:
        agent = get_graph_agent()
        result = agent.execute(query, query_type="fault_cause")
        return result
    except Exception as e:
        logger.error(f"query_fault_cause failed: {e}")
        return f"故障因果查询失败: {str(e)}"


@tool
@safe_tool_call("query_standards")
def query_standards(query: str) -> str:
    """通过知识图谱查询相关标准规范。

    当用户询问某个操作或设计应遵循的标准、规范要求、
    合规性检查等问题时使用此工具。

    Args:
        query: 标准查询，如"管道设计压力的标准要求"、"泵站运行规范"
    """
    try:
        agent = get_graph_agent()
        result = agent.execute(query, query_type="standards")
        return result
    except Exception as e:
        logger.error(f"query_standards failed: {e}")
        return f"标准规范查询失败: {str(e)}"


@tool
@safe_tool_call("query_equipment_chain")
def query_equipment_chain(query: str) -> str:
    """通过知识图谱查询设备关联链路。

    当用户询问设备之间的关联关系、上下游设备链路、
    设备依赖关系等问题时使用此工具。

    Args:
        query: 设备查询，如"泵站A的上下游设备链路"、"阀门与管道的关联关系"
    """
    try:
        agent = get_graph_agent()
        result = agent.execute(query, query_type="equipment_chain")
        return result
    except Exception as e:
        logger.error(f"query_equipment_chain failed: {e}")
        return f"设备链路查询失败: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# 敏感性分析工具
# ═══════════════════════════════════════════════════════════════


@tool
@safe_tool_call("run_sensitivity_analysis")
def run_sensitivity_analysis(question: str) -> str:
    """执行参数敏感性分析，研究单个参数变化对水力计算结果的影响。

    当用户需要分析某个参数（流量、密度、粘度、管径、粗糙度）
    变化时对计算结果的影响程度时使用此工具。

    Args:
        question: 分析需求，如"分析流量变化对摩阻的影响"
    """
    try:
        from src.tools.extended_tools import call_sensitivity_analysis

        return call_sensitivity_analysis.invoke(question)
    except Exception as e:
        logger.error(f"run_sensitivity_analysis failed: {e}")
        return f"敏感性分析失败: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# 复杂任务规划工具
# ═══════════════════════════════════════════════════════════════


@tool
@safe_tool_call("plan_complex_task")
def plan_complex_task(task_description: str) -> str:
    """对需要多步协作的复杂任务进行规划和分步执行。

    当用户的需求需要多个步骤协作完成时使用此工具，例如：
    "查询项目A的数据，然后计算水力参数，再对比不同方案，最后生成报告"。
    单步任务不要使用此工具。

    Args:
        task_description: 完整的任务描述
    """
    try:
        from src.workflows.subgraph import run_plan_execute

        return run_plan_execute(task_description)
    except Exception as e:
        logger.error(f"plan_complex_task failed: {e}")
        return f"复杂任务执行失败: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# 工具列表 — 供 graph.py 中 bind_tools 使用
# ═══════════════════════════════════════════════════════════════

REACT_TOOLS = [
    query_database,
    hydraulic_calculation,
    search_knowledge_base,
    query_fault_cause,
    query_standards,
    query_equipment_chain,
    run_sensitivity_analysis,
    plan_complex_task,
]

TOOL_NAME_TO_TOOL = {tool.name: tool for tool in REACT_TOOLS}

# 高频核心工具常驻，避免检索误差导致关键能力不可用。
ALWAYS_LOADED_TOOL_NAMES = ["query_database"]

# Tool Search Tool 使用的元数据注册表（可逐步扩展到 MCP 生态）。
TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "query_database": {
        "description": "查询数据库中的项目、管道、泵站、油品等结构化数据",
        "keywords": ["数据库", "SQL", "项目", "管道", "泵站", "油品", "数据", "查询"],
        "category": "data",
        "defer_loading": False,
        "usage_frequency": 0.90,
        "input_examples": [
            {"question": "查询项目A的所有管道直径和长度"},
            {"question": "统计各泵站的平均效率"},
        ],
    },
    "hydraulic_calculation": {
        "description": "执行水力计算，包括雷诺数、摩阻、压降与泵站优化",
        "keywords": ["水力", "计算", "雷诺", "摩阻", "压降", "流量", "泵", "扬程"],
        "category": "calculation",
        "defer_loading": True,
        "usage_frequency": 0.75,
        "input_examples": [
            {"question": "计算流量1200m3/h时的雷诺数和沿程压降"},
            {"question": "对比两种泵组合在同流量下的扬程需求"},
        ],
    },
    "search_knowledge_base": {
        "description": "检索管道工程知识库中的标准、规范、原理和公式",
        "keywords": ["知识库", "标准", "规范", "原理", "公式", "检索", "依据"],
        "category": "knowledge",
        "defer_loading": True,
        "usage_frequency": 0.55,
        "input_examples": [
            {"question": "达西摩阻系数的适用范围是什么"},
            {"question": "输油管道设计压力有哪些规范要求"},
        ],
    },
    "query_fault_cause": {
        "description": "通过知识图谱分析故障因果链和根因",
        "keywords": ["故障", "根因", "因果", "异常", "诊断", "原因"],
        "category": "graph",
        "defer_loading": True,
        "usage_frequency": 0.42,
        "input_examples": [
            {"query": "泵站出口压力波动的可能根因"},
            {"query": "管道泄漏报警与阀门异常的因果链"},
        ],
    },
    "query_standards": {
        "description": "通过知识图谱查询相关标准规范与合规要求",
        "keywords": ["标准", "规范", "合规", "要求", "条款"],
        "category": "graph",
        "defer_loading": True,
        "usage_frequency": 0.40,
        "input_examples": [
            {"query": "输油管道允许压力偏差的标准条款"},
            {"query": "泵站运行维护频次规范"},
        ],
    },
    "query_equipment_chain": {
        "description": "通过知识图谱查询设备上下游关联链路",
        "keywords": ["设备", "链路", "上下游", "关联", "依赖"],
        "category": "graph",
        "defer_loading": True,
        "usage_frequency": 0.38,
        "input_examples": [
            {"query": "泵站A的上下游设备链路"},
            {"query": "阀门V-21关联的关键设备"},
        ],
    },
    "run_sensitivity_analysis": {
        "description": "执行参数敏感性分析，评估变量变化对结果影响",
        "keywords": ["敏感性", "参数变化", "影响", "分析", "对比"],
        "category": "analysis",
        "defer_loading": True,
        "usage_frequency": 0.48,
        "input_examples": [
            {"question": "分析流量变化对摩阻损失的敏感性"},
            {"question": "比较密度和粘度变化对压降影响"},
        ],
    },
    "plan_complex_task": {
        "description": "对复杂多步骤任务进行规划并执行",
        "keywords": ["复杂任务", "步骤", "规划", "多步", "报告", "方案"],
        "category": "orchestration",
        "defer_loading": True,
        "usage_frequency": 0.34,
        "input_examples": [
            {"task_description": "先查项目参数，再做水力计算，最后输出优化报告"},
            {"task_description": "对比三种泵方案并给出推荐和风险说明"},
        ],
    },
}


def get_tools_by_names(tool_names: List[str]) -> List[Any]:
    """Return tools by name while preserving order and removing duplicates."""
    selected: List[Any] = []
    seen = set()
    for name in tool_names:
        if name in seen:
            continue
        tool_obj = TOOL_NAME_TO_TOOL.get(name)
        if tool_obj is None:
            continue
        selected.append(tool_obj)
        seen.add(name)
    return selected


def get_all_tool_names() -> List[str]:
    return list(TOOL_NAME_TO_TOOL.keys())

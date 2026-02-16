"""
ReAct 主图的顶层工具定义。
每个工具封装一个现有 Agent 的核心能力，通过 @tool 装饰器暴露给 LLM。
LLM 通过工具的 docstring 判断是否调用——这是实现"语义感知工具调用"的关键。
"""

import json

from langchain_core.tools import tool

from src.utils import logger


@tool
def query_database(question: str) -> str:
    """查询管道能耗系统数据库，获取项目、管道、泵站、油品等业务数据。

    使用场景举例：
    - "有哪些项目" → 调用此工具
    - "1号管道的参数" → 调用此工具
    - "查询泵站效率" → 调用此工具
    - "有多少条管道" → 调用此工具

    不要在以下场景使用：
    - 问候语（你好/hello）
    - 专业概念解释（什么是雷诺数）→ 用 search_knowledge_base
    - 执行计算 → 用 hydraulic_calculation

    Args:
        question: 用户的数据查询需求，自然语言描述
    """
    from src.agents import get_data_agent

    try:
        return get_data_agent().execute(question)
    except Exception as e:
        logger.error(f"query_database failed: {e}")
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def hydraulic_calculation(task_description: str, available_data: str = "{}") -> str:
    """执行管道水力计算，包括雷诺数、沿程摩阻、压降分析、泵站优化。

    使用场景举例：
    - "计算雷诺数" → 调用此工具
    - "分析1号管道在500m³/h流量下的压降" → 调用此工具
    - "优化泵站配置" → 调用此工具
    - "计算摩阻损失" → 调用此工具

    注意：如果用户未提供管道参数（管径、长度、油品粘度等），请先调用
    query_database 获取参数，然后将查询结果作为 available_data 传入此工具。

    不要在以下场景使用：
    - 问候语
    - 查询数据但不需要计算 → 用 query_database
    - 知识概念解释 → 用 search_knowledge_base

    Args:
        task_description: 计算任务的完整描述
        available_data: 已有数据的 JSON 字符串，格式为
            {"pipeline": {...}, "oil": {...}, "pump_station": {...}}
            如果没有已有数据，传入 "{}" 即可
    """
    from src.agents import get_calc_agent

    try:
        data = json.loads(available_data) if available_data else {}
    except (json.JSONDecodeError, TypeError):
        data = {}

    try:
        return get_calc_agent().execute(task_description, available_data=data)
    except Exception as e:
        logger.error(f"hydraulic_calculation failed: {e}")
        return f"计算失败: {str(e)}"


@tool
def search_knowledge_base(query: str) -> str:
    """检索管道工程知识库，回答专业概念、规范标准、工程原理问题。

    使用场景举例：
    - "什么是雷诺数" → 调用此工具
    - "GB50251有什么规定" → 调用此工具
    - "泵的汽蚀是什么原理" → 调用此工具
    - "管道摩阻计算的公式" → 调用此工具

    不要在以下场景使用：
    - 问候语（你好/hello）→ 直接回复，不调任何工具
    - 查询具体业务数据（1号管道多长）→ 用 query_database
    - 执行具体数值计算 → 用 hydraulic_calculation

    Args:
        query: 专业知识查询问题
    """
    from src.agents import get_knowledge_agent

    try:
        return get_knowledge_agent().execute(query)
    except Exception as e:
        logger.error(f"search_knowledge_base failed: {e}")
        return f"知识检索失败: {str(e)}"


@tool
def query_knowledge_graph(query: str) -> str:
    """通过知识图谱进行关系查询和因果推理。

    使用场景举例：
    - "压力异常的原因有哪些" → 调用此工具
    - "泵故障的因果关系" → 调用此工具
    - "管道设备之间的连接关系" → 调用此工具

    不要在以下场景使用：
    - 问候语
    - 查询具体数值数据 → 用 query_database
    - 不涉及"关系""因果""故障原因"的普通知识问题 → 用 search_knowledge_base

    Args:
        query: 关系或因果查询问题
    """
    from src.agents import get_graph_agent

    try:
        result = get_graph_agent().execute(query)
        if isinstance(result, dict):
            return json.dumps(result, ensure_ascii=False, default=str)
        return str(result)
    except Exception as e:
        logger.error(f"query_knowledge_graph failed: {e}")
        return f"知识图谱查询失败: {str(e)}"


@tool
def run_sensitivity_analysis(
    flow_rate: float,
    pipe_diameter: float,
    pipe_length: float,
    oil_density: float,
    oil_viscosity: float,
    roughness: float,
    start_elevation: float,
    end_elevation: float,
    inlet_pressure: float,
    pump_480_num: int,
    pump_375_num: int,
    pump_480_head: float,
    pump_375_head: float,
    variable_type: str,
    start_percent: float = 80.0,
    end_percent: float = 120.0,
    step_percent: float = 5.0,
) -> str:
    """执行敏感性分析，研究某个变量变化对水力计算结果的影响。

    使用场景：用户明确要求做"敏感性分析"或"参数敏感度研究"时才使用。
    需要所有管道参数和泵站参数作为输入。如果用户没提供，先用 query_database 获取。

    Args:
        flow_rate: 流量(m³/h)
        pipe_diameter: 管道外径(mm)
        pipe_length: 管道长度(km)
        oil_density: 油品密度(kg/m³)
        oil_viscosity: 油品粘度(m²/s)
        roughness: 粗糙度(m)
        start_elevation: 起点高程(m)
        end_elevation: 终点高程(m)
        inlet_pressure: 首站进站压头(m)
        pump_480_num: ZMI480泵数量
        pump_375_num: ZMI375泵数量
        pump_480_head: ZMI480单泵扬程(m)
        pump_375_head: ZMI375单泵扬程(m)
        variable_type: 要分析的变量类型，可选值: flow_rate/diameter/viscosity/density/roughness/length
        start_percent: 变化起始百分比(默认80)
        end_percent: 变化结束百分比(默认120)
        step_percent: 变化步长百分比(默认5)
    """
    from src.tools.extended_tools import call_sensitivity_analysis as _call

    try:
        return _call.invoke(
            {
                "flow_rate": flow_rate,
                "pipe_diameter": pipe_diameter,
                "pipe_length": pipe_length,
                "oil_density": oil_density,
                "oil_viscosity": oil_viscosity,
                "roughness": roughness,
                "start_elevation": start_elevation,
                "end_elevation": end_elevation,
                "inlet_pressure": inlet_pressure,
                "pump_480_num": pump_480_num,
                "pump_375_num": pump_375_num,
                "pump_480_head": pump_480_head,
                "pump_375_head": pump_375_head,
                "variable_type": variable_type,
                "start_percent": start_percent,
                "end_percent": end_percent,
                "step_percent": step_percent,
            }
        )
    except Exception as e:
        logger.error(f"run_sensitivity_analysis failed: {e}")
        return f"敏感性分析失败: {str(e)}"


@tool
def plan_complex_task(task_description: str) -> str:
    """对复杂的多步骤任务进行规划和执行。进入 Plan-and-Execute 模式。

    仅在以下场景使用此工具：
    - 用户要求"全面分析"某条管道（需要 查数据→计算→对比→生成报告）
    - 用户要求"生成优化报告"（需要多个 agent 协作）
    - 用户要求"对比多个泵站方案"（需要多次计算+汇总）
    - 任务明确需要 3 个以上步骤才能完成

    不要在以下场景使用此工具：
    - 单步数据查询 → 用 query_database
    - 单步计算 → 用 hydraulic_calculation
    - 单步知识问答 → 用 search_knowledge_base
    - 问候或闲聊

    Args:
        task_description: 完整的复杂任务描述，包含用户的具体需求
    """
    from src.workflows.subgraph import run_plan_execute

    try:
        return run_plan_execute(task_description)
    except Exception as e:
        logger.error(f"plan_complex_task failed: {e}")
        return f"复杂任务执行失败: {str(e)}"


# 工具列表，供 graph.py 导入
REACT_TOOLS = [
    query_database,
    hydraulic_calculation,
    search_knowledge_base,
    query_knowledge_graph,
    run_sensitivity_analysis,
    plan_complex_task,
]

"""
扩展工具模块
提供敏感性分析、报告生成、统计查询、历史查询等高级功能
"""

from typing import Optional
from langchain_core.tools import tool
import httpx

from src.config import settings
from src.utils import logger
from src.tools.java_service_tools import get_java_client


# ==================== 敏感性分析工具 ====================

@tool
def call_sensitivity_analysis(
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
    start_percent: float = -20.0,
    end_percent: float = 20.0,
    step_percent: float = 5.0
) -> str:
    """
    调用敏感性分析服务，分析单个变量变化对水力计算结果的影响

    Args:
        flow_rate: 流量 (m³/h)
        pipe_diameter: 管道外径 (mm)
        pipe_length: 管道长度 (km)
        oil_density: 油品密度 (kg/m³)
        oil_viscosity: 运动粘度 (m²/s)
        roughness: 管道粗糙度 (mm)
        start_elevation: 起点高程 (m)
        end_elevation: 终点高程 (m)
        inlet_pressure: 首站进站压头 (m)
        pump_480_num: ZMI480泵数量
        pump_375_num: ZMI375泵数量
        pump_480_head: ZMI480单泵扬程 (m)
        pump_375_head: ZMI375单泵扬程 (m)
        variable_type: 变量类型 (FLOW_RATE/OIL_DENSITY/OIL_VISCOSITY/PIPE_DIAMETER/PIPE_ROUGHNESS)
        start_percent: 变化起始百分比，默认-20%
        end_percent: 变化结束百分比，默认20%
        step_percent: 变化步长百分比，默认5%

    Returns:
        敏感性分析结果，包括各参数点的计算结果和敏感性系数
    """
    try:
        client = get_java_client()

        # 构造基准参数
        base_params = {
            "flowRate": flow_rate,
            "diameter": pipe_diameter,
            "thickness": 10,  # 默认壁厚
            "length": pipe_length,
            "density": oil_density,
            "viscosity": oil_viscosity,
            "roughness": roughness,
            "startAltitude": start_elevation,
            "endAltitude": end_elevation,
            "inletPressure": inlet_pressure,
            "pump480Num": pump_480_num,
            "pump375Num": pump_375_num,
            "pump480Head": pump_480_head,
            "pump375Head": pump_375_head
        }

        # 构造敏感性变量
        variable = {
            "variableType": variable_type,
            "startPercent": start_percent,
            "endPercent": end_percent,
            "stepPercent": step_percent
        }

        request_data = {
            "baseParams": base_params,
            "variables": [variable],
            "analysisType": "SINGLE"
        }

        logger.info(f"调用敏感性分析API: variable={variable_type}")

        response = client.call_api(
            "/calculation/sensitivity/analyze",
            method="POST",
            data=request_data
        )

        if response.get("code") != 200:
            return f"分析失败: {response.get('msg', '未知错误')}"

        result = response.get("data", {})
        var_results = result.get("variableResults", [])
        rankings = result.get("sensitivityRanking", [])

        output = "敏感性分析结果:\n\n"

        # 变量分析结果
        for var_result in var_results:
            output += f"【{var_result.get('variableName', variable_type)}】\n"
            output += f"  - 敏感性系数: {var_result.get('sensitivityCoefficient', 'N/A')}\n"
            output += f"  - 影响趋势: {var_result.get('trend', 'N/A')}\n"
            output += f"  - 最大影响: {var_result.get('maxImpactPercent', 'N/A')}%\n"

            data_points = var_result.get("dataPoints", [])
            if data_points:
                output += f"  - 数据点数: {len(data_points)}\n"
                output += "\n  变化百分比 -> 沿程摩阻变化:\n"
                for dp in data_points[:5]:  # 只显示前5个点
                    output += f"    {dp.get('changePercent', 0):+.0f}% -> {dp.get('frictionChangePercent', 0):+.2f}%\n"

        output += f"\n计算次数: {result.get('totalCalculations', 'N/A')}\n"
        output += f"计算耗时: {result.get('duration', 'N/A')} ms\n"

        return output

    except httpx.ConnectError:
        logger.error("无法连接到Java服务")
        return "错误: 无法连接到Java计算服务"
    except Exception as e:
        logger.error(f"敏感性分析调用失败: {e}")
        return f"分析失败: {str(e)}"


@tool
def get_supported_sensitivity_variables() -> str:
    """
    获取支持的敏感性分析变量列表

    Returns:
        支持的变量类型及其描述
    """
    try:
        client = get_java_client()

        response = client.call_api(
            "/calculation/sensitivity/variables",
            method="GET"
        )

        if response.get("code") != 200:
            return f"查询失败: {response.get('msg', '未知错误')}"

        variables = response.get("data", [])

        output = "支持的敏感性分析变量:\n\n"
        for var in variables:
            output += f"• {var.get('code')}: {var.get('name')}\n"
            output += f"  单位: {var.get('unit', 'N/A')}\n"
            output += f"  变化范围: {var.get('minChangePercent', -20)}% ~ {var.get('maxChangePercent', 20)}%\n\n"

        return output

    except Exception as e:
        logger.error(f"获取变量列表失败: {e}")
        return f"查询失败: {str(e)}"


# ==================== 报告生成工具 ====================

@tool
def generate_hydraulic_report(
    flow_rate: float,
    pipe_diameter: float,
    pipe_length: float,
    pipe_thickness: float,
    oil_density: float,
    oil_viscosity: float,
    roughness: float,
    start_elevation: float,
    end_elevation: float,
    inlet_pressure: float,
    pump_480_num: int,
    pump_375_num: int,
    pump_480_head: float,
    pump_375_head: float
) -> str:
    """
    生成水力分析报告（Word文档）

    Args:
        flow_rate: 流量 (m³/h)
        pipe_diameter: 管道外径 (mm)
        pipe_length: 管道长度 (km)
        pipe_thickness: 管道壁厚 (mm)
        oil_density: 油品密度 (kg/m³)
        oil_viscosity: 运动粘度 (m²/s)
        roughness: 管道粗糙度 (mm)
        start_elevation: 起点高程 (m)
        end_elevation: 终点高程 (m)
        inlet_pressure: 首站进站压头 (m)
        pump_480_num: ZMI480泵数量
        pump_375_num: ZMI375泵数量
        pump_480_head: ZMI480单泵扬程 (m)
        pump_375_head: ZMI375单泵扬程 (m)

    Returns:
        报告生成结果，包括报告ID和下载信息
    """
    try:
        client = get_java_client()

        request_data = {
            "flowRate": flow_rate,
            "diameter": pipe_diameter,
            "thickness": pipe_thickness,
            "length": pipe_length,
            "density": oil_density,
            "viscosity": oil_viscosity,
            "roughness": roughness,
            "startAltitude": start_elevation,
            "endAltitude": end_elevation,
            "inletPressure": inlet_pressure,
            "pump480Num": pump_480_num,
            "pump375Num": pump_375_num,
            "pump480Head": pump_480_head,
            "pump375Head": pump_375_head
        }

        logger.info("调用报告生成API")

        response = client.call_api(
            "/calculation/report/generate/hydraulic",
            method="POST",
            data=request_data
        )

        if response.get("code") != 200:
            return f"报告生成失败: {response.get('msg', '未知错误')}"

        report_id = response.get("data")

        return (
            f"报告生成成功!\n\n"
            f"报告ID: {report_id}\n"
            f"下载地址: /calculation/report/download/{report_id}\n\n"
            f"提示: 请使用报告ID下载完整的Word报告文档"
        )

    except httpx.ConnectError:
        logger.error("无法连接到Java服务")
        return "错误: 无法连接到Java计算服务"
    except Exception as e:
        logger.error(f"报告生成调用失败: {e}")
        return f"报告生成失败: {str(e)}"


@tool
def get_report_list(
    report_type: Optional[str] = None,
    page_num: int = 1,
    page_size: int = 10
) -> str:
    """
    查询报告列表

    Args:
        report_type: 报告类型 (HYDRAULIC/OPTIMIZATION/COMPARISON/SENSITIVITY)，可选
        page_num: 页码，默认1
        page_size: 每页数量，默认10

    Returns:
        报告列表
    """
    try:
        client = get_java_client()

        params = {
            "pageNum": page_num,
            "pageSize": page_size
        }
        if report_type:
            params["reportType"] = report_type

        response = client.call_api(
            "/calculation/report/page",
            method="GET",
            params=params
        )

        if response.get("code") != 200:
            return f"查询失败: {response.get('msg', '未知错误')}"

        data = response.get("data", {})
        reports = data.get("list", [])
        total = data.get("total", 0)

        output = f"报告列表 (共{total}条):\n\n"

        for report in reports:
            output += f"• ID: {report.get('id')}\n"
            output += f"  标题: {report.get('title', 'N/A')}\n"
            output += f"  类型: {report.get('reportType', 'N/A')}\n"
            output += f"  创建时间: {report.get('createTime', 'N/A')}\n"
            output += f"  下载次数: {report.get('downloadCount', 0)}\n\n"

        return output

    except Exception as e:
        logger.error(f"查询报告列表失败: {e}")
        return f"查询失败: {str(e)}"


# ==================== 统计查询工具 ====================

@tool
def get_calculation_statistics() -> str:
    """
    获取计算统计概览，包括总计算次数、成功率、按类型分布等

    Returns:
        统计数据概览
    """
    try:
        client = get_java_client()

        response = client.call_api(
            "/calculation/statistics/overview",
            method="GET"
        )

        if response.get("code") != 200:
            return f"查询失败: {response.get('msg', '未知错误')}"

        data = response.get("data", {})

        output = "计算统计概览:\n\n"
        output += "【总体统计】\n"
        output += f"  - 总计算次数: {data.get('totalCount', 0)}\n"
        output += f"  - 成功次数: {data.get('successCount', 0)}\n"
        output += f"  - 失败次数: {data.get('failedCount', 0)}\n"
        output += f"  - 成功率: {data.get('successRate', 0):.2f}%\n\n"

        output += "【按类型统计】\n"
        output += f"  - 水力分析: {data.get('hydraulicCount', 0)} 次\n"
        output += f"  - 优化分析: {data.get('optimizationCount', 0)} 次\n\n"

        output += "【时间段统计】\n"
        output += f"  - 今日: {data.get('todayCount', 0)} 次\n"
        output += f"  - 本周: {data.get('weekCount', 0)} 次\n"
        output += f"  - 本月: {data.get('monthCount', 0)} 次\n\n"

        output += "【平均耗时】\n"
        output += f"  - 水力分析: {data.get('avgHydraulicDuration', 0):.2f} ms\n"
        output += f"  - 优化分析: {data.get('avgOptimizationDuration', 0):.2f} ms\n\n"

        output += "【活跃度】\n"
        output += f"  - 活跃用户数: {data.get('activeUserCount', 0)}\n"
        output += f"  - 活跃项目数: {data.get('activeProjectCount', 0)}\n"

        return output

    except Exception as e:
        logger.error(f"获取统计数据失败: {e}")
        return f"查询失败: {str(e)}"


@tool
def get_daily_calculation_trend(days: int = 7) -> str:
    """
    获取每日计算趋势

    Args:
        days: 统计天数，默认7天

    Returns:
        每日计算次数趋势
    """
    try:
        client = get_java_client()

        response = client.call_api(
            "/calculation/statistics/trend/daily",
            method="GET",
            params={"days": days}
        )

        if response.get("code") != 200:
            return f"查询失败: {response.get('msg', '未知错误')}"

        data = response.get("data", {})
        daily_stats = data.get("dailyStatistics", [])

        output = f"最近{days}天计算趋势:\n\n"
        output += "日期          | 计算次数\n"
        output += "--------------|--------\n"

        for stat in daily_stats:
            date = stat.get("date", "N/A")
            count = stat.get("count", 0)
            bar = "█" * min(count, 20)
            output += f"{date} | {count:>5} {bar}\n"

        return output

    except Exception as e:
        logger.error(f"获取趋势数据失败: {e}")
        return f"查询失败: {str(e)}"


# ==================== 历史查询工具 ====================

@tool
def get_calculation_history(
    calc_type: Optional[str] = None,
    page_num: int = 1,
    page_size: int = 10
) -> str:
    """
    查询计算历史记录

    Args:
        calc_type: 计算类型 (HYDRAULIC/OPTIMIZATION/SENSITIVITY)，可选
        page_num: 页码，默认1
        page_size: 每页数量，默认10

    Returns:
        计算历史记录列表
    """
    try:
        client = get_java_client()

        params = {
            "pageNum": page_num,
            "pageSize": page_size
        }
        if calc_type:
            params["calcType"] = calc_type

        response = client.call_api(
            "/calculation/history/page",
            method="GET",
            params=params
        )

        if response.get("code") != 200:
            return f"查询失败: {response.get('msg', '未知错误')}"

        data = response.get("data", {})
        histories = data.get("list", [])
        total = data.get("total", 0)

        output = f"计算历史记录 (共{total}条):\n\n"

        for history in histories:
            output += f"• ID: {history.get('id')}\n"
            output += f"  类型: {history.get('calcTypeName', history.get('calcType', 'N/A'))}\n"
            output += f"  项目: {history.get('projectName', 'N/A')}\n"
            output += f"  状态: {history.get('statusName', 'N/A')}\n"
            output += f"  耗时: {history.get('calcDurationFormatted', 'N/A')}\n"
            output += f"  时间: {history.get('createTime', 'N/A')}\n\n"

        return output

    except Exception as e:
        logger.error(f"查询历史记录失败: {e}")
        return f"查询失败: {str(e)}"


@tool
def get_calculation_history_detail(history_id: int) -> str:
    """
    查询计算历史详情，包括输入参数和输出结果

    Args:
        history_id: 历史记录ID

    Returns:
        计算历史详情
    """
    try:
        client = get_java_client()

        response = client.call_api(
            f"/calculation/history/{history_id}",
            method="GET"
        )

        if response.get("code") != 200:
            return f"查询失败: {response.get('msg', '未知错误')}"

        data = response.get("data", {})

        output = f"计算历史详情 (ID: {history_id}):\n\n"
        output += "【基本信息】\n"
        output += f"  - 计算类型: {data.get('calcTypeName', 'N/A')}\n"
        output += f"  - 项目: {data.get('projectName', 'N/A')}\n"
        output += f"  - 执行人: {data.get('userName', 'N/A')}\n"
        output += f"  - 状态: {data.get('statusName', 'N/A')}\n"
        output += f"  - 耗时: {data.get('calcDurationFormatted', 'N/A')}\n"
        output += f"  - 时间: {data.get('createTime', 'N/A')}\n\n"

        if data.get('errorMessage'):
            output += f"【错误信息】\n  {data.get('errorMessage')}\n\n"

        # 简化显示输入参数
        input_params = data.get('inputParams', '')
        if input_params and len(input_params) > 200:
            input_params = input_params[:200] + "..."
        output += f"【输入参数】\n  {input_params}\n\n"

        # 简化显示输出结果
        output_result = data.get('outputResult', '')
        if output_result and len(output_result) > 200:
            output_result = output_result[:200] + "..."
        output += f"【输出结果】\n  {output_result}\n"

        return output

    except Exception as e:
        logger.error(f"查询历史详情失败: {e}")
        return f"查询失败: {str(e)}"


# ==================== 工具集合 ====================

EXTENDED_TOOLS = [
    # 敏感性分析
    call_sensitivity_analysis,
    get_supported_sensitivity_variables,
    # 报告生成
    generate_hydraulic_report,
    get_report_list,
    # 统计查询
    get_calculation_statistics,
    get_daily_calculation_trend,
    # 历史查询
    get_calculation_history,
    get_calculation_history_detail
]

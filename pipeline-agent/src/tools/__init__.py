"""
工具模块
提供数据库查询、Java服务调用、计算工具等
"""

from .database_tools import (
    DATABASE_TOOLS,
    query_projects,
    query_project_by_id,
    query_project_by_name,
    query_pipelines,
    query_pipeline_detail,
    query_pump_stations,
    query_oil_properties,
    get_calculation_parameters,
    execute_safe_sql
)

from .java_service_tools import (
    JAVA_SERVICE_TOOLS,
    call_hydraulic_analysis,
    call_pump_optimization,
    get_pipeline_hydraulics,
    check_java_service_health
)

from .calculation_tools import (
    CALCULATION_TOOLS,
    calculate_reynolds_number,
    calculate_friction_head_loss,
    calculate_hydraulic_analysis,
    calculate_pump_head_required,
    convert_units
)

from .extended_tools import (
    EXTENDED_TOOLS,
    call_sensitivity_analysis,
    get_supported_sensitivity_variables,
    generate_hydraulic_report,
    get_report_list,
    get_calculation_statistics,
    get_daily_calculation_trend,
    get_calculation_history,
    get_calculation_history_detail
)


# 所有工具集合
ALL_TOOLS = DATABASE_TOOLS + JAVA_SERVICE_TOOLS + CALCULATION_TOOLS + EXTENDED_TOOLS

__all__ = [
    # 工具集合
    "DATABASE_TOOLS",
    "JAVA_SERVICE_TOOLS",
    "CALCULATION_TOOLS",
    "EXTENDED_TOOLS",
    "ALL_TOOLS",
    # 数据库工具
    "query_projects",
    "query_project_by_id",
    "query_project_by_name",
    "query_pipelines",
    "query_pipeline_detail",
    "query_pump_stations",
    "query_oil_properties",
    "get_calculation_parameters",
    "execute_safe_sql",
    # Java服务工具
    "call_hydraulic_analysis",
    "call_pump_optimization",
    "get_pipeline_hydraulics",
    "check_java_service_health",
    # 计算工具
    "calculate_reynolds_number",
    "calculate_friction_head_loss",
    "calculate_hydraulic_analysis",
    "calculate_pump_head_required",
    "convert_units",
    # 扩展工具
    "call_sensitivity_analysis",
    "get_supported_sensitivity_variables",
    "generate_hydraulic_report",
    "get_report_list",
    "get_calculation_statistics",
    "get_daily_calculation_trend",
    "get_calculation_history",
    "get_calculation_history_detail"
]

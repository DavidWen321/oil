"""
数据库查询工具
提供项目、管道、泵站、油品的查询功能
"""

from typing import Optional, List, Any
from decimal import Decimal
from langchain_core.tools import tool
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from src.config import settings
from src.utils import logger, decimal_to_float


# 创建数据库引擎
_engine = None


def get_engine():
    """获取数据库引擎单例"""
    global _engine
    if _engine is None:
        _engine = create_engine(
            settings.DATABASE_URL,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10
        )
    return _engine


def execute_query(sql: str, params: dict = None) -> List[dict]:
    """
    执行SQL查询并返回结果

    Args:
        sql: SQL查询语句
        params: 查询参数

    Returns:
        查询结果列表
    """
    engine = get_engine()
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params or {})
            rows = result.fetchall()
            columns = result.keys()
            return [
                {col: decimal_to_float(val) for col, val in zip(columns, row)}
                for row in rows
            ]
    except SQLAlchemyError as e:
        logger.error(f"数据库查询错误: {e}")
        raise


# ==================== LangChain Tools ====================

@tool
def query_projects(limit: int = 20) -> str:
    """
    查询所有项目列表

    Args:
        limit: 返回的最大记录数，默认20

    Returns:
        项目列表的JSON格式字符串
    """
    try:
        sql = """
            SELECT pro_id, number, name, responsible, build_date, description
            FROM t_project
            ORDER BY pro_id DESC
            LIMIT :limit
        """
        results = execute_query(sql, {"limit": limit})
        if not results:
            return "未找到任何项目"

        output = f"共找到 {len(results)} 个项目:\n"
        for p in results:
            output += f"- 项目ID: {p['pro_id']}, 编号: {p['number']}, 名称: {p['name']}\n"
        return output
    except Exception as e:
        logger.error(f"查询项目失败: {e}")
        return f"查询失败: {str(e)}"


@tool
def query_project_by_id(project_id: int) -> str:
    """
    根据项目ID查询项目详情

    Args:
        project_id: 项目ID

    Returns:
        项目详情
    """
    try:
        sql = """
            SELECT pro_id, number, name, responsible, build_date, description
            FROM t_project
            WHERE pro_id = :project_id
        """
        results = execute_query(sql, {"project_id": project_id})
        if not results:
            return f"未找到ID为 {project_id} 的项目"

        p = results[0]
        return (
            f"项目详情:\n"
            f"  - 项目ID: {p['pro_id']}\n"
            f"  - 项目编号: {p['number']}\n"
            f"  - 项目名称: {p['name']}\n"
            f"  - 负责人: {p.get('responsible', '未指定')}\n"
            f"  - 建设日期: {p.get('build_date', '未指定')}\n"
            f"  - 描述: {p.get('description', '无')}"
        )
    except Exception as e:
        logger.error(f"查询项目详情失败: {e}")
        return f"查询失败: {str(e)}"


@tool
def query_project_by_name(name: str) -> str:
    """
    根据名称模糊查询项目

    Args:
        name: 项目名称关键词

    Returns:
        匹配的项目列表
    """
    try:
        sql = """
            SELECT pro_id, number, name, responsible, build_date
            FROM t_project
            WHERE name LIKE :name OR number LIKE :name
            LIMIT 10
        """
        results = execute_query(sql, {"name": f"%{name}%"})
        if not results:
            return f"未找到包含 '{name}' 的项目"

        output = f"找到 {len(results)} 个匹配项目:\n"
        for p in results:
            output += f"- 项目ID: {p['pro_id']}, 编号: {p['number']}, 名称: {p['name']}\n"
        return output
    except Exception as e:
        logger.error(f"搜索项目失败: {e}")
        return f"查询失败: {str(e)}"


@tool
def query_pipelines(project_id: int) -> str:
    """
    查询项目下的所有管道

    Args:
        project_id: 项目ID

    Returns:
        管道列表
    """
    try:
        sql = """
            SELECT id, pro_id, name, length, diameter, thickness,
                   roughness, throughput, start_elevation, end_elevation
            FROM t_pipeline
            WHERE pro_id = :project_id
        """
        results = execute_query(sql, {"project_id": project_id})
        if not results:
            return f"项目 {project_id} 下未找到管道"

        output = f"项目 {project_id} 共有 {len(results)} 条管道:\n"
        for p in results:
            output += (
                f"\n管道: {p['name']}\n"
                f"  - ID: {p['id']}\n"
                f"  - 长度: {p.get('length', 'N/A')} km\n"
                f"  - 外径: {p.get('diameter', 'N/A')} mm\n"
                f"  - 壁厚: {p.get('thickness', 'N/A')} mm\n"
                f"  - 设计输量: {p.get('throughput', 'N/A')} 万吨/年\n"
            )
        return output
    except Exception as e:
        logger.error(f"查询管道失败: {e}")
        return f"查询失败: {str(e)}"


@tool
def query_pipeline_detail(pipeline_id: int) -> str:
    """
    查询管道详细信息

    Args:
        pipeline_id: 管道ID

    Returns:
        管道详细参数
    """
    try:
        sql = """
            SELECT p.id, p.pro_id, p.name, p.length, p.diameter, p.thickness,
                   p.roughness, p.throughput, p.start_elevation, p.end_elevation,
                   pr.name as project_name
            FROM t_pipeline p
            LEFT JOIN t_project pr ON p.pro_id = pr.pro_id
            WHERE p.id = :pipeline_id
        """
        results = execute_query(sql, {"pipeline_id": pipeline_id})
        if not results:
            return f"未找到ID为 {pipeline_id} 的管道"

        p = results[0]
        # 计算内径
        diameter = p.get('diameter')
        thickness = p.get('thickness')
        inner_diameter = None
        if diameter and thickness:
            inner_diameter = float(diameter) - 2 * float(thickness)

        inner_diameter_str = f"  - 内径: {inner_diameter:.2f} mm\n" if inner_diameter else ""
        return (
            f"管道详细信息:\n"
            f"  - 管道ID: {p['id']}\n"
            f"  - 管道名称: {p['name']}\n"
            f"  - 所属项目: {p.get('project_name', 'N/A')} (ID: {p['pro_id']})\n"
            f"  - 长度: {p.get('length', 'N/A')} km\n"
            f"  - 外径: {diameter} mm\n"
            f"  - 壁厚: {thickness} mm\n"
            f"{inner_diameter_str}"
            f"  - 粗糙度: {p.get('roughness', 0.03)} mm\n"
            f"  - 设计输量: {p.get('throughput', 'N/A')} 万吨/年\n"
            f"  - 起点高程: {p.get('start_elevation', 0)} m\n"
            f"  - 终点高程: {p.get('end_elevation', 0)} m"
        )
    except Exception as e:
        logger.error(f"查询管道详情失败: {e}")
        return f"查询失败: {str(e)}"


@tool
def query_pump_stations(pipeline_id: int) -> str:
    """
    查询管道下的泵站列表

    Args:
        pipeline_id: 管道ID

    Returns:
        泵站列表
    """
    try:
        sql = """
            SELECT id, pipeline_id, name, station_type,
                   pump_efficiency, motor_efficiency, displacement, lift
            FROM t_pump_station
            WHERE pipeline_id = :pipeline_id
        """
        results = execute_query(sql, {"pipeline_id": pipeline_id})
        if not results:
            return f"管道 {pipeline_id} 下未找到泵站"

        output = f"管道 {pipeline_id} 共有 {len(results)} 个泵站:\n"
        for s in results:
            output += (
                f"\n泵站: {s['name']}\n"
                f"  - ID: {s['id']}\n"
                f"  - 类型: {s.get('station_type', 'N/A')}\n"
                f"  - 泵效率: {s.get('pump_efficiency', 'N/A')}%\n"
                f"  - 电机效率: {s.get('motor_efficiency', 'N/A')}%\n"
                f"  - 排量: {s.get('displacement', 'N/A')} m³/h\n"
                f"  - 扬程: {s.get('lift', 'N/A')} m\n"
            )
        return output
    except Exception as e:
        logger.error(f"查询泵站失败: {e}")
        return f"查询失败: {str(e)}"


@tool
def query_oil_properties(oil_id: Optional[int] = None) -> str:
    """
    查询油品参数

    Args:
        oil_id: 油品ID，不传则查询所有

    Returns:
        油品参数信息
    """
    try:
        if oil_id:
            sql = """
                SELECT id, name, density, viscosity, pour_point, wax_content
                FROM t_oil_property
                WHERE id = :oil_id
            """
            results = execute_query(sql, {"oil_id": oil_id})
        else:
            sql = """
                SELECT id, name, density, viscosity, pour_point, wax_content
                FROM t_oil_property
                LIMIT 20
            """
            results = execute_query(sql)

        if not results:
            return "未找到油品信息"

        output = f"共找到 {len(results)} 种油品:\n"
        for o in results:
            output += (
                f"\n油品: {o['name']}\n"
                f"  - ID: {o['id']}\n"
                f"  - 密度: {o.get('density', 'N/A')} kg/m³\n"
                f"  - 运动粘度: {o.get('viscosity', 'N/A')} m²/s\n"
                f"  - 凝固点: {o.get('pour_point', 'N/A')} °C\n"
                f"  - 含蜡量: {o.get('wax_content', 'N/A')}%\n"
            )
        return output
    except Exception as e:
        logger.error(f"查询油品失败: {e}")
        return f"查询失败: {str(e)}"


@tool
def get_calculation_parameters(pipeline_id: int, oil_id: int) -> str:
    """
    获取水力计算所需的完整参数

    Args:
        pipeline_id: 管道ID
        oil_id: 油品ID

    Returns:
        计算所需的管道和油品参数
    """
    try:
        # 查询管道参数
        pipeline_sql = """
            SELECT id, name, length, diameter, thickness, roughness,
                   start_elevation, end_elevation
            FROM t_pipeline
            WHERE id = :pipeline_id
        """
        pipeline_results = execute_query(pipeline_sql, {"pipeline_id": pipeline_id})

        # 查询油品参数
        oil_sql = """
            SELECT id, name, density, viscosity
            FROM t_oil_property
            WHERE id = :oil_id
        """
        oil_results = execute_query(oil_sql, {"oil_id": oil_id})

        if not pipeline_results:
            return f"未找到ID为 {pipeline_id} 的管道"
        if not oil_results:
            return f"未找到ID为 {oil_id} 的油品"

        p = pipeline_results[0]
        o = oil_results[0]

        # 计算内径
        diameter = float(p.get('diameter', 0))
        thickness = float(p.get('thickness', 0))
        inner_diameter = diameter - 2 * thickness

        return (
            f"水力计算参数:\n"
            f"\n【管道参数】\n"
            f"  - 管道名称: {p['name']}\n"
            f"  - 长度(L): {p.get('length', 0)} km\n"
            f"  - 外径(D): {diameter} mm\n"
            f"  - 壁厚(t): {thickness} mm\n"
            f"  - 内径(d): {inner_diameter:.2f} mm\n"
            f"  - 粗糙度(ε): {p.get('roughness', 0.03)} mm\n"
            f"  - 起点高程(Z1): {p.get('start_elevation', 0)} m\n"
            f"  - 终点高程(Z2): {p.get('end_elevation', 0)} m\n"
            f"\n【油品参数】\n"
            f"  - 油品名称: {o['name']}\n"
            f"  - 密度(ρ): {o.get('density', 850)} kg/m³\n"
            f"  - 运动粘度(ν): {o.get('viscosity', 0.00002)} m²/s\n"
        )
    except Exception as e:
        logger.error(f"获取计算参数失败: {e}")
        return f"查询失败: {str(e)}"


@tool
def execute_safe_sql(sql: str) -> str:
    """
    执行安全的只读SQL查询（仅支持SELECT）

    Args:
        sql: SELECT查询语句

    Returns:
        查询结果

    注意:
        - 仅支持SELECT语句
        - 禁止访问sys_user表的password字段
        - 结果最多返回100条
    """
    try:
        # 安全检查
        sql_upper = sql.upper().strip()

        if not sql_upper.startswith("SELECT"):
            return "错误: 仅支持SELECT查询"

        forbidden_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
                              "CREATE", "TRUNCATE", "GRANT", "REVOKE"]
        for keyword in forbidden_keywords:
            if keyword in sql_upper:
                return f"错误: 不允许使用 {keyword} 操作"

        # 禁止访问敏感字段
        if "SYS_USER" in sql_upper and "PASSWORD" in sql_upper:
            return "错误: 不允许查询用户密码"

        # 添加LIMIT限制
        if "LIMIT" not in sql_upper:
            sql = sql.rstrip(";") + " LIMIT 100"

        results = execute_query(sql)
        if not results:
            return "查询结果为空"

        # 格式化输出
        output = f"查询结果 ({len(results)} 条记录):\n"
        for i, row in enumerate(results[:20], 1):  # 最多显示20条
            output += f"\n记录 {i}:\n"
            for key, value in row.items():
                output += f"  - {key}: {value}\n"

        if len(results) > 20:
            output += f"\n... 还有 {len(results) - 20} 条记录未显示"

        return output
    except Exception as e:
        logger.error(f"执行SQL失败: {e}")
        return f"查询失败: {str(e)}"


# ==================== 工具集合 ====================

DATABASE_TOOLS = [
    query_projects,
    query_project_by_id,
    query_project_by_name,
    query_pipelines,
    query_pipeline_detail,
    query_pump_stations,
    query_oil_properties,
    get_calculation_parameters,
    execute_safe_sql
]

"""
数据库查询工具
提供项目、管道、泵站、油品的查询功能
"""

import json
import re
from typing import Optional, List
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
        项目列表（JSON格式）
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
            return json.dumps(
                {"success": False, "message": "未找到任何项目", "data": []},
                ensure_ascii=False,
                default=str,
            )

        projects = []
        for p in results:
            projects.append(
                {
                    "pro_id": p["pro_id"],
                    "number": p.get("number", ""),
                    "name": p.get("name", ""),
                    "responsible": p.get("responsible"),
                    "build_date": p.get("build_date"),
                    "description": p.get("description", ""),
                }
            )

        return json.dumps(
            {"success": True, "data": projects, "count": len(projects)},
            ensure_ascii=False,
            default=str,
        )
    except Exception as e:
        logger.error(f"查询项目失败: {e}")
        return json.dumps(
            {"success": False, "message": f"查询失败: {str(e)}", "data": []},
            ensure_ascii=False,
            default=str,
        )


@tool
def query_project_by_id(project_id: int) -> str:
    """
    根据项目ID查询项目详情

    Args:
        project_id: 项目ID

    Returns:
        项目详情（JSON格式）
    """
    try:
        sql = """
            SELECT pro_id, number, name, responsible, build_date, description
            FROM t_project
            WHERE pro_id = :project_id
        """
        results = execute_query(sql, {"project_id": project_id})
        if not results:
            return json.dumps(
                {
                    "success": False,
                    "message": f"未找到ID为 {project_id} 的项目",
                    "data": None,
                },
                ensure_ascii=False,
                default=str,
            )

        p = results[0]
        data = {
            "pro_id": p["pro_id"],
            "number": p.get("number", ""),
            "name": p.get("name", ""),
            "responsible": p.get("responsible"),
            "build_date": p.get("build_date"),
            "description": p.get("description", ""),
        }

        return json.dumps(
            {"success": True, "data": data},
            ensure_ascii=False,
            default=str,
        )
    except Exception as e:
        logger.error(f"查询项目详情失败: {e}")
        return json.dumps(
            {"success": False, "message": f"查询失败: {str(e)}", "data": None},
            ensure_ascii=False,
            default=str,
        )


@tool
def query_project_by_name(name: str) -> str:
    """
    根据名称模糊查询项目

    Args:
        name: 项目名称关键词

    Returns:
        匹配的项目列表（JSON格式）
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
            return json.dumps(
                {
                    "success": False,
                    "message": f"未找到包含 '{name}' 的项目",
                    "data": [],
                },
                ensure_ascii=False,
                default=str,
            )

        projects = []
        for p in results:
            projects.append(
                {
                    "pro_id": p["pro_id"],
                    "number": p.get("number", ""),
                    "name": p.get("name", ""),
                    "responsible": p.get("responsible"),
                    "build_date": p.get("build_date"),
                }
            )

        return json.dumps(
            {"success": True, "data": projects, "count": len(projects)},
            ensure_ascii=False,
            default=str,
        )
    except Exception as e:
        logger.error(f"搜索项目失败: {e}")
        return json.dumps(
            {"success": False, "message": f"查询失败: {str(e)}", "data": []},
            ensure_ascii=False,
            default=str,
        )


@tool
def query_pipelines(project_id: int) -> str:
    """
    查询项目下的所有管道

    Args:
        project_id: 项目ID

    Returns:
        管道列表（JSON格式）
    """
    try:
        sql = """
            SELECT id, pro_id, name, length, diameter, thickness,
                   roughness, throughput, start_altitude, end_altitude, work_time
            FROM t_pipeline
            WHERE pro_id = :project_id
        """
        results = execute_query(sql, {"project_id": project_id})
        if not results:
            return json.dumps(
                {
                    "success": False,
                    "message": f"项目 {project_id} 下未找到管道",
                    "data": [],
                },
                ensure_ascii=False,
                default=str,
            )

        pipelines = []
        for p in results:
            pipelines.append(
                {
                    "id": p["id"],
                    "pro_id": p["pro_id"],
                    "name": p.get("name", ""),
                    "length": p.get("length"),
                    "diameter": p.get("diameter"),
                    "thickness": p.get("thickness"),
                    "roughness": p.get("roughness"),
                    "throughput": p.get("throughput"),
                    "start_altitude": p.get("start_altitude"),
                    "end_altitude": p.get("end_altitude"),
                    "work_time": p.get("work_time"),
                }
            )

        return json.dumps(
            {"success": True, "data": pipelines, "count": len(pipelines)},
            ensure_ascii=False,
            default=str,
        )
    except Exception as e:
        logger.error(f"查询管道失败: {e}")
        return json.dumps(
            {"success": False, "message": f"查询失败: {str(e)}", "data": []},
            ensure_ascii=False,
            default=str,
        )


@tool
def query_pipeline_detail(pipeline_id: int) -> str:
    """
    查询管道详细信息

    Args:
        pipeline_id: 管道ID

    Returns:
        管道详细参数（JSON格式）
    """
    try:
        sql = """
            SELECT p.id, p.pro_id, p.name, p.length, p.diameter, p.thickness,
                   p.roughness, p.throughput, p.start_altitude, p.end_altitude,
                   p.work_time,
                   pr.name as project_name
            FROM t_pipeline p
            LEFT JOIN t_project pr ON p.pro_id = pr.pro_id
            WHERE p.id = :pipeline_id
        """
        results = execute_query(sql, {"pipeline_id": pipeline_id})
        if not results:
            return json.dumps(
                {
                    "success": False,
                    "message": f"未找到ID为 {pipeline_id} 的管道",
                    "data": None,
                },
                ensure_ascii=False,
                default=str,
            )

        p = results[0]
        diameter = float(p.get("diameter") or 0)
        thickness = float(p.get("thickness") or 0)
        inner_diameter = diameter - 2 * thickness if diameter > 0 and thickness > 0 else 0

        data = {
            "id": p["id"],
            "pro_id": p["pro_id"],
            "name": p.get("name", ""),
            "project_name": p.get("project_name", ""),
            "length": p.get("length"),
            "diameter": diameter,
            "thickness": thickness,
            "inner_diameter": round(inner_diameter, 2),
            "roughness": p.get("roughness"),
            "throughput": p.get("throughput"),
            "start_altitude": p.get("start_altitude"),
            "end_altitude": p.get("end_altitude"),
            "work_time": p.get("work_time"),
        }
        return json.dumps(
            {"success": True, "data": data},
            ensure_ascii=False,
            default=str,
        )
    except Exception as e:
        logger.error(f"查询管道详情失败: {e}")
        return json.dumps(
            {"success": False, "message": f"查询失败: {str(e)}", "data": None},
            ensure_ascii=False,
            default=str,
        )


@tool
def query_pump_stations(limit: int = 20) -> str:
    """
    查询泵站参数列表

    Args:
        limit: 返回最大记录数，默认20

    Returns:
        泵站参数列表（JSON格式）
    """
    try:
        sql = """
            SELECT id, name, pump_efficiency, electric_efficiency,
                   displacement, come_power, zmi480_lift, zmi375_lift
            FROM t_pump_station
            ORDER BY id
            LIMIT :limit
        """
        results = execute_query(sql, {"limit": limit})
        if not results:
            return json.dumps(
                {"success": False, "message": "未找到泵站数据", "data": []},
                ensure_ascii=False,
                default=str,
            )

        stations = []
        for s in results:
            stations.append(
                {
                    "id": s["id"],
                    "name": s.get("name", ""),
                    "pump_efficiency": s.get("pump_efficiency"),
                    "electric_efficiency": s.get("electric_efficiency"),
                    "displacement": s.get("displacement"),
                    "come_power": s.get("come_power"),
                    "zmi480_lift": s.get("zmi480_lift"),
                    "zmi375_lift": s.get("zmi375_lift"),
                }
            )

        return json.dumps(
            {"success": True, "data": stations, "count": len(stations)},
            ensure_ascii=False,
            default=str,
        )
    except Exception as e:
        logger.error(f"查询泵站失败: {e}")
        return json.dumps(
            {"success": False, "message": f"查询失败: {str(e)}", "data": []},
            ensure_ascii=False,
            default=str,
        )


@tool
def query_oil_properties(oil_id: Optional[int] = None) -> str:
    """
    查询油品参数

    Args:
        oil_id: 油品ID，不传则查询所有

    Returns:
        油品参数信息（JSON格式）
    """
    try:
        if oil_id:
            sql = """
                SELECT id, name, density, viscosity
                FROM t_oil_property
                WHERE id = :oil_id
            """
            results = execute_query(sql, {"oil_id": oil_id})
        else:
            sql = """
                SELECT id, name, density, viscosity
                FROM t_oil_property
                LIMIT 20
            """
            results = execute_query(sql)

        if not results:
            return json.dumps(
                {"success": False, "message": "未找到油品信息", "data": []},
                ensure_ascii=False,
                default=str,
            )

        oils = []
        for o in results:
            oils.append(
                {
                    "id": o["id"],
                    "name": o.get("name", ""),
                    "density": o.get("density"),
                    "viscosity": o.get("viscosity"),
                }
            )

        return json.dumps(
            {"success": True, "data": oils, "count": len(oils)},
            ensure_ascii=False,
            default=str,
        )
    except Exception as e:
        logger.error(f"查询油品失败: {e}")
        return json.dumps(
            {"success": False, "message": f"查询失败: {str(e)}", "data": []},
            ensure_ascii=False,
            default=str,
        )


@tool
def get_calculation_parameters(pipeline_id: int, oil_id: int) -> str:
    """
    获取水力计算所需的完整参数

    Args:
        pipeline_id: 管道ID
        oil_id: 油品ID

    Returns:
        计算所需的管道和油品参数（JSON格式）
    """
    try:
        pipeline_sql = """
            SELECT id, name, length, diameter, thickness, roughness,
                   start_altitude, end_altitude, throughput, work_time
            FROM t_pipeline
            WHERE id = :pipeline_id
        """
        pipeline_results = execute_query(pipeline_sql, {"pipeline_id": pipeline_id})

        oil_sql = """
            SELECT id, name, density, viscosity
            FROM t_oil_property
            WHERE id = :oil_id
        """
        oil_results = execute_query(oil_sql, {"oil_id": oil_id})

        pump_sql = """
            SELECT id, name, pump_efficiency, electric_efficiency,
                   displacement, come_power, zmi480_lift, zmi375_lift
            FROM t_pump_station
            LIMIT 1
        """
        pump_results = execute_query(pump_sql)

        if not pipeline_results:
            return json.dumps(
                {"success": False, "message": f"未找到ID为 {pipeline_id} 的管道"},
                ensure_ascii=False,
                default=str,
            )
        if not oil_results:
            return json.dumps(
                {"success": False, "message": f"未找到ID为 {oil_id} 的油品"},
                ensure_ascii=False,
                default=str,
            )

        p = pipeline_results[0]
        o = oil_results[0]
        pump = pump_results[0] if pump_results else {}

        diameter = float(p.get("diameter") or 0)
        thickness = float(p.get("thickness") or 0)
        inner_diameter = diameter - 2 * thickness

        data = {
            "pipeline": {
                "id": p["id"],
                "name": p.get("name"),
                "length": p.get("length"),
                "diameter": diameter,
                "thickness": thickness,
                "inner_diameter": round(inner_diameter, 2),
                "roughness": p.get("roughness"),
                "start_altitude": p.get("start_altitude"),
                "end_altitude": p.get("end_altitude"),
                "throughput": p.get("throughput"),
                "work_time": p.get("work_time"),
            },
            "oil": {
                "id": o["id"],
                "name": o.get("name"),
                "density": o.get("density"),
                "viscosity": o.get("viscosity"),
            },
            "pump_station": {
                "pump_efficiency": pump.get("pump_efficiency"),
                "electric_efficiency": pump.get("electric_efficiency"),
                "displacement": pump.get("displacement"),
                "come_power": pump.get("come_power"),
                "zmi480_lift": pump.get("zmi480_lift"),
                "zmi375_lift": pump.get("zmi375_lift"),
            }
            if pump
            else None,
        }
        return json.dumps(
            {"success": True, "data": data},
            ensure_ascii=False,
            default=str,
        )
    except Exception as e:
        logger.error(f"获取计算参数失败: {e}")
        return json.dumps(
            {"success": False, "message": f"查询失败: {str(e)}"},
            ensure_ascii=False,
            default=str,
        )


@tool
def execute_safe_sql(sql: str) -> str:
    """
    执行安全的只读SQL查询（仅支持SELECT）

    Args:
        sql: SELECT查询语句

    Returns:
        查询结果（JSON格式）

    注意:
        - 仅支持SELECT语句
        - 禁止访问sys_user表的password字段
        - 结果最多返回100条
    """
    try:
        # 安全检查
        sql_upper = sql.upper().strip()

        if not sql_upper.startswith("SELECT"):
            return json.dumps(
                {"success": False, "message": "错误: 仅支持SELECT查询", "data": []},
                ensure_ascii=False,
                default=str,
            )

        forbidden_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
                              "CREATE", "TRUNCATE", "GRANT", "REVOKE"]
        for keyword in forbidden_keywords:
            if re.search(rf"\b{keyword}\b", sql_upper):
                return json.dumps(
                    {
                        "success": False,
                        "message": f"错误: 不允许使用 {keyword} 操作",
                        "data": [],
                    },
                    ensure_ascii=False,
                    default=str,
                )

        # 禁止访问敏感字段
        if "SYS_USER" in sql_upper and "PASSWORD" in sql_upper:
            return json.dumps(
                {"success": False, "message": "错误: 不允许查询用户密码", "data": []},
                ensure_ascii=False,
                default=str,
            )

        # 添加LIMIT限制
        if "LIMIT" not in sql_upper:
            sql = sql.rstrip(";") + " LIMIT 100"

        results = execute_query(sql)
        if not results:
            return json.dumps(
                {"success": True, "message": "查询结果为空", "data": [], "count": 0},
                ensure_ascii=False,
                default=str,
            )

        return json.dumps(
            {"success": True, "data": results, "count": len(results)},
            ensure_ascii=False,
            default=str,
        )
    except Exception as e:
        logger.error(f"执行SQL失败: {e}")
        return json.dumps(
            {"success": False, "message": f"查询失败: {str(e)}", "data": []},
            ensure_ascii=False,
            default=str,
        )


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

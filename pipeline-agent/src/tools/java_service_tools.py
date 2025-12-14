"""
Java服务调用工具
通过HTTP调用Java后端的水力计算和优化服务
"""

from typing import Optional, Dict, Any
from decimal import Decimal
import httpx
from langchain_core.tools import tool
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import settings
from src.utils import logger, decimal_to_float


class JavaServiceClient:
    """Java服务HTTP客户端"""

    def __init__(self):
        self.base_url = settings.JAVA_GATEWAY_URL
        self.timeout = settings.JAVA_REQUEST_TIMEOUT
        self.token: Optional[str] = None

    async def _get_token(self) -> str:
        """获取认证Token"""
        if self.token:
            return self.token

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/auth/login",
                json={
                    "username": settings.JAVA_AUTH_USERNAME,
                    "password": settings.JAVA_AUTH_PASSWORD
                }
            )
            response.raise_for_status()
            data = response.json()
            self.token = data.get("data", {}).get("token") or data.get("token")
            return self.token

    def _get_token_sync(self) -> str:
        """同步获取认证Token"""
        if self.token:
            return self.token

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(
                f"{self.base_url}/auth/login",
                json={
                    "username": settings.JAVA_AUTH_USERNAME,
                    "password": settings.JAVA_AUTH_PASSWORD
                }
            )
            response.raise_for_status()
            data = response.json()
            self.token = data.get("data", {}).get("token") or data.get("token")
            return self.token

    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        token = self._get_token_sync()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def call_api(self, endpoint: str, method: str = "POST",
                 data: Dict = None, params: Dict = None) -> Dict[str, Any]:
        """
        调用Java API

        Args:
            endpoint: API端点
            method: HTTP方法
            data: 请求体数据
            params: 查询参数

        Returns:
            API响应数据
        """
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers()

        with httpx.Client(timeout=self.timeout) as client:
            if method.upper() == "GET":
                response = client.get(url, headers=headers, params=params)
            elif method.upper() == "POST":
                response = client.post(url, headers=headers, json=data)
            else:
                raise ValueError(f"不支持的HTTP方法: {method}")

            response.raise_for_status()
            return response.json()


# 创建全局客户端实例
_java_client: Optional[JavaServiceClient] = None


def get_java_client() -> JavaServiceClient:
    """获取Java客户端单例"""
    global _java_client
    if _java_client is None:
        _java_client = JavaServiceClient()
    return _java_client


# ==================== LangChain Tools ====================

@tool
def call_hydraulic_analysis(
    flow_rate: float,
    pipe_diameter: float,
    pipe_length: float,
    oil_density: float,
    oil_viscosity: float,
    roughness: float = 0.03,
    start_elevation: float = 0,
    end_elevation: float = 0
) -> str:
    """
    调用Java服务进行水力特性分析

    Args:
        flow_rate: 流量 (m³/h)
        pipe_diameter: 管道内径 (mm)
        pipe_length: 管道长度 (km)
        oil_density: 油品密度 (kg/m³)
        oil_viscosity: 运动粘度 (m²/s)
        roughness: 管道粗糙度 (mm)，默认0.03
        start_elevation: 起点高程 (m)
        end_elevation: 终点高程 (m)

    Returns:
        水力分析结果
    """
    try:
        client = get_java_client()

        # 构造请求参数
        request_data = {
            "flowRate": flow_rate,
            "pipeDiameter": pipe_diameter,
            "pipeLength": pipe_length,
            "oilDensity": oil_density,
            "oilViscosity": oil_viscosity,
            "roughness": roughness,
            "startElevation": start_elevation,
            "endElevation": end_elevation
        }

        logger.info(f"调用水力分析API: {request_data}")

        # 调用API
        response = client.call_api(
            "/calculation/hydraulic/analysis",
            method="POST",
            data=request_data
        )

        # 解析响应
        if response.get("code") != 200:
            return f"计算失败: {response.get('msg', '未知错误')}"

        result = response.get("data", {})

        # 格式化输出
        return (
            f"水力分析结果:\n"
            f"\n【基本参数】\n"
            f"  - 流量: {flow_rate} m³/h\n"
            f"  - 管径: {pipe_diameter} mm\n"
            f"  - 管长: {pipe_length} km\n"
            f"\n【计算结果】\n"
            f"  - 流速: {result.get('flowVelocity', 'N/A')} m/s\n"
            f"  - 雷诺数: {result.get('reynoldsNumber', 'N/A')}\n"
            f"  - 流态: {result.get('flowRegime', 'N/A')}\n"
            f"  - 摩擦系数: {result.get('frictionFactor', 'N/A')}\n"
            f"  - 沿程摩阻损失: {result.get('frictionHeadLoss', 'N/A')} m\n"
            f"  - 水力坡降: {result.get('hydraulicSlope', 'N/A')} m/km\n"
            f"  - 高程差压头: {result.get('elevationHead', 'N/A')} m\n"
            f"  - 总压头损失: {result.get('totalHeadLoss', 'N/A')} m\n"
            f"  - 计算方法: {result.get('calculationMethod', 'N/A')}"
        )

    except httpx.ConnectError:
        logger.error("无法连接到Java服务")
        return "错误: 无法连接到Java计算服务，请确认服务是否启动"
    except httpx.HTTPStatusError as e:
        logger.error(f"Java服务返回错误: {e}")
        return f"错误: Java服务返回 {e.response.status_code}"
    except Exception as e:
        logger.error(f"水力分析调用失败: {e}")
        return f"计算失败: {str(e)}"


@tool
def call_pump_optimization(
    pipeline_id: int,
    target_flow: float,
    min_end_pressure: float = 0.3
) -> str:
    """
    调用Java服务进行泵站组合优化

    Args:
        pipeline_id: 管道ID
        target_flow: 目标流量 (m³/h)
        min_end_pressure: 最小末站压力 (MPa)，默认0.3

    Returns:
        优化结果
    """
    try:
        client = get_java_client()

        request_data = {
            "pipelineId": pipeline_id,
            "targetFlow": target_flow,
            "minEndPressure": min_end_pressure
        }

        logger.info(f"调用泵站优化API: {request_data}")

        response = client.call_api(
            "/calculation/optimization/pump",
            method="POST",
            data=request_data
        )

        if response.get("code") != 200:
            return f"优化失败: {response.get('msg', '未知错误')}"

        result = response.get("data", {})
        optimal = result.get("optimalCombination", {})
        all_combinations = result.get("allCombinations", [])

        output = (
            f"泵站优化结果:\n"
            f"\n【优化目标】\n"
            f"  - 目标流量: {target_flow} m³/h\n"
            f"  - 最小末站压力: {min_end_pressure} MPa\n"
            f"\n【最优方案】\n"
            f"  - 泵型1: {optimal.get('pumpType1', 'N/A')} × {optimal.get('pumpCount1', 0)} 台\n"
            f"  - 泵型2: {optimal.get('pumpType2', 'N/A')} × {optimal.get('pumpCount2', 0)} 台\n"
            f"  - 总扬程: {optimal.get('totalHead', 'N/A')} m\n"
            f"  - 末站压力: {optimal.get('endPressure', 'N/A')} MPa\n"
            f"  - 功耗: {optimal.get('powerConsumption', 'N/A')} kW\n"
        )

        # 显示其他可行方案
        feasible_count = sum(1 for c in all_combinations if c.get('isFeasible'))
        output += f"\n【方案统计】\n"
        output += f"  - 总方案数: {len(all_combinations)}\n"
        output += f"  - 可行方案数: {feasible_count}\n"

        return output

    except httpx.ConnectError:
        logger.error("无法连接到Java服务")
        return "错误: 无法连接到Java计算服务，请确认服务是否启动"
    except Exception as e:
        logger.error(f"泵站优化调用失败: {e}")
        return f"优化失败: {str(e)}"


@tool
def get_pipeline_hydraulics(pipeline_id: int, flow_rate: float) -> str:
    """
    根据管道ID获取完整的水力计算结果

    Args:
        pipeline_id: 管道ID
        flow_rate: 流量 (m³/h)

    Returns:
        完整的水力计算结果
    """
    try:
        client = get_java_client()

        request_data = {
            "pipelineId": pipeline_id,
            "flowRate": flow_rate
        }

        response = client.call_api(
            "/calculation/pipeline/hydraulics",
            method="POST",
            data=request_data
        )

        if response.get("code") != 200:
            return f"计算失败: {response.get('msg', '未知错误')}"

        result = response.get("data", {})

        return (
            f"管道水力计算结果:\n"
            f"\n【管道信息】\n"
            f"  - 管道ID: {pipeline_id}\n"
            f"  - 管道名称: {result.get('pipelineName', 'N/A')}\n"
            f"  - 计算流量: {flow_rate} m³/h\n"
            f"\n【水力特性】\n"
            f"  - 流速: {result.get('flowVelocity', 'N/A')} m/s\n"
            f"  - 雷诺数: {result.get('reynoldsNumber', 'N/A')}\n"
            f"  - 流态: {result.get('flowRegime', 'N/A')}\n"
            f"\n【压降分析】\n"
            f"  - 沿程损失: {result.get('frictionHeadLoss', 'N/A')} m\n"
            f"  - 水力坡降: {result.get('hydraulicSlope', 'N/A')} m/km\n"
            f"  - 高程差压头: {result.get('elevationHead', 'N/A')} m\n"
            f"\n【泵站需求】\n"
            f"  - 总压头需求: {result.get('totalHeadRequired', 'N/A')} m\n"
            f"  - 建议泵型: {result.get('recommendedPump', 'N/A')}"
        )

    except Exception as e:
        logger.error(f"管道水力计算失败: {e}")
        return f"计算失败: {str(e)}"


@tool
def check_java_service_health() -> str:
    """
    检查Java计算服务是否可用

    Returns:
        服务状态信息
    """
    try:
        client = get_java_client()

        response = client.call_api(
            "/actuator/health",
            method="GET"
        )

        status = response.get("status", "UNKNOWN")
        if status == "UP":
            return "Java计算服务运行正常"
        else:
            return f"Java计算服务状态异常: {status}"

    except httpx.ConnectError:
        return "Java计算服务无法连接，请检查服务是否启动"
    except Exception as e:
        return f"健康检查失败: {str(e)}"


# ==================== 工具集合 ====================

JAVA_SERVICE_TOOLS = [
    call_hydraulic_analysis,
    call_pump_optimization,
    get_pipeline_hydraulics,
    check_java_service_health
]

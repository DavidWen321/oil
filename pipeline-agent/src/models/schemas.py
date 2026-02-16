"""
Pydantic 数据模型
用于API请求/响应和数据验证
"""

from datetime import datetime
from typing import Optional, List, Any, Literal
from pydantic import BaseModel, Field
from decimal import Decimal

from .enums import IntentType, FlowRegime, KnowledgeCategory


# ==================== API 请求/响应模型 ====================

class ChatRequest(BaseModel):
    """对话请求"""
    message: str = Field(..., min_length=1, max_length=2000, description="用户消息")
    session_id: Optional[str] = Field(None, description="会话ID，不传则新建会话")
    stream: bool = Field(False, description="是否流式响应")


class ChatResponse(BaseModel):
    """对话响应"""
    response: str = Field(..., description="AI回复")
    session_id: str = Field(..., description="会话ID")
    sources: List[dict] = Field(default_factory=list, description="引用来源")
    intent: Optional[str] = Field(None, description="识别的意图")
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="置信度")
    execution_time_ms: int = Field(0, description="执行耗时(毫秒)")
    trace_id: Optional[str] = Field(None, description="追踪ID")
    tool_calls: List[dict] = Field(default_factory=list, description="本轮工具调用记录")


class StreamChunk(BaseModel):
    """流式响应块"""
    chunk: str = Field(..., description="响应片段")
    done: bool = Field(False, description="是否完成")
    sources: Optional[List[dict]] = Field(None, description="引用来源(完成时返回)")


# ==================== 业务数据模型 ====================

class ProjectInfo(BaseModel):
    """项目信息"""
    pro_id: int
    number: str
    name: str
    responsible: Optional[str] = None
    build_date: Optional[datetime] = None
    description: Optional[str] = None


class PipelineInfo(BaseModel):
    """管道信息"""
    id: int
    pro_id: int
    name: str
    length: Decimal = Field(..., description="长度(km)")
    diameter: Decimal = Field(..., description="外径(mm)")
    thickness: Decimal = Field(..., description="壁厚(mm)")
    roughness: Optional[Decimal] = Field(None, description="粗糙度(mm)")
    throughput: Optional[Decimal] = Field(None, description="设计输量(万吨/年)")
    start_altitude: Optional[Decimal] = Field(None, description="起点高程(m)")
    end_altitude: Optional[Decimal] = Field(None, description="终点高程(m)")
    work_time: Optional[Decimal] = Field(None, description="年工作时间(h)")


class PumpStationInfo(BaseModel):
    """泵站信息"""
    id: int
    name: str
    pump_efficiency: Optional[Decimal] = Field(None, description="泵效率(%)")
    electric_efficiency: Optional[Decimal] = Field(None, description="电机效率(%)")
    displacement: Optional[Decimal] = Field(None, description="排量(m³/h)")
    come_power: Optional[Decimal] = Field(None, description="进站压力/功率")
    zmi480_lift: Optional[Decimal] = Field(None, description="ZMI480扬程(m)")
    zmi375_lift: Optional[Decimal] = Field(None, description="ZMI375扬程(m)")


class OilPropertyInfo(BaseModel):
    """油品信息"""
    id: int
    name: str
    density: Decimal = Field(..., description="密度(kg/m³)")
    viscosity: Decimal = Field(..., description="运动粘度(m²/s)")


# ==================== 计算相关模型 ====================

class HydraulicInput(BaseModel):
    """水力计算输入参数"""
    flow_rate: Decimal = Field(..., gt=0, description="流量(m³/h)")
    pipe_diameter: Decimal = Field(..., gt=0, description="管内径(mm)")
    pipe_length: Decimal = Field(..., gt=0, description="管道长度(km)")
    oil_density: Decimal = Field(..., gt=0, description="油品密度(kg/m³)")
    oil_viscosity: Decimal = Field(..., gt=0, description="运动粘度(m²/s)")
    roughness: Decimal = Field(default=Decimal("0.03"), description="粗糙度(mm)")
    start_elevation: Decimal = Field(default=Decimal("0"), description="起点高程(m)")
    end_elevation: Decimal = Field(default=Decimal("0"), description="终点高程(m)")


class HydraulicResult(BaseModel):
    """水力计算结果"""
    # 基础参数
    flow_velocity: Decimal = Field(..., description="流速(m/s)")
    reynolds_number: Decimal = Field(..., description="雷诺数")
    flow_regime: FlowRegime = Field(..., description="流态")

    # 摩阻计算
    friction_factor: Decimal = Field(..., description="摩擦系数")
    friction_head_loss: Decimal = Field(..., description="沿程摩阻损失(m)")
    hydraulic_slope: Decimal = Field(..., description="水力坡降(m/km)")

    # 压力计算
    elevation_head: Decimal = Field(..., description="高程差引起的压头(m)")
    total_head_loss: Decimal = Field(..., description="总压头损失(m)")

    # 其他
    calculation_method: str = Field(..., description="计算方法")


class OptimizationInput(BaseModel):
    """泵站优化输入"""
    pipeline_id: int = Field(..., description="管道ID")
    target_flow: Decimal = Field(..., gt=0, description="目标流量(m³/h)")
    min_end_pressure: Decimal = Field(default=Decimal("0.3"), description="最小末站压力(MPa)")


class PumpCombination(BaseModel):
    """泵组合方案"""
    pump_type_1: str = Field(..., description="泵型号1")
    pump_count_1: int = Field(..., ge=0, description="泵数量1")
    pump_type_2: str = Field(..., description="泵型号2")
    pump_count_2: int = Field(..., ge=0, description="泵数量2")
    total_head: Decimal = Field(..., description="总扬程(m)")
    end_pressure: Decimal = Field(..., description="末站压力(MPa)")
    power_consumption: Decimal = Field(..., description="功耗(kW)")
    is_feasible: bool = Field(..., description="是否可行")


class OptimizationResult(BaseModel):
    """泵站优化结果"""
    optimal_combination: PumpCombination = Field(..., description="最优方案")
    all_combinations: List[PumpCombination] = Field(..., description="所有方案")
    optimization_target: str = Field(..., description="优化目标")
    constraints: dict = Field(..., description="约束条件")


# ==================== 知识库相关模型 ====================

class KnowledgeChunk(BaseModel):
    """知识块"""
    chunk_id: str
    content: str
    context: Optional[str] = Field(None, description="Contextual Retrieval生成的上下文")
    source_doc: str
    category: KnowledgeCategory
    hypothetical_questions: List[str] = Field(default_factory=list, description="HyPE生成的假设问题")
    metadata: dict = Field(default_factory=dict)


class SearchResult(BaseModel):
    """检索结果"""
    chunk: KnowledgeChunk
    score: float = Field(..., ge=0.0, le=1.0, description="相关性分数")
    match_type: str = Field(..., description="匹配类型: dense/sparse/hybrid")


class RAGApiResponse(BaseModel):
    """RAG API响应"""
    answer: str
    sources: List[SearchResult]
    retrieval_quality: str = Field(..., description="检索质量: high/medium/low")
    should_fallback: bool = Field(False, description="是否需要降级(Web搜索)")


# ==================== 工具调用相关 ====================

class ToolCall(BaseModel):
    """工具调用记录"""
    tool_name: str
    arguments: dict
    result: Any
    success: bool
    error_message: Optional[str] = None
    duration_ms: int


class AgentDecision(BaseModel):
    """Agent决策"""
    intent: IntentType
    reasoning: str
    sub_tasks: List[dict]
    confidence: float


# ==================== Agent v4 扩展模型 ====================

class HITLConfirmRequest(BaseModel):
    """HITL确认请求"""

    session_id: str = Field(..., description="会话ID")
    response: Optional[dict] = Field(default=None, description="用户确认内容（兼容旧格式）")
    selected_option: Optional[str] = Field(default=None, description="选择的方案ID")
    comment: Optional[str] = Field(default=None, description="用户备注")
    modified_data: Optional[dict] = Field(default=None, description="用户修改后的数据")
    request_id: Optional[str] = Field(default=None, description="请求ID")


class HITLConfirmResponse(BaseModel):
    """HITL确认响应"""

    status: Literal["resumed"] = "resumed"
    result: dict = Field(default_factory=dict)


class TraceSummaryResponse(BaseModel):
    """追踪摘要响应"""

    trace_id: str
    metrics: dict = Field(default_factory=dict)
    event_count: int = 0
    timeline: List[dict] = Field(default_factory=list)


class ReportGenerateRequest(BaseModel):
    """报告生成请求"""

    user_request: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None


class ReportGenerateResponse(BaseModel):
    """报告生成响应"""

    trace_id: str
    report: dict = Field(default_factory=dict)
    java_report_id: Optional[int] = None
    java_download_url: Optional[str] = None
    java_download_url_pdf: Optional[str] = None


class GraphQueryResponse(BaseModel):
    """知识图谱查询响应"""

    query: str
    result: dict = Field(default_factory=dict)

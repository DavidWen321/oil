"""
Pydantic API and domain schemas.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

from .enums import FlowRegime, IntentType, KnowledgeCategory


class ChatRequest(BaseModel):
    """Chat request payload."""

    message: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None
    stream: bool = False


class ChatResponse(BaseModel):
    """Chat response payload."""

    response: str
    session_id: str
    sources: List[dict] = Field(default_factory=list)
    intent: Optional[str] = None
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    execution_time_ms: int = 0
    trace_id: Optional[str] = None
    tool_calls: List[dict] = Field(default_factory=list)


class StreamChunk(BaseModel):
    """Streaming response chunk."""

    chunk: str
    done: bool = False
    sources: Optional[List[dict]] = None


class ProjectInfo(BaseModel):
    """Project information."""

    pro_id: int
    number: str
    name: str
    responsible: Optional[str] = None
    build_date: Optional[datetime] = None
    description: Optional[str] = None


class PipelineInfo(BaseModel):
    """Pipeline information."""

    id: int
    pro_id: int
    name: str
    length: Decimal
    diameter: Decimal
    thickness: Decimal
    roughness: Optional[Decimal] = None
    throughput: Optional[Decimal] = None
    start_altitude: Optional[Decimal] = None
    end_altitude: Optional[Decimal] = None
    work_time: Optional[Decimal] = None


class PumpStationInfo(BaseModel):
    """Pump station information."""

    id: int
    name: str
    pump_efficiency: Optional[Decimal] = None
    electric_efficiency: Optional[Decimal] = None
    displacement: Optional[Decimal] = None
    come_power: Optional[Decimal] = None
    zmi480_lift: Optional[Decimal] = None
    zmi375_lift: Optional[Decimal] = None


class OilPropertyInfo(BaseModel):
    """Oil property information."""

    id: int
    name: str
    density: Decimal
    viscosity: Decimal


class HydraulicInput(BaseModel):
    """Hydraulic calculation input."""

    flow_rate: Decimal = Field(..., gt=0)
    pipe_diameter: Decimal = Field(..., gt=0)
    pipe_length: Decimal = Field(..., gt=0)
    oil_density: Decimal = Field(..., gt=0)
    oil_viscosity: Decimal = Field(..., gt=0)
    roughness: Decimal = Decimal("0.03")
    start_elevation: Decimal = Decimal("0")
    end_elevation: Decimal = Decimal("0")


class HydraulicResult(BaseModel):
    """Hydraulic calculation result."""

    flow_velocity: Decimal
    reynolds_number: Decimal
    flow_regime: FlowRegime
    friction_factor: Decimal
    friction_head_loss: Decimal
    hydraulic_slope: Decimal
    elevation_head: Decimal
    total_head_loss: Decimal
    calculation_method: str


class OptimizationInput(BaseModel):
    """Optimization input."""

    pipeline_id: int
    target_flow: Decimal = Field(..., gt=0)
    min_end_pressure: Decimal = Decimal("0.3")


class PumpCombination(BaseModel):
    """Pump combination."""

    pump_type_1: str
    pump_count_1: int = Field(..., ge=0)
    pump_type_2: str
    pump_count_2: int = Field(..., ge=0)
    total_head: Decimal
    end_pressure: Decimal
    power_consumption: Decimal
    is_feasible: bool


class OptimizationResult(BaseModel):
    """Optimization result."""

    optimal_combination: PumpCombination
    all_combinations: List[PumpCombination]
    optimization_target: str
    constraints: dict


class KnowledgeChunk(BaseModel):
    """Knowledge chunk."""

    chunk_id: str
    content: str
    context: Optional[str] = None
    source_doc: str
    category: KnowledgeCategory
    hypothetical_questions: List[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class SearchResult(BaseModel):
    """Knowledge search result."""

    chunk: KnowledgeChunk
    score: float = Field(..., ge=0.0, le=1.0)
    match_type: str


class RAGApiResponse(BaseModel):
    """RAG response."""

    answer: str
    sources: List[SearchResult]
    retrieval_quality: str
    should_fallback: bool = False


class ToolCall(BaseModel):
    """Tool execution record."""

    tool_name: str
    arguments: dict
    result: Any
    success: bool
    error_message: Optional[str] = None
    duration_ms: int


class AgentDecision(BaseModel):
    """Agent routing decision."""

    intent: IntentType
    reasoning: str
    sub_tasks: List[dict]
    confidence: float


class HITLConfirmRequest(BaseModel):
    """HITL confirmation request."""

    session_id: str
    response: Optional[dict] = None
    selected_option: Optional[str] = None
    comment: Optional[str] = None
    modified_data: Optional[dict] = None
    request_id: Optional[str] = None


class HITLConfirmResponse(BaseModel):
    """HITL confirmation response."""

    status: Literal["resumed"] = "resumed"
    result: dict = Field(default_factory=dict)


class TraceSummaryResponse(BaseModel):
    """Trace summary response."""

    trace_id: str
    metrics: dict = Field(default_factory=dict)
    event_count: int = 0
    timeline: List[dict] = Field(default_factory=list)


class GraphQueryResponse(BaseModel):
    """Knowledge graph query response."""

    query: str
    result: dict = Field(default_factory=dict)

"""方案卡（Scheme Card）数据模型。"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ApprovalStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


@dataclass
class EvidenceItem:
    type: str
    title: str
    content: str
    source: str
    confidence: float
    timestamp: str = ""

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "title": self.title,
            "content": self.content,
            "source": self.source,
            "confidence": self.confidence,
            "timestamp": self.timestamp,
        }


@dataclass
class SchemeOption:
    id: str
    name: str
    description: str
    parameters: dict
    results: dict
    advantages: list[str]
    disadvantages: list[str]
    energy_saving_kwh: Optional[float] = None
    carbon_reduction_kg: Optional[float] = None
    cost_saving_yuan: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "results": self.results,
            "advantages": self.advantages,
            "disadvantages": self.disadvantages,
            "energy_saving_kwh": self.energy_saving_kwh,
            "carbon_reduction_kg": self.carbon_reduction_kg,
            "cost_saving_yuan": self.cost_saving_yuan,
        }


@dataclass
class SchemeCard:
    card_id: str
    title: str
    task_objective: str
    created_at: str = ""
    created_by: str = ""
    session_id: str = ""
    current_conditions: dict = field(default_factory=dict)
    schemes: list[SchemeOption] = field(default_factory=list)
    recommended_scheme_id: str = ""
    recommendation_reason: str = ""
    evidence: list[EvidenceItem] = field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.LOW
    risk_factors: list[str] = field(default_factory=list)
    standard_references: list[str] = field(default_factory=list)
    rollback_plan: str = ""
    requires_approval: bool = False
    approval_status: ApprovalStatus = ApprovalStatus.DRAFT
    approval_role: str = ""
    approval_comment: str = ""
    execution_status: str = "not_started"
    actual_results: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "card_id": self.card_id,
            "title": self.title,
            "task_objective": self.task_objective,
            "created_at": self.created_at or datetime.now().isoformat(),
            "created_by": self.created_by,
            "session_id": self.session_id,
            "current_conditions": self.current_conditions,
            "schemes": [scheme.to_dict() for scheme in self.schemes],
            "recommended_scheme_id": self.recommended_scheme_id,
            "recommendation_reason": self.recommendation_reason,
            "evidence": [item.to_dict() for item in self.evidence],
            "risk_level": self.risk_level.value,
            "risk_factors": self.risk_factors,
            "standard_references": self.standard_references,
            "rollback_plan": self.rollback_plan,
            "requires_approval": self.requires_approval,
            "approval_status": self.approval_status.value,
            "approval_role": self.approval_role,
            "approval_comment": self.approval_comment,
            "execution_status": self.execution_status,
            "actual_results": self.actual_results,
        }

from __future__ import annotations

from typing import Any

from src.models.schemas import DynamicReportAiAnalysis

from .metric_skill import metric_skill
from .risk_skill import risk_skill
from .suggestion_skill import suggestion_skill
from .summary_skill import summary_skill


def build_report_ai_sections(ctx: dict[str, Any]) -> DynamicReportAiAnalysis:
    return DynamicReportAiAnalysis(
        summary=summary_skill(ctx),
        metricAnalysis=metric_skill(ctx),
        riskJudgement=risk_skill(ctx),
        suggestions=suggestion_skill(ctx),
    )


__all__ = ["build_report_ai_sections"]

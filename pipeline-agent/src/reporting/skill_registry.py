from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from src.models.schemas import DynamicReportAiAnalysis, DynamicReportRequest, DynamicReportSection

from .llm_writer import explain_report
from .outline_planner import plan_outline
from .report_types import DecisionResult, DiagnosisResult, MetricSnapshot, OutlinePlan, ReportDataBundle
from .section_generator import build_sections
from .skills import (
    build_empty_report_ai_sections,
    build_optimization_report_ai_sections,
    build_report_ai_sections,
    build_sensitivity_report_ai_sections,
)

OutlineBuilder = Callable[
    [DynamicReportRequest, MetricSnapshot, DiagnosisResult, DecisionResult, str],
    OutlinePlan,
]
SectionBuilder = Callable[
    [DynamicReportRequest, ReportDataBundle, MetricSnapshot, DiagnosisResult, DecisionResult, OutlinePlan],
    list[DynamicReportSection],
]
AiAnalysisBuilder = Callable[[dict[str, Any]], DynamicReportAiAnalysis]
PolishBuilder = Callable[[dict[str, Any], DynamicReportRequest], dict[str, Any]]
RequestMatcher = Callable[[DynamicReportRequest], bool]


@dataclass(frozen=True)
class ReportSkillProfile:
    key: str
    matches: RequestMatcher
    build_outline: OutlineBuilder
    build_sections: SectionBuilder
    build_ai_analysis: AiAnalysisBuilder
    polish_report: PolishBuilder


def _hydraulic_matches(request: DynamicReportRequest) -> bool:
    prompt = str(request.user_prompt or "")
    focuses = {str(item).strip() for item in request.focuses}
    hydraulic_focuses = {
        "\u96f7\u8bfa\u6570",
        "\u6d41\u6001",
        "\u6469\u963b\u635f\u5931",
        "\u6c34\u529b\u5761\u964d",
        "\u603b\u626c\u7a0b",
        "\u672b\u7ad9\u8fdb\u7ad9\u538b\u5934",
    }
    return "\u6c34\u529b" in prompt or bool(hydraulic_focuses & focuses)


def _sensitivity_matches(request: DynamicReportRequest) -> bool:
    if request.sensitivity_snapshot:
        return True
    prompt = str(request.user_prompt or "")
    focuses = {str(item).strip() for item in request.focuses}
    sensitivity_focuses = {
        "\u57fa\u51c6\u7ed3\u679c",
        "\u654f\u611f\u7cfb\u6570",
        "\u6700\u5927\u5f71\u54cd\u5e45\u5ea6",
        "\u6392\u540d",
        "\u538b\u529b\u53d8\u5316\u8d8b\u52bf",
        "\u6469\u963b\u635f\u5931\u53d8\u5316\u8d8b\u52bf",
        "\u6d41\u6001\u53d8\u5316",
    }
    return "\u654f\u611f" in prompt or bool(sensitivity_focuses & focuses)


def _optimization_matches(request: DynamicReportRequest) -> bool:
    return bool(request.optimization_snapshot)


def _generic_matches(request: DynamicReportRequest) -> bool:
    return True


REPORT_SKILL_PROFILES: tuple[ReportSkillProfile, ...] = (
    ReportSkillProfile(
        key="sensitivity",
        matches=_sensitivity_matches,
        build_outline=plan_outline,
        build_sections=build_sections,
        build_ai_analysis=build_sensitivity_report_ai_sections,
        polish_report=explain_report,
    ),
    ReportSkillProfile(
        key="optimization",
        matches=_optimization_matches,
        build_outline=plan_outline,
        build_sections=build_sections,
        build_ai_analysis=build_optimization_report_ai_sections,
        polish_report=explain_report,
    ),
    ReportSkillProfile(
        key="hydraulic",
        matches=_hydraulic_matches,
        build_outline=plan_outline,
        build_sections=build_sections,
        build_ai_analysis=build_report_ai_sections,
        polish_report=explain_report,
    ),
    ReportSkillProfile(
        key="generic",
        matches=_generic_matches,
        build_outline=plan_outline,
        build_sections=build_sections,
        build_ai_analysis=build_empty_report_ai_sections,
        polish_report=explain_report,
    ),
)


def resolve_report_skill(request: DynamicReportRequest) -> ReportSkillProfile:
    for profile in REPORT_SKILL_PROFILES:
        if profile.matches(request):
            return profile
    return REPORT_SKILL_PROFILES[-1]


__all__ = ["ReportSkillProfile", "REPORT_SKILL_PROFILES", "resolve_report_skill"]

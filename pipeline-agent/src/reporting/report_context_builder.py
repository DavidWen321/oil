from __future__ import annotations

from typing import Any

from src.models.schemas import DynamicReportRequest

from .labeling import analysis_object_label, optimization_goal_label, output_style_label, report_type_label
from .report_types import DecisionResult, DiagnosisResult, MetricSnapshot, ReportDataBundle


def _pick_data_source(user_prompt: str | None) -> str:
    if not user_prompt:
        return "主数据 + 计算结果"
    for line in user_prompt.splitlines():
        if "数据来源" in line:
            parts = line.split("：", maxsplit=1)
            if len(parts) == 2 and parts[1].strip():
                return parts[1].strip()
    return "主数据 + 计算结果"


def _pick_external_api(user_prompt: str | None) -> str:
    if not user_prompt:
        return "不启用"
    for line in user_prompt.splitlines():
        if "外部知识增强" in line:
            parts = line.split("：", maxsplit=1)
            if len(parts) == 2 and parts[1].strip():
                return parts[1].strip()
    return "不启用"


def build_report_context(
    request: DynamicReportRequest,
    data: ReportDataBundle,
    metrics: MetricSnapshot,
    diagnosis: DiagnosisResult,
    decision: DecisionResult,
) -> dict[str, Any]:
    project_names = [str(item.get("name") or "-") for item in data.projects]
    pipeline_name = request.selected_pipeline_name or (str(data.pipelines[0].get("name")) if data.pipelines else "-")
    pump_scope = "全部泵站" if not request.selected_pump_station_names else "指定泵站"
    oil_name = request.selected_oil_name or (str(data.oil_properties[0].get("name")) if data.oil_properties else "-")

    return {
        "report_meta": {
            "project_name": "、".join(project_names) if project_names else "-",
            "report_type": report_type_label(request),
            "focus_points": request.focuses or [],
            "output_style": output_style_label(request),
        },
        "scope": {
            "analysis_object": analysis_object_label(request.analysis_object),
            "pipeline_name": pipeline_name,
            "pump_station_scope": pump_scope,
            "oil_type": oil_name,
            "data_source": _pick_data_source(request.user_prompt),
        },
        "constraints": {
            "target_throughput": request.target_throughput,
            "min_outlet_pressure": request.min_pressure,
            "optimization_goal": optimization_goal_label(request.optimization_goal),
            "allow_combination": bool(request.allow_pump_adjust),
            "external_api_enhance": _pick_external_api(request.user_prompt),
        },
        "diagnosis": {
            "issues": [item.__dict__ for item in diagnosis.issues],
            "risks": diagnosis.risks,
            "causes": [item.__dict__ for item in diagnosis.causes],
        },
        "decision": {
            "recommended_options": [item.__dict__ for item in decision.recommended_options],
            "fallback_options": [item.__dict__ for item in decision.fallback_options],
            "rejected_options": [item.__dict__ for item in decision.rejected_options],
            "summary": decision.summary,
            "weights": decision.weights,
        },
        "object_profiles": metrics.object_metrics,
        "raw_metrics": metrics.overview_metrics,
    }

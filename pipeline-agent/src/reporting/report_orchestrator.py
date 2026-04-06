from __future__ import annotations

from src.models.schemas import DynamicReportRequest, DynamicReportResponse

from .data_loader import load_report_data
from .diagnosis_engine import DiagnosisEngine
from .labeling import output_style_key, range_label, report_type_label
from .llm_writer import explain_report
from .metric_engine import build_metric_snapshot
from .outline_planner import plan_outline
from .section_generator import (
    build_highlights,
    build_raw_text,
    build_sections,
    build_summary,
    build_risk_items,
    build_suggestion_items,
)


def _title_prefix(projects: list[dict]) -> str:
    names = [str(item.get("name") or "-") for item in projects]
    if not names:
        return "全局"
    if len(names) <= 3:
        return "、".join(names)
    return f"{'、'.join(names[:3])}等{len(names)}个项目"


def generate_report(request: DynamicReportRequest) -> DynamicReportResponse:
    data = load_report_data(request)
    metrics = build_metric_snapshot(data, request)
    diagnosis = DiagnosisEngine().run(data, metrics, request)
    outline = plan_outline(request, metrics, diagnosis, _title_prefix(data.projects))
    sections = build_sections(request, data, metrics, diagnosis, outline)
    scope_rows = next((section.table.rows for section in sections if section.id == "scope-context" and section.table), [])

    summary = build_summary(diagnosis, metrics)
    highlights = build_highlights(diagnosis, metrics)
    conclusion = sections[-1].content if sections and sections[-1].id == "conclusion" else ""
    risks = build_risk_items(diagnosis)
    suggestions = build_suggestion_items(diagnosis)

    llm_input = {
        "report_context": {
            "report_type": report_type_label(request),
            "range_label": range_label(request),
            "output_style": request.output_style or "professional",
            "analysis_object": request.analysis_object or "project",
            "user_goal": request.optimization_goal or "",
            "focuses": request.focuses,
            "user_prompt": request.user_prompt or "",
        },
        "facts": {
            "overview_metrics": metrics.overview_metrics,
            "trends": [item.__dict__ for item in diagnosis.trends],
            "anomalies": [item.__dict__ for item in diagnosis.anomalies],
            "causes": [item.__dict__ for item in diagnosis.causes],
            "constraints": [item.__dict__ for item in diagnosis.constraints],
            "recommendations": [item.__dict__ for item in diagnosis.recommendations],
        },
        "outline": [item.__dict__ for item in outline.sections],
        "draft": {
            "title": outline.title,
            "abstract": outline.abstract,
            "summary": summary,
            "highlights": highlights,
            "conclusion": conclusion,
        },
    }
    polished = explain_report(llm_input, request)
    section_summaries = polished.get("section_summaries") if isinstance(polished.get("section_summaries"), dict) else {}
    if section_summaries:
        sections = [
            section.model_copy(
                update={
                    "summary": str(section_summaries.get(section.id) or section.summary or "").strip() or section.summary
                }
            )
            for section in sections
        ]

    final_title = str(polished.get("title") or outline.title).strip()
    final_abstract = str(polished.get("abstract") or outline.abstract).strip()
    final_summary = [str(item).strip() for item in polished.get("summary") or summary if str(item).strip()]
    final_highlights = [str(item).strip() for item in polished.get("highlights") or highlights if str(item).strip()]
    final_conclusion = str(polished.get("conclusion") or conclusion).strip()

    return DynamicReportResponse(
        title=final_title,
        abstract=final_abstract,
        source="hybrid" if polished else "rules",
        summary=final_summary,
        highlights=final_highlights,
        risks=risks,
        suggestions=suggestions,
        conclusion=final_conclusion,
        sections=sections,
        metadata={
            "request": request.model_dump(),
            "range_label": range_label(request),
            "report_type_label": report_type_label(request),
            "output_style": output_style_key(request),
            "selected_project_count": len(data.projects),
            "pipeline_count": len(data.pipelines),
            "pump_station_count": len(data.pump_stations),
            "oil_property_count": len(data.oil_properties),
            "history_total_count": metrics.overview_metrics.get("history_total_count"),
            "confidence": diagnosis.confidence,
            "scope_rows": scope_rows,
            "outline": [item.__dict__ for item in outline.sections],
        },
        raw_text=build_raw_text(outline, diagnosis, metrics, sections),
    )

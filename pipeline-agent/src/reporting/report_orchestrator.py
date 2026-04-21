from __future__ import annotations

import json
import time
from typing import Any

from src.models.schemas import DynamicReportRequest, DynamicReportResponse
from src.utils import logger

from .data_loader import load_report_data
from .decision_engine import DecisionEngine
from .diagnosis_engine import DiagnosisEngine
from .labeling import output_style_key, range_label, report_type_label
from .metric_engine import build_metric_snapshot
from .official_research import collect_official_research
from .report_context_builder import build_report_context
from .section_generator import (
    build_highlights,
    build_raw_text,
    build_risk_items,
    build_suggestion_items,
    build_summary,
)
from .sensitivity_facts import (
    extract_primary_sensitivity,
    extract_ranked_sensitivities,
    sensitivity_term_aliases,
)
from .skill_registry import resolve_report_skill


def _title_prefix(projects: list[dict[str, Any]]) -> str:
    names = [str(item.get("name") or "-") for item in projects]
    if not names:
        return "\u5168\u5c40"
    if len(names) <= 3:
        return "\u3001".join(names)
    return "\u3001".join(names[:3]) + f" \u7b49{len(names)}\u4e2a\u9879\u76ee"


def _compact_value(
    value: Any,
    *,
    depth: int = 0,
    max_depth: int = 3,
    max_items: int = 6,
    max_text_length: int = 180,
) -> Any:
    if value is None or isinstance(value, (int, float, bool)):
        return value
    if isinstance(value, str):
        text = value.strip()
        if len(text) <= max_text_length:
            return text
        return f"{text[:max_text_length]}..."
    if depth >= max_depth:
        if isinstance(value, dict):
            return f"<dict:{len(value)}>"
        if isinstance(value, list):
            return f"<list:{len(value)}>"
        return str(value)
    if isinstance(value, list):
        compacted = [
            _compact_value(
                item,
                depth=depth + 1,
                max_depth=max_depth,
                max_items=max_items,
                max_text_length=max_text_length,
            )
            for item in value[:max_items]
        ]
        if len(value) > max_items:
            compacted.append(f"...({len(value) - max_items} more)")
        return compacted
    if isinstance(value, dict):
        compacted: dict[str, Any] = {}
        for index, key in enumerate(value):
            if index >= max_items:
                compacted["_truncated_keys"] = len(value) - max_items
                break
            compacted[str(key)] = _compact_value(
                value[key],
                depth=depth + 1,
                max_depth=max_depth,
                max_items=max_items,
                max_text_length=max_text_length,
            )
        return compacted
    return str(value)


def _mentions_primary_sensitivity(text: str, primary_sensitivity: dict[str, Any]) -> bool:
    aliases = sensitivity_term_aliases(
        primary_sensitivity.get("rawVariableName")
        or primary_sensitivity.get("variableName")
        or primary_sensitivity.get("variableType")
    )
    normalized_text = str(text or "").lower()
    return any(str(alias).lower() in normalized_text for alias in aliases if str(alias).strip())


def _filter_official_conclusions(
    items: list[str],
    *,
    profile_key: str,
    primary_sensitivity: dict[str, Any],
) -> list[str]:
    if profile_key != "sensitivity" or not primary_sensitivity:
        return items
    primary_items = [item for item in items if _mentions_primary_sensitivity(item, primary_sensitivity)]
    if primary_items or not items:
        other_items = [item for item in items if item not in primary_items]
        return primary_items + other_items

    logger.warning(
        "Official conclusions rejected because they did not mention primary sensitivity variable | variable={} count={}",
        primary_sensitivity.get("variableName"),
        len(items),
    )
    return []


def _build_llm_input(
    request: DynamicReportRequest,
    *,
    metrics,
    diagnosis,
    decision,
    outline,
    report_context: dict[str, Any],
    official_research: dict[str, Any],
    summary: list[str],
    highlights: list[str],
    conclusion: str,
) -> dict[str, Any]:
    charts = report_context.get("charts") or {}
    history = report_context.get("history") or {}
    primary_sensitivity = extract_primary_sensitivity(report_context)
    ranked_sensitivities = extract_ranked_sensitivities(report_context)

    compact_report_context = {
        "project": _compact_value(report_context.get("project"), max_items=8),
        "params": _compact_value(report_context.get("params"), max_items=10),
        "charts": {
            "historyDaily": _compact_value(charts.get("historyDaily", [])[-7:], max_items=7),
            "operationDaily": _compact_value(charts.get("operationDaily", [])[-7:], max_items=7),
            "operationPoints": _compact_value(charts.get("operationPoints", [])[-6:], max_items=6),
        },
        "metrics": _compact_value(report_context.get("metrics"), max_items=12),
        "history": {
            "total": history.get("total"),
            "success": history.get("success"),
            "failed": history.get("failed"),
            "successRate": history.get("successRate"),
            "recentRecords": _compact_value(history.get("records", [])[-3:], max_items=3),
        },
        "hydraulic_snapshot": _compact_value(report_context.get("hydraulic_snapshot"), max_items=8),
        "optimization_snapshot": _compact_value(report_context.get("optimization_snapshot"), max_items=8),
        "sensitivity_snapshot": _compact_value(report_context.get("sensitivity_snapshot"), max_items=8),
        "risk_flags": _compact_value(report_context.get("risk_flags", [])[:6], max_items=6),
        "pump_data": _compact_value(report_context.get("pump_data", [])[:6], max_items=6),
        "report_meta": _compact_value(report_context.get("report_meta"), max_items=8),
        "scope": _compact_value(report_context.get("scope"), max_items=8),
        "constraints": _compact_value(report_context.get("constraints"), max_items=8),
        "diagnosis": _compact_value(report_context.get("diagnosis"), max_items=6),
        "decision": _compact_value(report_context.get("decision"), max_items=6),
    }

    return {
        "request": _compact_value(request.model_dump(), max_items=12),
        "report_context": compact_report_context,
        "facts": {
            "overview_metrics": _compact_value(metrics.overview_metrics, max_items=12),
            "primary_sensitivity": _compact_value(primary_sensitivity, max_items=8),
            "ranked_sensitivities": _compact_value(ranked_sensitivities, max_items=5),
            "trends": _compact_value([item.__dict__ for item in diagnosis.trends[:4]], max_items=4),
            "issues": _compact_value([item.__dict__ for item in diagnosis.issues[:6]], max_items=6),
            "anomalies": _compact_value([item.__dict__ for item in diagnosis.anomalies[:4]], max_items=4),
            "causes": _compact_value([item.__dict__ for item in diagnosis.causes[:4]], max_items=4),
            "constraints": _compact_value([item.__dict__ for item in diagnosis.constraints[:6]], max_items=6),
            "recommendations": _compact_value([item.__dict__ for item in diagnosis.recommendations[:6]], max_items=6),
            "decision": _compact_value(
                {
                    "recommended_options": [item.__dict__ for item in decision.recommended_options[:4]],
                    "fallback_options": [item.__dict__ for item in decision.fallback_options[:3]],
                    "rejected_options": [item.__dict__ for item in decision.rejected_options[:3]],
                    "summary": decision.summary,
                    "weights": decision.weights,
                },
                max_items=8,
            ),
        },
        "official_research": {
            "status": official_research.get("status"),
            "queries": _compact_value(official_research.get("queries", [])[:5], max_items=5),
            "references": _compact_value(official_research.get("references", [])[:4], max_items=4),
            "searched_at": official_research.get("searched_at"),
        },
        "outline": _compact_value([item.__dict__ for item in outline.sections], max_items=8),
        "draft": {
            "title": outline.title,
            "abstract": outline.abstract,
            "summary": summary,
            "highlights": highlights,
            "conclusion": conclusion,
        },
    }


def generate_report(request: DynamicReportRequest) -> DynamicReportResponse:
    total_started_at = time.perf_counter()
    skill_profile = resolve_report_skill(request)

    stage_started_at = time.perf_counter()
    data = load_report_data(request)
    load_ms = (time.perf_counter() - stage_started_at) * 1000

    stage_started_at = time.perf_counter()
    metrics = build_metric_snapshot(data, request)
    metrics_ms = (time.perf_counter() - stage_started_at) * 1000

    stage_started_at = time.perf_counter()
    diagnosis = DiagnosisEngine().run(data, metrics, request)
    diagnosis_ms = (time.perf_counter() - stage_started_at) * 1000

    stage_started_at = time.perf_counter()
    decision = DecisionEngine().run(data, metrics, diagnosis, request)
    decision_ms = (time.perf_counter() - stage_started_at) * 1000

    stage_started_at = time.perf_counter()
    outline = skill_profile.build_outline(request, metrics, diagnosis, decision, _title_prefix(data.projects))
    sections = skill_profile.build_sections(request, data, metrics, diagnosis, decision, outline)
    section_ms = (time.perf_counter() - stage_started_at) * 1000

    scope_rows = next((section.table.rows for section in sections if section.id == "scope-context" and section.table), [])

    summary = build_summary(diagnosis, metrics, decision)
    highlights = build_highlights(diagnosis, metrics, decision)
    conclusion = sections[-1].content if sections and sections[-1].id == "conclusion" else ""
    risks = build_risk_items(diagnosis)
    suggestions = build_suggestion_items(diagnosis)
    report_context = build_report_context(request, data, metrics, diagnosis, decision)
    primary_sensitivity = extract_primary_sensitivity(report_context)
    ranked_sensitivities = extract_ranked_sensitivities(report_context)
    official_research = collect_official_research(request, report_context, skill_profile.key)

    llm_input = _build_llm_input(
        request,
        metrics=metrics,
        diagnosis=diagnosis,
        decision=decision,
        outline=outline,
        report_context=report_context,
        official_research=official_research,
        summary=summary,
        highlights=highlights,
        conclusion=conclusion,
    )
    llm_input_kb = len(json.dumps(llm_input, ensure_ascii=False, default=str).encode("utf-8")) / 1024
    logger.info(
        "Dynamic report prepared | profile={} projects={} pipelines={} histories={} load_ms={:.0f} metrics_ms={:.0f} diagnosis_ms={:.0f} decision_ms={:.0f} section_ms={:.0f} llm_input_kb={:.1f}",
        skill_profile.key,
        len(data.projects),
        len(data.pipelines),
        len(data.history_records),
        load_ms,
        metrics_ms,
        diagnosis_ms,
        decision_ms,
        section_ms,
        llm_input_kb,
    )

    llm_started_at = time.perf_counter()
    polished = skill_profile.polish_report(llm_input, request)
    llm_ms = (time.perf_counter() - llm_started_at) * 1000

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
    official_conclusions = [
        str(item).strip()
        for item in polished.get("official_conclusions") or []
        if str(item).strip()
    ]
    official_conclusions = _filter_official_conclusions(
        official_conclusions,
        profile_key=skill_profile.key,
        primary_sensitivity=primary_sensitivity,
    )

    ai_analysis = skill_profile.build_ai_analysis(report_context)
    ai_summary = ai_analysis.summary
    ai_highlights = ai_analysis.schemeExplain or ai_analysis.comparison or ai_analysis.metricAnalysis or ai_analysis.changeAnalysis
    ai_risks = ai_analysis.riskJudgement or ai_analysis.riskIdentify

    total_ms = (time.perf_counter() - total_started_at) * 1000
    source = "hybrid" if polished else "rules"
    logger.info(
        "Dynamic report completed | profile={} source={} total_ms={:.0f} llm_ms={:.0f} section_count={}",
        skill_profile.key,
        source,
        total_ms,
        llm_ms,
        len(sections),
    )

    return DynamicReportResponse(
        title=final_title,
        abstract=final_abstract,
        source=source,
        aiAnalysis=ai_analysis,
        summary=ai_summary if ai_summary else final_summary,
        highlights=ai_highlights if ai_highlights else final_highlights,
        risks=ai_risks if ai_risks else risks,
        suggestions=ai_analysis.suggestions if ai_analysis.suggestions else suggestions,
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
            "skill_profile": skill_profile.key,
            "scope_rows": scope_rows,
            "outline": [item.__dict__ for item in outline.sections],
            "decision_summary": decision.summary,
            "official_research": official_research,
            "official_references": official_research.get("references", []),
            "official_conclusions": official_conclusions,
            "primary_sensitivity": primary_sensitivity,
            "ranked_sensitivities": ranked_sensitivities,
        },
        raw_text=build_raw_text(outline, diagnosis, metrics, decision, sections),
    )

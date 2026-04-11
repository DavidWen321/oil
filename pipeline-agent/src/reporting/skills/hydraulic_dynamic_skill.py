from __future__ import annotations

import json
from typing import Any

from langchain_openai import ChatOpenAI

from src.config import settings
from src.models.schemas import DynamicReportAiAnalysis, ReportRiskItem, ReportSuggestionItem
from src.utils import logger

from .metric_skill import metric_skill
from .risk_skill import risk_skill
from .suggestion_skill import suggestion_skill
from .summary_skill import summary_skill


def _as_record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _pick_number(record: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = record.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str) and value.strip():
            try:
                return float(value)
            except ValueError:
                continue
    return None


def _pick_text(record: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _round_number(value: float | None, digits: int = 3) -> float | None:
    if value is None:
        return None
    return round(value, digits)


def _normalize_level(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"high", "h", "high_risk"}:
        return "\u9ad8"
    if normalized in {"low", "l"}:
        return "\u4f4e"
    return "\u4e2d"


def _normalize_priority(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"high", "p0", "p1"}:
        return "high"
    if normalized in {"low", "p3"}:
        return "low"
    return "medium"


def _clean_lines(value: Any, limit: int = 4) -> list[str]:
    if not isinstance(value, list):
        return []
    items: list[str] = []
    for row in value:
        text = str(row or "").strip()
        if text:
            items.append(text)
        if len(items) >= limit:
            break
    return items


def _extract_json_object(text: str) -> dict[str, Any]:
    cleaned = str(text or "").replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        cleaned = cleaned[start : end + 1]
    parsed = json.loads(cleaned)
    return parsed if isinstance(parsed, dict) else {}


def _build_fallback(ctx: dict[str, Any]) -> DynamicReportAiAnalysis:
    return DynamicReportAiAnalysis(
        summary=summary_skill(ctx),
        metricAnalysis=metric_skill(ctx),
        riskJudgement=risk_skill(ctx),
        suggestions=suggestion_skill(ctx),
    )


def _build_fact_pack(ctx: dict[str, Any]) -> dict[str, Any]:
    snapshot = _as_record(ctx.get("hydraulic_snapshot"))
    input_payload = _as_record(snapshot.get("input"))
    output_payload = _as_record(snapshot.get("output"))
    metrics = _as_record(ctx.get("metrics"))
    history = _as_record(ctx.get("history"))
    params = _as_record(ctx.get("params"))
    diagnosis = _as_record(ctx.get("diagnosis"))
    decision = _as_record(ctx.get("decision"))
    risk_flags = [row for row in _as_list(ctx.get("risk_flags")) if isinstance(row, dict)]

    inlet_pressure = _pick_number(input_payload, "inletPressure")
    first_station_out_pressure = _pick_number(output_payload, "firstStationOutPressure")
    end_station_pressure = _pick_number(output_payload, "endStationInPressure", "endStationPressure")
    friction_head_loss = _pick_number(output_payload, "frictionHeadLoss")
    total_head = _pick_number(output_payload, "totalHead")
    reynolds_number = _pick_number(output_payload, "reynoldsNumber")
    hydraulic_slope = _pick_number(output_payload, "hydraulicSlope")
    start_altitude = _pick_number(input_payload, "startAltitude")
    end_altitude = _pick_number(input_payload, "endAltitude")
    elevation_diff = None
    if start_altitude is not None and end_altitude is not None:
        elevation_diff = end_altitude - start_altitude

    friction_share = None
    if friction_head_loss is not None and total_head not in (None, 0):
        friction_share = friction_head_loss / total_head

    head_drop = None
    if first_station_out_pressure is not None and end_station_pressure is not None:
        head_drop = first_station_out_pressure - end_station_pressure

    return {
        "reportType": "hydraulic",
        "projectName": snapshot.get("projectName") or _as_record(ctx.get("report_meta")).get("project_name") or "-",
        "generatedAt": snapshot.get("generatedAt"),
        "focusPoints": _as_list(params.get("focusPoints")),
        "inputParameters": {
            "flowRate": _round_number(_pick_number(input_payload, "flowRate"), 3),
            "density": _round_number(_pick_number(input_payload, "density"), 3),
            "viscosity": _round_number(_pick_number(input_payload, "viscosity"), 3),
            "length": _round_number(_pick_number(input_payload, "length"), 3),
            "diameter": _round_number(_pick_number(input_payload, "diameter"), 3),
            "roughness": _round_number(_pick_number(input_payload, "roughness"), 4),
            "startAltitude": _round_number(start_altitude, 3),
            "endAltitude": _round_number(end_altitude, 3),
            "inletPressure": _round_number(inlet_pressure, 3),
            "pump480Num": _round_number(_pick_number(input_payload, "pump480Num"), 0),
            "pump375Num": _round_number(_pick_number(input_payload, "pump375Num"), 0),
            "pump480Head": _round_number(_pick_number(input_payload, "pump480Head"), 3),
            "pump375Head": _round_number(_pick_number(input_payload, "pump375Head"), 3),
        },
        "resultMetrics": {
            "reynoldsNumber": _round_number(reynolds_number, 3),
            "flowRegime": _pick_text(output_payload, "flowRegime"),
            "frictionHeadLoss": _round_number(friction_head_loss, 3),
            "hydraulicSlope": _round_number(hydraulic_slope, 4),
            "totalHead": _round_number(total_head, 3),
            "firstStationOutPressure": _round_number(first_station_out_pressure, 3),
            "endStationInPressure": _round_number(end_station_pressure, 3),
        },
        "derivedFacts": {
            "elevationDifference": _round_number(elevation_diff, 3),
            "frictionShareOfTotalHead": _round_number(friction_share, 4),
            "headDropFromFirstToEnd": _round_number(head_drop, 3),
        },
        "historyOverview": {
            "total": int(history.get("total") or 0),
            "success": int(history.get("success") or 0),
            "failed": int(history.get("failed") or 0),
            "successRate": _round_number(_pick_number(history, "successRate"), 2),
        },
        "systemMetrics": {
            "avgPumpEfficiency": _round_number(_pick_number(metrics, "avg_pump_efficiency"), 4),
            "avgViscosity": _round_number(_pick_number(metrics, "avg_viscosity"), 3),
            "latestEndStationPressure": _round_number(_pick_number(metrics, "latest_end_station_pressure"), 3),
            "minPressureGap": _round_number(_pick_number(metrics, "min_pressure_gap"), 3),
            "targetFlowGap": _round_number(_pick_number(metrics, "target_flow_gap"), 3),
        },
        "riskItems": risk_flags[:4],
        "constraintChecks": [row for row in _as_list(diagnosis.get("constraints")) if isinstance(row, dict)][:4],
        "recommendationHints": [row for row in _as_list(diagnosis.get("recommendations")) if isinstance(row, dict)][:4],
        "decisionSummary": str(decision.get("summary") or "").strip(),
    }


def _coerce_risks(value: Any, fallback: list[ReportRiskItem]) -> list[ReportRiskItem]:
    if not isinstance(value, list):
        return fallback

    items: list[ReportRiskItem] = []
    for row in value[:4]:
        if not isinstance(row, dict):
            continue
        target = str(row.get("target") or row.get("name") or "-").strip() or "-"
        risk_type = str(row.get("riskType") or row.get("code") or row.get("type") or "hydraulic_risk").strip()
        reason = str(row.get("reason") or row.get("message") or "").strip()
        suggestion = str(
            row.get("suggestion")
            or row.get("action")
            or "\u5efa\u8bae\u7ed3\u5408\u5f53\u524d\u5de5\u51b5\u590d\u6838\u3002"
        ).strip()
        if not reason:
            continue
        items.append(
            ReportRiskItem(
                target=target,
                riskType=risk_type or "hydraulic_risk",
                level=_normalize_level(row.get("level")),
                reason=reason,
                suggestion=suggestion or "\u5efa\u8bae\u7ed3\u5408\u5f53\u524d\u5de5\u51b5\u590d\u6838\u3002",
                code=str(row.get("code") or risk_type or "").strip() or None,
                message=str(row.get("message") or reason).strip() or None,
            )
        )

    return items or fallback


def _coerce_suggestions(value: Any, fallback: list[ReportSuggestionItem]) -> list[ReportSuggestionItem]:
    if not isinstance(value, list):
        return fallback

    items: list[ReportSuggestionItem] = []
    for row in value[:4]:
        if not isinstance(row, dict):
            continue
        target = str(row.get("target") or row.get("name") or "-").strip() or "-"
        reason = str(row.get("reason") or "").strip()
        action = str(row.get("action") or row.get("text") or "").strip()
        expected = str(row.get("expected") or "").strip()
        if not action:
            continue
        items.append(
            ReportSuggestionItem(
                target=target,
                reason=reason or "\u57fa\u4e8e\u5f53\u524d\u6c34\u529b\u7ed3\u679c\u4e0e\u98ce\u9669\u5224\u65ad\u751f\u6210\u3002",
                action=action,
                expected=expected or "\u7528\u4e8e\u964d\u4f4e\u5f53\u524d\u5de5\u51b5\u4e0b\u7684\u8fd0\u884c\u4e0d\u786e\u5b9a\u6027\u3002",
                priority=_normalize_priority(row.get("priority")),
                text=str(row.get("text") or action).strip() or None,
            )
        )

    return items or fallback


def build_hydraulic_report_ai_sections(ctx: dict[str, Any]) -> DynamicReportAiAnalysis:
    fallback = _build_fallback(ctx)
    fact_pack = _build_fact_pack(ctx)
    if not _as_record(fact_pack.get("resultMetrics")):
        return fallback

    try:
        llm = ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE,
            model=settings.LLM_MODEL,
            temperature=0.2,
            max_tokens=min(settings.LLM_MAX_TOKENS, 1400),
            streaming=False,
        )
        prompt = "\n".join(
            [
                "You are a senior pipeline hydraulic analyst.",
                "Write all narrative text in Simplified Chinese.",
                "Generate only the AI analysis blocks for a hydraulic report page.",
                "Use only the supplied facts. Do not invent missing projects, metrics, risks, causes or recommendations.",
                "Keep the structure fixed but make the content specific to the current hydraulic calculation.",
                "If evidence is insufficient, say the data is insufficient instead of guessing.",
                "Return JSON only with this schema:",
                '{"summary":["..."],"metricAnalysis":["..."],"riskJudgement":[{"target":"...","riskType":"...","level":"high|medium|low","reason":"...","suggestion":"..."}],"suggestions":[{"target":"...","reason":"...","action":"...","expected":"...","priority":"high|medium|low"}]}',
                "Rules:",
                "- summary: 2 to 4 concise bullets about the current result and operating context.",
                "- metricAnalysis: 2 to 4 bullets explaining the hydraulic meaning of the current Reynolds number, flow regime, friction head loss, hydraulic slope, total head or end-station inlet pressure when evidence exists.",
                "- riskJudgement: prioritize supplied rule risks and hard constraints; do not create more than 4 items.",
                "- suggestions: give concrete operating checks or adjustments that follow from the supplied risks and metric behavior; do not create more than 4 items.",
                "- If there is no clear risk, return empty arrays for riskJudgement and suggestions.",
                json.dumps({"facts": fact_pack}, ensure_ascii=False),
            ]
        )
        response = llm.invoke(prompt)
        parsed = _extract_json_object(getattr(response, "content", ""))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Hydraulic dynamic AI analysis fell back to template output: %s", exc)
        return fallback

    summary = _clean_lines(parsed.get("summary"), 4) or fallback.summary
    metric_analysis = _clean_lines(parsed.get("metricAnalysis"), 4) or fallback.metricAnalysis
    risk_judgement = _coerce_risks(parsed.get("riskJudgement"), fallback.riskJudgement)
    suggestions = _coerce_suggestions(parsed.get("suggestions"), fallback.suggestions)

    return DynamicReportAiAnalysis(
        summary=summary,
        metricAnalysis=metric_analysis,
        riskJudgement=risk_judgement,
        suggestions=suggestions,
    )


__all__ = ["build_hydraulic_report_ai_sections"]

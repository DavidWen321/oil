from __future__ import annotations

from typing import Any

from src.models.schemas import DynamicReportRequest, ReportRiskItem

from .sensitivity_facts import sensitivity_term_aliases
from .skills.sensitivity_helpers import extract_sensitivity_insights, extract_sensitivity_risk_rules, format_number

MIN_OFFICIAL_REFERENCE_COUNT = 2

RISK_CODE_META: dict[str, dict[str, Any]] = {
    "energy_consumption_zone": {
        "label": "高能耗区",
        "keywords": ["能耗", "节能", "经济运行", "降耗", "输量", "流量"],
        "impact": "说明单位输量能耗和沿程阻力放大风险已经进入需要重点校核的区间。",
        "suggestion": "建议优先复核输量设定、摩阻参数和泵站运行工况，避免系统长期贴近高能耗区运行。",
        "reference_focus": "输送能耗监测与运行控制",
    },
    "operation_stability_zone": {
        "label": "运行稳定区",
        "keywords": ["运行维护", "压力", "波动", "稳定", "安全", "监测"],
        "impact": "说明压力裕度和运行稳定性正在收紧，需要持续跟踪关键边界参数。",
        "suggestion": "建议连续监测末站压力、流量波动和关键工况切换点，防止由稳定区滑入预警区。",
        "reference_focus": "运行维护、压力控制和稳定性监测",
    },
    "equipment_boundary_zone": {
        "label": "设备边界区",
        "keywords": ["设备", "边界", "高负荷", "泵", "效率", "经济运行"],
        "impact": "说明设备余量和经济运行边界被持续占用，长期运行会抬高维护与故障暴露风险。",
        "suggestion": "建议复核泵组负荷分配、效率区间和设备边界，避免长期高负荷贴边运行。",
        "reference_focus": "设备边界与泵系统经济运行",
    },
}

RISK_DISPLAY_LABELS: dict[str, str] = {
    "energy_consumption_zone": "能耗区判断",
    "operation_stability_zone": "运行稳定区判断",
    "equipment_boundary_zone": "设备边界区判断",
    "viscosity_high": "油品黏度风险",
    "flow_rate_low": "流量偏低风险",
    "flow_rate_jump": "流量波动风险",
}

GENERIC_RISK_TARGETS = {
    "当前方案",
    "当前项目",
    "当前对象",
    "项目",
    "系统",
    "管道系统",
}


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _ensure_sentence(text: str) -> str:
    cleaned = _normalize_text(text).rstrip("。；;")
    return f"{cleaned}。" if cleaned else ""


def _reference_text(reference: dict[str, Any]) -> str:
    parts = [
        _normalize_text(reference.get("title")),
        _normalize_text(reference.get("publisher")),
        _normalize_text(reference.get("query")),
        _normalize_text(reference.get("snippet")),
    ]
    return " ".join(part for part in parts if part).lower()


def _risk_keywords(risk_code: str) -> list[str]:
    meta = RISK_CODE_META.get(risk_code, {})
    return [str(item).strip().lower() for item in meta.get("keywords", []) if str(item).strip()]


def _resolve_risk_display_type(row: dict[str, Any]) -> str:
    title = _normalize_text(row.get("title"))
    if title:
        return title

    risk_code = _normalize_text(row.get("riskCode"))
    meta = RISK_CODE_META.get(risk_code, {})
    return _normalize_text(RISK_DISPLAY_LABELS.get(risk_code)) or _normalize_text(meta.get("label")) or risk_code or "风险判断"


def _alias_keywords(*values: Any) -> list[str]:
    keywords: list[str] = []
    seen: set[str] = set()
    for value in values:
        for alias in sensitivity_term_aliases(value):
            cleaned = str(alias or "").strip().lower()
            if cleaned and cleaned not in seen:
                keywords.append(cleaned)
                seen.add(cleaned)
        direct_value = _normalize_text(value).lower()
        if direct_value and direct_value not in seen:
            keywords.append(direct_value)
            seen.add(direct_value)
    return keywords


def _is_specific_risk_target(row: dict[str, Any], insights: dict[str, Any]) -> bool:
    target = _normalize_text(row.get("targetName"))
    if not target or target in GENERIC_RISK_TARGETS:
        return False

    project_name = _normalize_text(insights.get("projectName"))
    if project_name and target == project_name:
        return False

    risk_code = _normalize_text(row.get("riskCode"))
    if risk_code and risk_code not in RISK_CODE_META:
        return True

    target_keywords = set(_alias_keywords(target))
    top_keywords = set(_alias_keywords(insights.get("topVariableName"), insights.get("variableTypeText")))
    return bool(target_keywords and top_keywords and target_keywords.isdisjoint(top_keywords))


def _resolve_risk_subject(row: dict[str, Any], insights: dict[str, Any]) -> str:
    target = _normalize_text(row.get("targetName"))
    if target:
        return target
    return _normalize_text(insights.get("topVariableName")) or "当前关键参数"


def _variable_keywords(row: dict[str, Any], insights: dict[str, Any]) -> list[str]:
    target = _normalize_text(row.get("targetName"))
    if _is_specific_risk_target(row, insights):
        return _alias_keywords(target)
    return _alias_keywords(target, insights.get("topVariableName"), insights.get("variableTypeText"))


def _reference_score(reference: dict[str, Any], row: dict[str, Any], insights: dict[str, Any]) -> int:
    haystack = _reference_text(reference)
    if not haystack:
        return 0

    score = 0
    for keyword in _risk_keywords(_normalize_text(row.get("riskCode"))):
        if keyword in haystack:
            score += 4

    for keyword in _variable_keywords(row, insights):
        if keyword in haystack:
            score += 3

    if "标准" in haystack or "规范" in haystack:
        score += 2
    if "风险" in haystack or "监测" in haystack or "运行" in haystack:
        score += 1
    return score


def _pick_references(
    references: list[dict[str, Any]],
    row: dict[str, Any],
    insights: dict[str, Any],
) -> list[dict[str, Any]]:
    scored = sorted(
        references,
        key=lambda item: (
            _reference_score(item, row, insights),
            _normalize_text(item.get("title")),
        ),
        reverse=True,
    )

    selected: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for item in scored:
        url = _normalize_text(item.get("url"))
        if not url or url in seen_urls:
            continue
        if _reference_score(item, row, insights) <= 0 and selected:
            continue
        selected.append(item)
        seen_urls.add(url)
        if len(selected) >= MIN_OFFICIAL_REFERENCE_COUNT:
            break

    if len(selected) >= MIN_OFFICIAL_REFERENCE_COUNT:
        return selected

    for item in references:
        url = _normalize_text(item.get("url"))
        if not url or url in seen_urls:
            continue
        selected.append(item)
        seen_urls.add(url)
        if len(selected) >= MIN_OFFICIAL_REFERENCE_COUNT:
            break
    return selected


def _build_fact_summary(row: dict[str, Any], insights: dict[str, Any]) -> str:
    pieces: list[str] = []
    message = _normalize_text(row.get("message"))
    if message:
        pieces.append(message.rstrip("。"))

    specific_target = _is_specific_risk_target(row, insights)
    top_variable = _normalize_text(insights.get("topVariableName"))
    sensitivity_coefficient = format_number(insights.get("sensitivityCoefficient"))
    max_impact_percent = format_number(insights.get("maxImpactPercent"), suffix="%")
    min_end_station_pressure = format_number(insights.get("minEndStationPressure"))

    if not specific_target and top_variable and sensitivity_coefficient != "-":
        pieces.append(f"当前最敏感变量为{top_variable}，敏感系数为{sensitivity_coefficient}")
    if not specific_target and max_impact_percent != "-":
        pieces.append(f"最大影响幅度为{max_impact_percent}")
    if min_end_station_pressure != "-" and _normalize_text(row.get("riskCode")) == "operation_stability_zone":
        pieces.append(f"末站最低进站压力为{min_end_station_pressure}")
    return _ensure_sentence("；".join(piece for piece in pieces if piece))


def _build_reason(row: dict[str, Any], insights: dict[str, Any], references: list[dict[str, Any]]) -> str:
    primary = references[0]
    secondary = references[1]
    risk_code = _normalize_text(row.get("riskCode"))
    meta = RISK_CODE_META.get(risk_code, {})
    reference_focus = _normalize_text(meta.get("reference_focus")) or "相关运行边界校核"
    fact_summary = _build_fact_summary(row, insights)
    return (
        f"{fact_summary}"
        f"联网检索命中{_normalize_text(primary.get('publisher'))}《{_normalize_text(primary.get('title'))}》"
        f"和{_normalize_text(secondary.get('publisher'))}《{_normalize_text(secondary.get('title'))}》，"
        f"两条官方来源都把{reference_focus}列为重点校核内容，因此本次保留既有“{_normalize_text(row.get('level'))}”判定，不额外升降级。"
    )


def _build_impact(row: dict[str, Any], insights: dict[str, Any]) -> str:
    impact = _normalize_text(row.get("impact"))
    if impact:
        return _ensure_sentence(impact)

    risk_code = _normalize_text(row.get("riskCode"))
    meta = RISK_CODE_META.get(risk_code, {})
    if meta.get("impact"):
        return _ensure_sentence(str(meta["impact"]))

    subject = _resolve_risk_subject(row, insights)
    return _ensure_sentence(f"说明{subject}相关结果边界正在收紧，需要继续按官方规范跟踪其运行变化")


def _build_suggestion(row: dict[str, Any], references: list[dict[str, Any]]) -> str:
    primary = references[0]
    secondary = references[1]
    suggestion = _normalize_text(row.get("suggestion"))
    if not suggestion:
        risk_code = _normalize_text(row.get("riskCode"))
        meta = RISK_CODE_META.get(risk_code, {})
        suggestion = _normalize_text(meta.get("suggestion"))
    suggestion = suggestion or "建议结合当前工况继续做参数复核和边界监测"
    return (
        f"{_ensure_sentence(suggestion)}"
        f"复核时优先参照《{_normalize_text(primary.get('title'))}》和《{_normalize_text(secondary.get('title'))}》对应条款。"
    )


def build_official_risk_items(
    request: DynamicReportRequest,
    report_context: dict[str, Any],
    risk_research: dict[str, Any],
    profile_key: str,
) -> list[ReportRiskItem]:
    del request

    if profile_key != "sensitivity":
        return []
    if _normalize_text(risk_research.get("status")) != "found":
        return []

    references = risk_research.get("references") if isinstance(risk_research.get("references"), list) else []
    if len(references) < MIN_OFFICIAL_REFERENCE_COUNT:
        return []

    insights = extract_sensitivity_insights(report_context)
    risk_rules = extract_sensitivity_risk_rules(report_context)
    if not insights or not risk_rules:
        return []

    items: list[ReportRiskItem] = []
    seen_keys: set[tuple[str, str]] = set()
    for row in risk_rules[:3]:
        target = _normalize_text(row.get("targetName")) or _normalize_text(insights.get("topVariableName")) or "-"
        risk_type = _normalize_text(row.get("riskCode")) or "unknown"
        display_risk_type = _resolve_risk_display_type(row)
        level = _normalize_text(row.get("level"))
        if not level:
            continue

        matched_references = _pick_references(references, row, insights)
        if len(matched_references) < MIN_OFFICIAL_REFERENCE_COUNT:
            continue

        dedupe_key = (target, risk_type)
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)

        primary_reference = matched_references[0]
        reason = _build_reason(row, insights, matched_references)
        suggestion = _build_suggestion(row, matched_references)
        if not reason or not suggestion:
            continue

        items.append(
            ReportRiskItem(
                target=target,
                riskType=display_risk_type,
                level=level,
                reason=reason,
                impact=_build_impact(row, insights),
                suggestion=suggestion,
                code=risk_type,
                message=reason,
                source="official_web_research",
                referenceTitle=_normalize_text(primary_reference.get("title")),
                referenceUrl=_normalize_text(primary_reference.get("url")),
                referencePublisher=_normalize_text(primary_reference.get("publisher")),
            )
        )

    return items[:3]

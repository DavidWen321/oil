from __future__ import annotations

from typing import Any

from src.models.schemas import ReportSuggestionItem

from .risk_identify_skill import risk_identify_skill
from .sensitivity_helpers import (
    build_official_reference_text,
    extract_official_topic_references,
    extract_primary_variable_type,
    extract_sensitivity_insights,
)


def _build_suggestion(
    *,
    target: str,
    priority: str,
    text: str,
    reason: str,
    expected: str,
) -> ReportSuggestionItem:
    return ReportSuggestionItem(
        target=target,
        priority=priority,
        reason=reason,
        action=text,
        text=text,
        expected=expected,
    )


def _append_evidence(text: str, evidence_text: str) -> str:
    cleaned = str(text or "").strip()
    if not evidence_text:
        return cleaned
    return f"{cleaned} 联网校核参考了 {evidence_text}。"


def _build_control_action(variable_type: str, variable_name: str) -> str:
    normalized = str(variable_type or "").strip().upper()
    if normalized == "FLOW_RATE":
        return f"建议把 {variable_name} 作为一级调度变量管理，优先采用小步调整、逐级复算的方式控制输量变化，避免跨级跳变。"
    if normalized in {"OIL_VISCOSITY", "TEMPERATURE"}:
        return f"建议把 {variable_name} 作为重点复核变量，优先校核温控、黏温关系和原油性质边界，不宜直接把单次样本结果当作长期设定值。"
    if normalized in {"PIPE_DIAMETER", "PIPE_ROUGHNESS"}:
        return f"建议把 {variable_name} 归入设计/状态变量管理，优先做参数复核、内壁状态校核和必要的整治评估，而不是直接做运行端大幅调节。"
    return f"建议把 {variable_name} 纳入重点控制或复核清单，所有调整都应遵循小步试探和同步复算。"


def operation_suggestion_skill(ctx: dict[str, Any]) -> list[ReportSuggestionItem]:
    insights = extract_sensitivity_insights(ctx)
    risk_items = risk_identify_skill(ctx)
    suggestions: list[ReportSuggestionItem] = []
    operation_evidence_text = build_official_reference_text(extract_official_topic_references(ctx, "operations"))
    standards_evidence_text = build_official_reference_text(extract_official_topic_references(ctx, "standards"))
    variable_type = extract_primary_variable_type(insights)

    for risk in risk_items:
        code = risk.code or risk.riskType
        target = risk.target or insights.get("projectName") or "当前对象"

        if code == "sensitivity_coefficient_high":
            suggestions.append(
                _build_suggestion(
                    target=target,
                    priority="high",
                    text=_append_evidence(
                        _build_control_action(variable_type, target),
                        operation_evidence_text,
                    ),
                    reason=_append_evidence(
                        "敏感系数偏高，说明系统对该变量变化的响应已经十分明显。",
                        standards_evidence_text or operation_evidence_text,
                    ),
                    expected="有助于把主要扰动源限制在可控带内，避免摩阻和末站压力同步放大。",
                )
            )
        elif code == "max_impact_high":
            suggestions.append(
                _build_suggestion(
                    target=target,
                    priority="high",
                    text=_append_evidence(
                        "建议优先复核最大影响区间对应的工况点，并对该区间采用“小步调整 + 实时复算”的调度方式。",
                        operation_evidence_text,
                    ),
                    reason=_append_evidence(
                        "最大影响幅度较大，说明系统在样本边界内已经出现明显结果放大。",
                        standards_evidence_text,
                    ),
                    expected="有助于降低边界区间误调度导致的压力收紧和能耗抬升风险。",
                )
            )
        elif code in {"end_station_pressure_low", "end_station_pressure_jump"}:
            suggestions.append(
                _build_suggestion(
                    target=target,
                    priority="high",
                    text=_append_evidence(
                        "建议优先复核目标输量、泵站组合和入口压头，并把末站压力预警值作为调度硬约束。",
                        operation_evidence_text or standards_evidence_text,
                    ),
                    reason="末站压力已经接近或触碰运行边界，需要优先保障压力可行性。",
                    expected="有助于提升压力保障能力，并缩小最不利区间的失稳风险。",
                )
            )
        elif code in {"pump_efficiency", "pump_efficiency_low"}:
            suggestions.append(
                _build_suggestion(
                    target=target,
                    priority="high",
                    text=_append_evidence(
                        "建议优先让高效率泵组承担基荷，低效率机组仅在高峰工况补充运行，并同步复核泵组负荷分配。",
                        operation_evidence_text,
                    ),
                    reason="泵效偏低会同时抬高单位输量能耗并削弱扬程利用率。",
                    expected="有助于降低无效能耗，并改善运行经济性。",
                )
            )
        elif code == "flow_regime_shift":
            suggestions.append(
                _build_suggestion(
                    target=target,
                    priority="medium",
                    text=_append_evidence(
                        "建议对临界区间加密采样和复算，避免在流态切换带附近使用粗放调度策略。",
                        operation_evidence_text or standards_evidence_text,
                    ),
                    reason="流态已经发生切换，说明同样的调度动作在不同区间可能触发不同响应。",
                    expected="有助于降低临界区间外推失真和运行波动放大风险。",
                )
            )
        elif code == "pipeline_resistance_high":
            suggestions.append(
                _build_suggestion(
                    target=target,
                    priority="medium",
                    text=_append_evidence(
                        "建议优先复核粗糙度、流量设定及沿程阻力参数，必要时重新评估运行方案。",
                        standards_evidence_text or operation_evidence_text,
                    ),
                    reason="摩阻损失持续上升，说明输送阻力已经成为结果放大的主要来源。",
                    expected="有助于改善输送稳定性，并降低高阻力区间的压损增长风险。",
                )
            )

    if not suggestions and insights:
        target = insights["topVariableName"] or insights["projectName"]
        suggestions.append(
            _build_suggestion(
                target=target,
                priority="medium",
                text=_append_evidence(
                    _build_control_action(variable_type, target),
                    operation_evidence_text or standards_evidence_text,
                ),
                reason="当前已识别出头部敏感变量，但尚未形成明确的高风险告警。",
                expected="有助于在保持运行边界稳定的同时，提前约束关键变量波动。",
            )
        )

    deduplicated: list[ReportSuggestionItem] = []
    seen_keys: set[tuple[str, str]] = set()
    for item in suggestions:
        dedupe_key = (item.target, item.action)
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)
        deduplicated.append(item)

    return deduplicated[:6]

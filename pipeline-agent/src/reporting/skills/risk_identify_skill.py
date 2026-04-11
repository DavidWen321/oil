from __future__ import annotations

from typing import Any

from src.models.schemas import ReportRiskItem

from .sensitivity_helpers import extract_sensitivity_insights, extract_sensitivity_risk_rules, format_number


def _build_risk_item(
    *,
    target: str,
    code: str,
    level: str,
    message: str,
    suggestion: str,
) -> ReportRiskItem:
    return ReportRiskItem(
        target=target,
        riskType=code,
        level=level,
        reason=message,
        suggestion=suggestion,
        code=code,
        message=message,
    )


def _normalize_level(level: str) -> str:
    normalized = str(level or "").strip().lower()
    if normalized in {"high", "高"}:
        return "高"
    if normalized in {"low", "低"}:
        return "低"
    return "中"


def risk_identify_skill(ctx: dict[str, Any]) -> list[ReportRiskItem]:
    insights = extract_sensitivity_insights(ctx)
    items: list[ReportRiskItem] = []
    risk_rules = extract_sensitivity_risk_rules(ctx)

    if risk_rules:
        default_target = ""
        if insights:
            default_target = insights["topVariableName"] or insights["projectName"]
        for row in risk_rules[:6]:
            items.append(
                _build_risk_item(
                    target=str(row.get("targetName") or default_target or "-"),
                    code=str(row.get("riskCode") or "unknown"),
                    level=_normalize_level(str(row.get("level") or "")),
                    message=str(row.get("message") or "当前数据不足以支持进一步判断。"),
                    suggestion=str(row.get("suggestion") or "建议结合更多运行记录复核当前对象。"),
                )
            )

    if not items and insights:
        target_name = insights["topVariableName"] or insights["projectName"]
        sensitivity_coefficient = insights["sensitivityCoefficient"]
        max_impact_percent = insights["maxImpactPercent"]
        min_end_station_pressure = insights["minEndStationPressure"]

        if sensitivity_coefficient is not None and sensitivity_coefficient >= 0.8:
            items.append(
                _build_risk_item(
                    target=target_name,
                    code="sensitivity_coefficient_high",
                    level="高",
                    message=(
                        f"当前变量敏感系数为 {format_number(sensitivity_coefficient)}，系统对该变量变化响应明显，"
                        "需要重点监测其波动区间。"
                    ),
                    suggestion="建议将该变量纳入重点监测清单，并优先校核关键工况切换时的运行边界。",
                )
            )
        elif sensitivity_coefficient is not None and sensitivity_coefficient >= 0.4:
            items.append(
                _build_risk_item(
                    target=target_name,
                    code="sensitivity_coefficient_medium",
                    level="中",
                    message=(
                        f"当前变量敏感系数为 {format_number(sensitivity_coefficient)}，对系统结果存在中等强度影响，"
                        "需要持续跟踪变化趋势。"
                    ),
                    suggestion="建议在日常调度中跟踪该变量变化，并结合运行窗口校核控制阈值。",
                )
            )

        if max_impact_percent is not None and max_impact_percent >= 20:
            items.append(
                _build_risk_item(
                    target=target_name,
                    code="max_impact_high",
                    level="高",
                    message=(
                        f"最大影响幅度达到 {format_number(max_impact_percent, suffix='%')}，"
                        "说明在设定波动范围内系统结果变化显著，存在较高的不稳定风险。"
                    ),
                    suggestion="建议优先复核大幅波动区间的运行结果，并增加关键变量上下限校核。",
                )
            )
        elif max_impact_percent is not None and max_impact_percent >= 10:
            items.append(
                _build_risk_item(
                    target=target_name,
                    code="max_impact_medium",
                    level="中",
                    message=(
                        f"最大影响幅度达到 {format_number(max_impact_percent, suffix='%')}，"
                        "说明系统结果对该变量变化较为敏感。"
                    ),
                    suggestion="建议结合典型工况复核该变量波动时的结果变化幅度。",
                )
            )

        if min_end_station_pressure is not None and min_end_station_pressure < 0:
            items.append(
                _build_risk_item(
                    target=insights["projectName"],
                    code="end_station_pressure_low",
                    level="高",
                    message="部分变化比例下末站进站压力低于 0，说明系统压力稳定性存在明显风险。",
                    suggestion="建议优先校核末站压力裕度，并复核目标输量与泵站组合。",
                )
            )

        if insights["flowRegimeChanged"]:
            items.append(
                _build_risk_item(
                    target=insights["projectName"],
                    code="flow_regime_shift",
                    level="中",
                    message="不同变化比例下流态发生变化，变量波动可能改变系统流动特征，应重点关注临界区间。",
                    suggestion="建议补充流态临界区间校核，避免系统在运行波动中进入不稳定状态。",
                )
            )

        if insights["frictionTrendText"] == "整体上升":
            items.append(
                _build_risk_item(
                    target=insights["projectName"],
                    code="pipeline_resistance_high",
                    level="中",
                    message="摩阻损失随变量变化呈上升趋势，说明输送阻力对结果影响较强。",
                    suggestion="建议复核粗糙度、流量设定及沿程摩阻参数，必要时重新评估运行方案。",
                )
            )

    deduplicated: list[ReportRiskItem] = []
    seen_keys: set[tuple[str, str]] = set()
    for item in items:
        dedupe_key = (item.target, item.code or item.riskType)
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)
        deduplicated.append(item)

    return deduplicated[:6]

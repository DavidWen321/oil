from __future__ import annotations

from typing import Any

from .sensitivity_helpers import (
    build_official_reference_text,
    build_sensitivity_mechanism_chain,
    extract_official_topic_references,
    extract_primary_variable_type,
    extract_sensitivity_insights,
    format_number,
    get_change_label,
)


def trend_insight_skill(ctx: dict[str, Any]) -> str:
    insights = extract_sensitivity_insights(ctx)
    point_rows = insights.get("pointRows") or []
    if not insights or not point_rows:
        return ""

    top_variable_name = insights["topVariableName"]
    variable_type = extract_primary_variable_type(insights)
    min_pressure_point = insights.get("minPressurePoint") or {}
    max_friction_point = insights.get("maxFrictionPoint") or {}
    mechanism_chain = build_sensitivity_mechanism_chain(variable_type, top_variable_name)

    sentences = [
        f"趋势图把“{mechanism_chain}”这条因果链画成了连续曲线：随着 {top_variable_name} 在样本区间内变化，末站进站压力{insights['pressureTrendText']}，摩阻损失{insights['frictionTrendText']}。"
    ]

    if min_pressure_point:
        sentences.append(
            f"其中末站进站压力最低出现在 {get_change_label(min_pressure_point)} 附近，对应压力约为 {format_number(min_pressure_point.get('endStationPressure'))}。"
        )

    if max_friction_point:
        sentences.append(
            f"摩阻损失峰值出现在 {get_change_label(max_friction_point)} 附近，对应数值约为 {format_number(max_friction_point.get('frictionHeadLoss'))}。"
        )

    if insights["flowRegimeChanged"]:
        sentences.append("趋势中同时出现了流态切换，说明参数扰动已经改变了主导机理，后段区间不能继续按前段经验线性外推。")
    else:
        sentences.append("各变化比例下流态保持一致，说明当前测试区间内系统仍受同一套主导机理控制。")

    evidence_text = build_official_reference_text(
        extract_official_topic_references(ctx, "mechanism")
        or extract_official_topic_references(ctx, "standards")
    )
    if evidence_text:
        sentences.append(
            f"结合联网检索命中的 {evidence_text}，当前这条趋势可以解释为速度项、雷诺数和摩阻损失的连续传递结果，因此图上的高响应区可以直接视作后续调度和校核的重点区间。"
        )

    return "".join(sentence for sentence in sentences if sentence.strip())

from __future__ import annotations

from typing import Any

from .sensitivity_helpers import (
    build_official_reference_text,
    extract_official_risk_references,
    extract_official_topic_references,
    extract_sensitivity_insights,
    get_row_span_text,
    to_float,
)


def interval_conclusion_skill(ctx: dict[str, Any]) -> str:
    insights = extract_sensitivity_insights(ctx)
    point_rows = insights.get("pointRows") or []
    if not insights or not point_rows:
        return ""

    negative_rows = [row for row in point_rows if (to_float(row.get("changePercent")) or 0) < 0]
    positive_rows = [row for row in point_rows if (to_float(row.get("changePercent")) or 0) > 0]

    sentences: list[str] = []

    if negative_rows:
        sentences.append(
            f"在负向变化区间内，末站进站压力大致位于 {get_row_span_text(negative_rows, 'endStationPressure')}，摩阻损失位于 {get_row_span_text(negative_rows, 'frictionHeadLoss')}。"
        )

    if positive_rows:
        sentences.append(
            f"在正向变化区间内，末站进站压力大致位于 {get_row_span_text(positive_rows, 'endStationPressure')}，摩阻损失位于 {get_row_span_text(positive_rows, 'frictionHeadLoss')}。"
        )

    if insights["flowRegimeChanged"] and insights.get("flowRegimeSegments"):
        sentences.append(f"流态分布显示：{'；'.join(insights['flowRegimeSegments'])}，临界切换区间应作为重点复核对象。")
    else:
        regime = str(point_rows[0].get("flowRegime") or "").strip() or "-"
        sentences.append(f"各变化比例下流态均保持为 {regime}，当前区间内流态未出现明显切换。")

    if insights["minEndStationPressure"] is not None and insights["minEndStationPressure"] < 0:
        sentences.append("表格结果已经出现末站压力为负的情形，说明部分变化区间存在明显运行边界风险。")
    else:
        sentences.append("从区间表格看，当前测试范围内尚未触发明显的末站压力失稳边界。")

    evidence_text = build_official_reference_text(
        extract_official_risk_references(ctx)
        or extract_official_topic_references(ctx, "standards")
    )
    if evidence_text:
        sentences.append(
            f"结合联网检索命中的 {evidence_text}，这张表更适合用来划定“可以继续运行的控制带”和“需要重点复核的边界带”，而不是单纯罗列采样点数值。"
        )

    return "".join(sentence for sentence in sentences if sentence.strip())

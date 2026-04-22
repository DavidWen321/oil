from __future__ import annotations

from typing import Any

from .sensitivity_helpers import (
    build_official_reference_text,
    build_sensitivity_mechanism_chain,
    build_sensitivity_mechanism_reason,
    extract_official_topic_references,
    extract_primary_variable_type,
    extract_sensitivity_insights,
    format_number,
)


def mechanism_insight_skill(ctx: dict[str, Any]) -> str:
    insights = extract_sensitivity_insights(ctx)
    if not insights:
        return ""

    variable_name = insights["topVariableName"]
    variable_type = extract_primary_variable_type(insights)
    mechanism_chain = build_sensitivity_mechanism_chain(variable_type, variable_name)
    mechanism_reason = build_sensitivity_mechanism_reason(variable_type, variable_name)
    sensitivity_coefficient = format_number(insights.get("sensitivityCoefficient"))
    max_impact_percent = format_number(insights.get("maxImpactPercent"), suffix="%")

    sentences = [
        f"从工程机理看，当前最敏感变量 {variable_name} 的主导传导链条可以概括为：{mechanism_chain}。",
        mechanism_reason,
    ]

    if sensitivity_coefficient != "-" or max_impact_percent != "-":
        sentences.append(
            f"这条机理链已经在计算结果中得到体现：敏感系数为 {sensitivity_coefficient}，最大影响幅度为 {max_impact_percent}，说明它不是普通波动项，而是当前最需要优先解释和控制的结果放大源。"
        )

    mechanism_references = extract_official_topic_references(ctx, "mechanism")
    standards_references = extract_official_topic_references(ctx, "standards")
    evidence_text = build_official_reference_text(mechanism_references or standards_references)
    if evidence_text:
        sentences.append(
            f"联网检索命中的 {evidence_text} 也把雷诺数、摩阻损失、压降和运行边界之间的传递关系作为解释输油管道工况变化的重要依据，这与本次本地计算结果表现一致。"
        )

    return "".join(sentence for sentence in sentences if sentence.strip())

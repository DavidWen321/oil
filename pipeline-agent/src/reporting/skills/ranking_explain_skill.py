from __future__ import annotations

from typing import Any

from .sensitivity_helpers import extract_sensitivity_insights, format_number


def ranking_explain_skill(ctx: dict[str, Any]) -> str:
    insights = extract_sensitivity_insights(ctx)
    if not insights:
        return ""

    top_variable_name = insights["topVariableName"]
    top_rank_number = insights["topRankNumber"]
    sensitivity_coefficient = format_number(insights["sensitivityCoefficient"])
    max_impact_percent = format_number(insights["maxImpactPercent"], suffix="%")

    return (
        f"{top_variable_name}在本次分析中排名第 {top_rank_number}，"
        f"敏感系数为 {sensitivity_coefficient}，最大影响幅度为 {max_impact_percent}，"
        "说明该变量变化对系统结果影响最显著。"
    )

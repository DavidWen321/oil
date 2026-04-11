from __future__ import annotations

from typing import Any

from .ranking_explain_skill import ranking_explain_skill
from .sensitivity_helpers import extract_sensitivity_insights, format_number


def change_analysis_skill(ctx: dict[str, Any]) -> list[str]:
    insights = extract_sensitivity_insights(ctx)
    if not insights:
        return []

    items: list[str] = []
    ranking_explain = ranking_explain_skill(ctx)
    if ranking_explain:
        items.append(ranking_explain)

    items.append(
        f"基准工况为{insights['baseCondition']}，基准结果为{insights['baseResultStatus']}，可作为后续比较不同变化比例结果的参考基础。"
    )
    items.append(
        f"在设定变化范围内，最大影响幅度达到 {format_number(insights['maxImpactPercent'], suffix='%')}，"
        f"整体影响程度为{insights['impactLevel']}。"
    )

    pressure_trend_text = insights["pressureTrendText"]
    friction_trend_text = insights["frictionTrendText"]
    if (
        pressure_trend_text != "当前数据不足以支持进一步判断"
        or friction_trend_text != "当前数据不足以支持进一步判断"
    ):
        items.append(
            f"随着{insights['topVariableName']}变化，末站进站压力{pressure_trend_text}，摩阻损失{friction_trend_text}。"
        )

    if insights["flowRegimeChanged"]:
        items.append("不同变化比例下流态发生变化，说明系统存在明显运行状态切换风险。")
    else:
        items.append("不同变化比例下流态整体稳定，暂未出现明显流态切换。")

    return [item for item in items if item.strip()]

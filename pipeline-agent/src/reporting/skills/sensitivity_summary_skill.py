from __future__ import annotations

from typing import Any

from .sensitivity_helpers import (
    build_official_reference_text,
    extract_official_topic_references,
    extract_sensitivity_insights,
    extract_sensitivity_risk_rules,
    format_number,
)


def sensitivity_summary_skill(ctx: dict[str, Any]) -> list[str]:
    project = ctx.get("project", {}) if isinstance(ctx.get("project"), dict) else {}
    insights = extract_sensitivity_insights(ctx)
    risk_rules = extract_sensitivity_risk_rules(ctx)
    project_count = int(project.get("projectCount") or 0)

    if not insights:
        return []

    items = [
        (
            f"本次敏感性分析围绕 {insights['projectName']} 展开，敏感变量类型为 {insights['variableTypeText']}；"
            f"基准工况为 {insights['baseCondition']}，本轮报告直接复用既有计算快照，不重复业务计算。"
        ),
        (
            f"当前最敏感变量为 {insights['topVariableName']}，敏感系数为 {format_number(insights['sensitivityCoefficient'])}，"
            f"最大影响幅度为 {format_number(insights['maxImpactPercent'], suffix='%')}。"
        ),
        (
            f"系统整体风险等级评估为 {insights['riskLevel']}，已生成 {len(risk_rules)} 条规则判断信息，"
            f"涉及 {project_count or 1} 个项目样本。"
        ),
    ]

    evidence_text = build_official_reference_text(
        extract_official_topic_references(ctx, "standards")
        or extract_official_topic_references(ctx, "mechanism")
    )
    if evidence_text:
        items.append(
            f"联网检索命中的 {evidence_text} 主要用于补充标准依据、行业解释和运行建议，本报告的判断逻辑为“本地计算结果优先，再由联网证据做解释与校核”。"
        )

    return [item for item in items if item.strip()]

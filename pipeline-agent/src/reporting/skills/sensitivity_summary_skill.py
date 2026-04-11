from __future__ import annotations

from typing import Any

from .sensitivity_helpers import extract_sensitivity_insights, extract_sensitivity_risk_rules, format_number


def sensitivity_summary_skill(ctx: dict[str, Any]) -> list[str]:
    project = ctx.get("project", {})
    history = ctx.get("history", {})
    metrics = ctx.get("metrics", {})
    insights = extract_sensitivity_insights(ctx)
    risk_rules = extract_sensitivity_risk_rules(ctx)

    project_count = int(project.get("projectCount") or 0)
    pipeline_count = int(project.get("pipelineCount") or 0)
    pump_count = int(project.get("pumpCount") or 0)
    history_total = int(history.get("total") or 0)
    history_success = int(history.get("success") or 0)
    history_failed = int(history.get("failed") or 0)
    constraint_checks = int(metrics.get("constraintChecks") or 0)

    items = [
        f"本次报告覆盖 {project_count} 个项目、{pipeline_count} 条管道、{pump_count} 座泵站。",
        f"历史样本共 {history_total} 次，成功 {history_success} 次，失败 {history_failed} 次。",
        f"已识别 {len(risk_rules)} 条规则问题，约束校核 {constraint_checks} 项。",
    ]

    if insights:
        items.append(
            f"当前优先关注变量为 {insights['topVariableName']}，敏感系数为 {format_number(insights['sensitivityCoefficient'])}，"
            f"最大影响幅度为 {format_number(insights['maxImpactPercent'], suffix='%')}。"
        )

    return [item for item in items if item.strip()]

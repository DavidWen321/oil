from __future__ import annotations

from src.models.schemas import DynamicReportRequest

from .labeling import output_style_key, output_style_label, report_type_label, style_title
from .report_types import DiagnosisResult, MetricSnapshot, OutlinePlan, OutlineSection


def plan_outline(
    request: DynamicReportRequest,
    metrics: MetricSnapshot,
    diagnosis: DiagnosisResult,
    title_prefix: str,
) -> OutlinePlan:
    sections: list[OutlineSection] = [
        OutlineSection("executive-summary", "执行摘要", "bullets", "所有报告都需要先说明范围、结论和重点。", 1),
    ]

    if not metrics.data_quality.get("has_histories") or not metrics.data_quality.get("has_pipelines"):
        sections.append(
            OutlineSection("data-quality", "数据质量与结论边界", "bullets", "主数据或历史样本不足，需要先说明结论边界。", 2)
        )

    sections.append(
        OutlineSection("scope-context", "分析范围与约束条件", "table", "需要明确本次报告覆盖对象、时间范围和业务约束。", 3)
    )

    if diagnosis.trends:
        sections.append(
            OutlineSection("trend-analysis", "趋势分析", "bullets", "当前样本中已经识别出趋势变化。", 4)
        )

    if diagnosis.anomalies:
        sections.append(
            OutlineSection("anomaly-analysis", "异常分析", "bullets", "当前对象中存在异常点或异常对象。", 5)
        )

    if diagnosis.causes:
        sections.append(
            OutlineSection("cause-analysis", "原因归因", "bullets", "异常已经形成可解释的候选原因链。", 6)
        )

    if diagnosis.constraints:
        sections.append(
            OutlineSection("constraint-evaluation", "约束冲突与可行性评估", "bullets", "发现了目标与约束之间的冲突。", 7)
        )

    sections.append(
        OutlineSection("object-snapshot", "对象画像", "table", "需要把项目、管道和泵站的关键对象指标展开。", 8)
    )

    if request.include_risk and diagnosis.risks:
        sections.append(
            OutlineSection("risk-section", "主要风险", "bullets", "将诊断结果转成风险视角，便于管理和执行。", 9)
        )

    if request.include_suggestions and diagnosis.recommendations:
        sections.append(
            OutlineSection("action-plan", "优化建议", "bullets", "需要把诊断结果落成可执行动作。", 10)
        )

    if request.include_conclusion:
        sections.append(
            OutlineSection("conclusion", "报告结论", "callout", "需要给出最终结论和下一步建议。", 11)
        )

    style_key = output_style_key(request)
    if style_key == "simple":
        allowed = {"executive-summary", "trend-analysis", "anomaly-analysis", "action-plan", "conclusion"}
        sections = [item for item in sections if item.id in allowed]
    elif style_key == "presentation":
        ordered = [
            "executive-summary",
            "anomaly-analysis",
            "constraint-evaluation",
            "risk-section",
            "action-plan",
            "conclusion",
        ]
        mapping = {item.id: item for item in sections}
        sections = [mapping[item_id] for item_id in ordered if item_id in mapping]

    report_name = style_title(f"{title_prefix} {report_type_label(request)}", request)
    abstract = (
        f"报告按{output_style_label(request)}生成，基于主数据、历史计算记录和规则诊断结果组织内容。"
    )
    return OutlinePlan(title=report_name, abstract=abstract, sections=sections)

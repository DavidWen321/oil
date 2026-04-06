from __future__ import annotations

from typing import Any

from src.models.schemas import (
    DynamicReportRequest,
    DynamicReportSection,
    ReportBulletItem,
    ReportMetricItem,
    ReportRiskItem,
    ReportSuggestionItem,
    ReportTableData,
)

from .labeling import analysis_object_label, optimization_goal_label, output_style_label, range_label
from .report_types import DiagnosisResult, MetricSnapshot, OutlinePlan, ReportDataBundle


def _fmt_number(value: float | int | None, digits: int = 2, suffix: str = "") -> str:
    if value is None:
        return "-"
    if isinstance(value, int):
        return f"{value}{suffix}"
    return f"{value:.{digits}f}{suffix}"


def _scope_rows(request: DynamicReportRequest, data: ReportDataBundle) -> list[list[str]]:
    projects = "、".join(str(item.get("name") or "-") for item in data.projects[:4]) if data.projects else "全部项目"
    if len(data.projects) > 4:
        projects = f"{projects} 等 {len(data.projects)} 个"
    pumps = "、".join(str(item.get("name") or "-") for item in data.pump_stations[:3]) if data.pump_stations else "全部泵站"
    if len(data.pump_stations) > 3:
        pumps = f"{pumps} 等 {len(data.pump_stations)} 座"
    oils = "、".join(str(item.get("name") or "-") for item in data.oil_properties[:2]) if data.oil_properties else "-"
    focuses = "、".join(request.focuses[:4]) if request.focuses else "-"

    rows = [
        ["分析对象", analysis_object_label(request.analysis_object or "project")],
        ["时间范围", range_label(request)],
        ["项目范围", projects],
        ["管道范围", request.selected_pipeline_name or (str(data.pipelines[0].get("name")) if len(data.pipelines) == 1 else f"{len(data.pipelines)} 条")],
        ["泵站范围", pumps],
        ["油品", oils],
        ["分析重点", focuses],
        ["输出风格", output_style_label(request)],
    ]
    if request.target_throughput is not None:
        rows.append(["目标输量", f"{request.target_throughput:.2f} m3/h"])
    if request.min_pressure is not None:
        rows.append(["最低出口压力", f"{request.min_pressure:.2f} MPa"])
    if request.optimization_goal:
        rows.append(["优化目标", optimization_goal_label(request.optimization_goal)])
    rows.append(["泵站调整", "允许调整" if request.allow_pump_adjust else "禁止调整"])
    if request.remark:
        rows.append(["备注说明", request.remark.strip()])
    return rows


def build_sections(
    request: DynamicReportRequest,
    data: ReportDataBundle,
    metrics: MetricSnapshot,
    diagnosis: DiagnosisResult,
    outline: OutlinePlan,
) -> list[DynamicReportSection]:
    overview = metrics.overview_metrics
    section_map: dict[str, DynamicReportSection] = {}

    section_map["executive-summary"] = DynamicReportSection(
        id="executive-summary",
        kind="bullets",
        title="执行摘要",
        summary="先给出样本规模、核心发现和主要风险。",
        items=[
            ReportBulletItem(content=f"本次报告覆盖 {overview['project_count']} 个项目、{overview['pipeline_count']} 条管道和 {overview['pump_station_count']} 座泵站。"),
            ReportBulletItem(content=f"历史计算总量 {overview['history_total_count']} 次，成功率 {_fmt_number(overview.get('success_rate'), digits=1, suffix='%')}。"),
            ReportBulletItem(content=f"共识别 {len(diagnosis.trends)} 个趋势、{len(diagnosis.anomalies)} 个异常和 {len(diagnosis.constraints)} 个约束冲突。"),
        ],
    )

    section_map["data-quality"] = DynamicReportSection(
        id="data-quality",
        kind="bullets",
        title="数据质量与结论边界",
        summary="说明当前报告可以支撑到什么程度，避免超出证据边界。",
        items=[
            ReportBulletItem(content=f"主数据完整性：项目={metrics.data_quality.get('has_projects')}，管道={metrics.data_quality.get('has_pipelines')}，历史样本={metrics.data_quality.get('has_histories')}。"),
            ReportBulletItem(content=f"时序样本点数：{metrics.data_quality.get('series_points')}，趋势分析可用={metrics.data_quality.get('usable_for_trend')}。"),
            ReportBulletItem(content="当前版本的趋势主要基于历史计算记录，不等同于全量实时运行监测数据。"),
        ],
    )

    section_map["scope-context"] = DynamicReportSection(
        id="scope-context",
        kind="table",
        title="分析范围与约束条件",
        summary="将对象、时间、约束和口径结构化展示，保证结论有明确边界。",
        table=ReportTableData(columns=["项目", "内容"], rows=_scope_rows(request, data)),
    )

    section_map["trend-analysis"] = DynamicReportSection(
        id="trend-analysis",
        kind="bullets",
        title="趋势分析",
        summary="趋势结论由代码计算，不依赖大模型猜测。",
        items=[
            ReportBulletItem(title=item.metric_label, content=f"{item.summary}；证据：{'；'.join(item.evidence)}")
            for item in diagnosis.trends
        ] or [ReportBulletItem(content="当前样本不足，未形成可置信的趋势判断。")],
    )

    section_map["anomaly-analysis"] = DynamicReportSection(
        id="anomaly-analysis",
        kind="bullets",
        title="异常分析",
        summary="定位异常对象和异常指标，而不是只给平均值。",
        items=[
            ReportBulletItem(
                title=f"{item.severity.upper()} | {item.target}",
                content=f"{item.summary}；证据：{'；'.join(item.evidence)}",
            )
            for item in diagnosis.anomalies
        ] or [ReportBulletItem(content="当前样本中未发现明显异常对象。")],
    )

    section_map["cause-analysis"] = DynamicReportSection(
        id="cause-analysis",
        kind="bullets",
        title="原因归因",
        summary="先做规则归因，再交给语言层解释，不直接让模型编结论。",
        items=[
            ReportBulletItem(
                title=f"{item.target} | 置信度 {item.confidence:.0%}",
                content=f"主因：{item.primary_cause}。次因：{'、'.join(item.secondary_causes) if item.secondary_causes else '无'}。证据：{'；'.join(item.evidence)}",
            )
            for item in diagnosis.causes
        ] or [ReportBulletItem(content="当前异常尚不足以形成稳定的原因链。")],
    )

    section_map["constraint-evaluation"] = DynamicReportSection(
        id="constraint-evaluation",
        kind="bullets",
        title="约束冲突与可行性评估",
        summary="重点看输量、压力和调泵限制之间是否相互冲突。",
        items=[
            ReportBulletItem(title=item.name, content=f"{item.summary}；证据：{'；'.join(item.evidence)}")
            for item in diagnosis.constraints
        ] or [ReportBulletItem(content="当前未识别出明显的目标与约束冲突。")],
    )

    object_rows: list[list[str]] = []
    for row in metrics.object_metrics.get("pump_stations", [])[:6]:
        object_rows.append(
            [
                row["name"],
                _fmt_number(row.get("pump_efficiency")),
                _fmt_number(row.get("electric_efficiency")),
                _fmt_number(row.get("displacement")),
                _fmt_number(row.get("come_power")),
            ]
        )
    section_map["object-snapshot"] = DynamicReportSection(
        id="object-snapshot",
        kind="table",
        title="对象画像",
        summary="把对象级指标展开，避免报告只停留在全局摘要。",
        table=ReportTableData(
            columns=["对象", "泵效", "电机效率", "排量", "功率"],
            rows=object_rows,
        ),
    )

    section_map["risk-section"] = DynamicReportSection(
        id="risk-section",
        kind="bullets",
        title="主要风险",
        summary="风险由异常与约束共同归纳而来。",
        items=[
            ReportBulletItem(
                title=f"{item['level']}风险 | {item['target']}",
                content=f"{item['reason']}；建议：{item['suggestion']}",
            )
            for item in diagnosis.risks
        ] or [ReportBulletItem(content="当前没有需要优先升级的高风险项。")],
    )

    section_map["action-plan"] = DynamicReportSection(
        id="action-plan",
        kind="bullets",
        title="优化建议",
        summary="建议必须绑定对象、原因和预期收益。",
        items=[
            ReportBulletItem(
                title=f"{item.priority}优先级 | {item.target}",
                content=f"{item.reason}；动作：{item.action}；预期：{item.expected}",
            )
            for item in diagnosis.recommendations
        ] or [ReportBulletItem(content="当前没有足够证据输出明确动作建议。")],
    )

    section_map["conclusion"] = DynamicReportSection(
        id="conclusion",
        kind="callout",
        title="报告结论",
        content=(
            f"当前报告基于真实主数据、历史计算记录以及规则诊断结果生成。"
            f"本次识别出 {len(diagnosis.anomalies)} 个异常对象、{len(diagnosis.constraints)} 个约束冲突，"
            f"建议优先执行 {len(diagnosis.recommendations)} 项动作并继续补充对象级时序数据。"
        ),
    )

    return [section_map[item.id] for item in outline.sections if item.id in section_map]


def build_risk_items(diagnosis: DiagnosisResult) -> list[ReportRiskItem]:
    return [
        ReportRiskItem(
            target=item["target"],
            riskType=item["riskType"],
            level=item["level"],
            reason=item["reason"],
            suggestion=item["suggestion"],
        )
        for item in diagnosis.risks[:6]
    ]


def build_suggestion_items(diagnosis: DiagnosisResult) -> list[ReportSuggestionItem]:
    return [
        ReportSuggestionItem(
            target=item.target,
            reason=item.reason,
            action=item.action,
            expected=item.expected,
            priority=item.priority,
        )
        for item in diagnosis.recommendations[:6]
    ]


def build_highlights(diagnosis: DiagnosisResult, metrics: MetricSnapshot) -> list[str]:
    highlights = [
        f"历史计算成功率 {_fmt_number(metrics.overview_metrics.get('success_rate'), digits=1, suffix='%')}",
        f"平均泵效 {_fmt_number(metrics.overview_metrics.get('avg_pump_efficiency'))}",
    ]
    highlights.extend(item.summary for item in diagnosis.trends[:2])
    highlights.extend(item.summary for item in diagnosis.constraints[:2])
    return highlights[:6]


def build_summary(diagnosis: DiagnosisResult, metrics: MetricSnapshot) -> list[str]:
    overview = metrics.overview_metrics
    return [
        f"本次报告覆盖 {overview['project_count']} 个项目、{overview['pipeline_count']} 条管道和 {overview['pump_station_count']} 座泵站。",
        f"当前历史样本共 {overview['history_total_count']} 次，成功 {overview['history_success_count']} 次，失败 {overview['history_failed_count']} 次。",
        f"已识别 {len(diagnosis.trends)} 个趋势、{len(diagnosis.anomalies)} 个异常、{len(diagnosis.causes)} 条原因链和 {len(diagnosis.constraints)} 个约束冲突。",
    ]


def build_raw_text(
    outline: OutlinePlan,
    diagnosis: DiagnosisResult,
    metrics: MetricSnapshot,
    sections: list[DynamicReportSection],
) -> str:
    lines = [
        f"标题：{outline.title}",
        f"摘要：{outline.abstract}",
        "",
        "关键指标：",
        *[f"- {key}: {value}" for key, value in metrics.overview_metrics.items()],
        "",
        "趋势：",
        *[f"- {item.summary}" for item in diagnosis.trends],
        "",
        "异常：",
        *[f"- {item.summary}" for item in diagnosis.anomalies],
        "",
        "约束：",
        *[f"- {item.summary}" for item in diagnosis.constraints],
        "",
        "章节：",
        *[f"- {section.title}" for section in sections],
    ]
    return "\n".join(lines)

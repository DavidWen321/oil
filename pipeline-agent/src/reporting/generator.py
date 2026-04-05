"""Dynamic report generation with rules-first analysis and optional LLM polishing."""

from __future__ import annotations

import json
from statistics import mean
from typing import Any

from langchain_openai import ChatOpenAI

from src.config import settings
from src.models.schemas import (
    DynamicReportRequest,
    DynamicReportResponse,
    DynamicReportSection,
    ReportBulletItem,
    ReportMetricItem,
    ReportRiskItem,
    ReportSuggestionItem,
    ReportTableData,
)
from src.tools.database_tools import execute_query
from src.tools.java_service_tools import get_java_client
from src.utils import logger


def _to_number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _format_decimal(value: float | None, digits: int = 1) -> str:
    if value is None:
        return "-"
    return f"{value:.{digits}f}"


def _format_percent(value: float | None, digits: int = 1) -> str:
    if value is None:
        return "-"
    return f"{value:.{digits}f}%"


def _normalize_range_label(request: DynamicReportRequest) -> str:
    if request.range_label:
        return request.range_label
    if request.custom_start and request.custom_end:
        return f"{request.custom_start} 至 {request.custom_end}"
    mapping = {
        "today": "今日",
        "7d": "近7天",
        "30d": "近30天",
        "90d": "近90天",
        "year": "本年度",
        "all": "全量历史",
    }
    return mapping.get(request.range_preset or "", request.range_preset or "默认范围")


def _normalize_report_type_label(request: DynamicReportRequest) -> str:
    if request.report_type_label:
        return request.report_type_label
    mapping = {
        "AI_REPORT": "智能分析报告",
        "RISK_REVIEW": "风险复盘报告",
        "ENERGY_DIAGNOSIS": "能耗诊断报告",
        "OPERATION_BRIEF": "运行简报",
        "overview": "运行概况报告",
        "energy": "能耗分析报告",
        "pump": "泵站优化报告",
        "sensitivity": "敏感性分析报告",
        "diagnosis": "异常诊断报告",
        "comparison": "方案对比报告",
    }
    return mapping.get(request.report_type, request.report_type)


def _normalize_output_style(request: DynamicReportRequest) -> str:
    mapping = {
        "simple": "简洁版",
        "professional": "专业版",
        "presentation": "汇报版",
    }
    return mapping.get(request.output_style or "", request.output_style or "标准版")


def _output_style_key(request: DynamicReportRequest) -> str:
    value = (request.output_style or "professional").strip().lower()
    if value in {"simple", "professional", "presentation"}:
        return value
    return "professional"


def _normalize_analysis_object_label(value: str | None) -> str:
    mapping = {
        "project": "项目",
        "single_project": "单项目",
        "pipeline": "管道",
        "pumpStation": "泵站",
        "pump_station": "泵站",
    }
    return mapping.get(value or "", value or "-")


def _normalize_optimization_goal_label(value: str | None) -> str:
    mapping = {
        "energy": "能耗优先",
        "cost": "成本优先",
        "safety": "安全优先",
        "balanced": "综合平衡",
    }
    return mapping.get(value or "", value or "-")


def _load_projects(request: DynamicReportRequest) -> list[dict[str, Any]]:
    rows = execute_query(
        """
        SELECT pro_id, number, name, responsible, build_date
        FROM t_project
        ORDER BY pro_id ASC
        """
    )
    selected_ids = set(request.selected_project_ids)
    selected_names = {name.strip() for name in request.project_names if name.strip()}
    if selected_ids:
        rows = [row for row in rows if row.get("pro_id") in selected_ids]
    elif selected_names:
        rows = [row for row in rows if str(row.get("name") or "").strip() in selected_names]
    return rows


def _load_pipelines(project_ids: list[int]) -> list[dict[str, Any]]:
    rows = execute_query(
        """
        SELECT id, pro_id, name, length, diameter, roughness, throughput, work_time
        FROM t_pipeline
        ORDER BY pro_id ASC, id ASC
        """
    )
    if not project_ids:
        return rows
    selected = set(project_ids)
    return [row for row in rows if row.get("pro_id") in selected]


def _load_pump_stations() -> list[dict[str, Any]]:
    return execute_query(
        """
        SELECT id, name, pump_efficiency, electric_efficiency, displacement, come_power
        FROM t_pump_station
        ORDER BY id ASC
        """
    )


def _load_oil_properties() -> list[dict[str, Any]]:
    return execute_query(
        """
        SELECT id, name, density, viscosity
        FROM t_oil_property
        ORDER BY id ASC
        """
    )


def _load_history_snapshot() -> dict[str, Any]:
    client = get_java_client()
    overview = client.call_api("/calculation/statistics/overview", method="GET")
    history_page = client.call_api(
        "/calculation/history/page",
        method="GET",
        params={"pageNum": 1, "pageSize": 8},
    )
    return {
        "overview": overview.get("data", {}) if isinstance(overview, dict) else {},
        "recent": ((history_page.get("data") or {}).get("list") or []) if isinstance(history_page, dict) else [],
    }


def _safe_load_history_snapshot() -> dict[str, Any]:
    try:
        return _load_history_snapshot()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load report history snapshot: %s", exc)
        return {"overview": {}, "recent": []}


def _project_rows(projects: list[dict[str, Any]], pipelines: list[dict[str, Any]]) -> list[list[str]]:
    pipeline_groups: dict[int, list[dict[str, Any]]] = {}
    for pipeline in pipelines:
        pipeline_groups.setdefault(int(pipeline.get("pro_id") or 0), []).append(pipeline)

    rows: list[list[str]] = []
    for project in projects:
        group = pipeline_groups.get(int(project.get("pro_id") or 0), [])
        throughput_values = [_to_number(item.get("throughput")) for item in group]
        throughput_sum = sum(value for value in throughput_values if value is not None)
        rows.append(
            [
                str(project.get("number") or "-"),
                str(project.get("name") or "-"),
                str(len(group)),
                _format_decimal(throughput_sum, 2),
                str(project.get("responsible") or "-"),
            ]
        )
    return rows


def _recent_history_rows(recent_histories: list[dict[str, Any]]) -> list[list[str]]:
    rows: list[list[str]] = []
    for item in recent_histories[:6]:
        rows.append(
            [
                str(item.get("calcTypeName") or item.get("calcType") or "-"),
                str(item.get("projectName") or "-"),
                str(item.get("statusName") or "-"),
                str(item.get("calcDurationFormatted") or "-"),
                str(item.get("createTime") or "-"),
            ]
        )
    return rows


def _filter_by_ids_or_names(
    rows: list[dict[str, Any]],
    *,
    id_key: str,
    name_key: str,
    ids: list[int] | None = None,
    names: list[str] | None = None,
) -> list[dict[str, Any]]:
    selected_ids = {item for item in (ids or []) if item is not None}
    selected_names = {str(item).strip() for item in (names or []) if str(item).strip()}
    if selected_ids:
        rows = [row for row in rows if row.get(id_key) in selected_ids]
    if selected_names:
        rows = [row for row in rows if str(row.get(name_key) or "").strip() in selected_names]
    return rows


def _build_scope_rows(
    request: DynamicReportRequest,
    *,
    analysis_target: str,
    range_label: str,
    projects: list[dict[str, Any]],
    pipelines: list[dict[str, Any]],
    pump_stations: list[dict[str, Any]],
    oil_properties: list[dict[str, Any]],
) -> list[list[str]]:
    project_label = "、".join(str(item.get("name") or "-") for item in projects[:4]) if projects else "全部项目"
    if len(projects) > 4:
        project_label = f"{project_label} 等 {len(projects)} 个"

    pipeline_label = request.selected_pipeline_name or (str(pipelines[0].get("name") or "-") if len(pipelines) == 1 else f"{len(pipelines)} 条")
    pump_label = "、".join(str(item.get("name") or "-") for item in pump_stations[:3]) if pump_stations else "全部泵站"
    if len(pump_stations) > 3:
        pump_label = f"{pump_label} 等 {len(pump_stations)} 座"
    oil_label = request.selected_oil_name or (str(oil_properties[0].get("name") or "-") if len(oil_properties) == 1 else f"{len(oil_properties)} 种")
    focus_label = "、".join(request.focuses[:4]) if request.focuses else "-"

    rows = [
        ["分析对象", _normalize_analysis_object_label(analysis_target)],
        ["时间范围", range_label],
        ["项目范围", project_label],
        ["管道范围", pipeline_label or "-"],
        ["泵站范围", pump_label],
        ["油品", oil_label or "-"],
        ["分析重点", focus_label],
        ["输出风格", _normalize_output_style(request)],
    ]
    if request.target_throughput is not None:
        rows.append(["目标输量", f"{request.target_throughput:.2f} m3/h"])
    if request.min_pressure is not None:
        rows.append(["最低出口压力", f"{request.min_pressure:.2f} MPa"])
    if request.optimization_goal:
        rows.append(["优化目标", _normalize_optimization_goal_label(request.optimization_goal)])
    rows.append(["泵站调整", "允许调整" if request.allow_pump_adjust else "禁止调整"])
    if request.remark:
        rows.append(["备注说明", request.remark.strip()])
    return rows


def _polish_with_llm(payload: dict[str, Any], request: DynamicReportRequest) -> dict[str, Any]:
    try:
        llm = ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE,
            model=settings.LLM_MODEL,
            temperature=0.2 if request.intelligence_level == "expert" else 0.1,
            max_tokens=min(settings.LLM_MAX_TOKENS, 1800),
            streaming=False,
        )
        prompt = "\n".join(
            [
                "你是工业能源系统的报告编辑，请在不编造数据的前提下润色报告。",
                "只允许基于给定 JSON 组织语言，不要新增字段，不要删除字段。",
                "输出 JSON，字段只允许包含 title、abstract、summary、highlights、conclusion、section_summaries。",
                "summary/highlights 保持数组格式，每项一句话。",
                "section_summaries 是对象，key 为 section id，value 为该 section 的一句话摘要。",
                json.dumps(payload, ensure_ascii=False),
            ]
        )
        response = llm.invoke(prompt)
        text = getattr(response, "content", "") if response is not None else ""
        cleaned = str(text).replace("```json", "").replace("```", "").strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            cleaned = cleaned[start : end + 1]
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else {}
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM polishing skipped for report generation: %s", exc)
        return {}


def generate_dynamic_report(request: DynamicReportRequest) -> DynamicReportResponse:
    projects = _load_projects(request)
    project_ids = [int(item.get("pro_id")) for item in projects if item.get("pro_id") is not None]
    pipelines = _load_pipelines(project_ids)
    pump_stations = _load_pump_stations()
    oil_properties = _load_oil_properties()
    if request.selected_pipeline_id is not None:
        pipelines = [item for item in pipelines if item.get("id") == request.selected_pipeline_id]
    elif request.selected_pipeline_name:
        pipelines = [item for item in pipelines if str(item.get("name") or "").strip() == request.selected_pipeline_name.strip()]
    pump_stations = _filter_by_ids_or_names(
        pump_stations,
        id_key="id",
        name_key="name",
        ids=request.selected_pump_station_ids,
        names=request.selected_pump_station_names,
    )
    oil_properties = _filter_by_ids_or_names(
        oil_properties,
        id_key="id",
        name_key="name",
        ids=[request.selected_oil_id] if request.selected_oil_id is not None else [],
        names=[request.selected_oil_name] if request.selected_oil_name else [],
    )
    history_snapshot = _safe_load_history_snapshot()
    overview = history_snapshot.get("overview") or {}
    recent_histories = history_snapshot.get("recent") or []

    throughput_values = [_to_number(item.get("throughput")) for item in pipelines]
    length_values = [_to_number(item.get("length")) for item in pipelines]
    pump_efficiencies = [_to_number(item.get("pump_efficiency")) for item in pump_stations]
    electric_efficiencies = [_to_number(item.get("electric_efficiency")) for item in pump_stations]

    total_throughput = sum(value for value in throughput_values if value is not None)
    avg_length = mean([value for value in length_values if value is not None]) if any(value is not None for value in length_values) else None
    avg_pump_efficiency = mean([value for value in pump_efficiencies if value is not None]) if any(value is not None for value in pump_efficiencies) else None
    avg_electric_efficiency = mean([value for value in electric_efficiencies if value is not None]) if any(value is not None for value in electric_efficiencies) else None

    total_count = int(overview.get("totalCount") or 0)
    success_count = int(overview.get("successCount") or 0)
    failed_count = int(overview.get("failedCount") or 0)
    success_rate = _to_number(overview.get("successRate"))
    today_count = int(overview.get("todayCount") or 0)
    avg_hydraulic_duration = _to_number(overview.get("avgHydraulicDuration"))
    avg_optimization_duration = _to_number(overview.get("avgOptimizationDuration"))

    range_label = _normalize_range_label(request)
    report_type_label = _normalize_report_type_label(request)
    output_style_label = _normalize_output_style(request)
    style_key = _output_style_key(request)
    project_names = [str(item.get("name") or "-") for item in projects]
    analysis_target = request.analysis_object or ("project" if len(projects) != 1 else "single_project")
    scope_rows = _build_scope_rows(
        request,
        analysis_target=analysis_target,
        range_label=range_label,
        projects=projects,
        pipelines=pipelines,
        pump_stations=pump_stations,
        oil_properties=oil_properties,
    )
    title_prefix = "、".join(project_names[:3]) if project_names else "全局"
    if len(project_names) > 3:
        title_prefix = f"{title_prefix}等{len(project_names)}个项目"

    summary = [
        f"本次报告覆盖 {len(projects)} 个项目、{len(pipelines)} 条管道和 {len(pump_stations)} 座泵站，分析范围为 {range_label}。",
        f"当前选定项目的管道总设计输量约 { _format_decimal(total_throughput, 2) }，平均管段长度 { _format_decimal(avg_length, 2) }。",
        f"系统累计计算 {total_count} 次，成功 {success_count} 次，失败 {failed_count} 次，成功率 { _format_percent(success_rate) }。",
    ]
    highlights = [
        f"平均泵效率 { _format_percent(avg_pump_efficiency * 100 if avg_pump_efficiency is not None and avg_pump_efficiency <= 1 else avg_pump_efficiency) }",
        f"平均电机效率 { _format_percent(avg_electric_efficiency * 100 if avg_electric_efficiency is not None and avg_electric_efficiency <= 1 else avg_electric_efficiency) }",
        f"今日新增计算 {today_count} 次",
    ]

    if request.target_throughput is not None:
        summary.append(f"目标输量约束为 {_format_decimal(request.target_throughput, 2)} m3/h。")
    if request.min_pressure is not None:
        summary.append(f"最低出口压力约束为 {_format_decimal(request.min_pressure, 2)} MPa。")
    if request.focuses:
        highlights.append(f"重点关注：{'、'.join(request.focuses[:4])}")
    if request.optimization_goal:
        highlights.append(f"优化目标：{_normalize_optimization_goal_label(request.optimization_goal)}")

    risks: list[ReportRiskItem] = []
    if total_count == 0:
        risks.append(
            ReportRiskItem(
                target=title_prefix,
                riskType="样本不足",
                level="高",
                reason="计算历史为空，报告结论只能基于主数据和静态配置，缺少运行样本支撑。",
                suggestion="优先补齐水力分析、优化分析和异常记录，再执行深度报告。",
            )
        )
    elif success_rate is not None and success_rate < 85:
        risks.append(
            ReportRiskItem(
                target=title_prefix,
                riskType="计算稳定性",
                level="高",
                reason=f"历史计算成功率仅为 {success_rate:.1f}%，失败记录偏多，说明输入口径或服务稳定性存在问题。",
                suggestion="先排查失败样本的输入参数完整性，并收敛报表口径后再做结论对比。",
            )
        )
    if avg_pump_efficiency is not None and avg_pump_efficiency < 0.75:
        risks.append(
            ReportRiskItem(
                target="泵站系统",
                riskType="效率偏低",
                level="中",
                reason=f"当前泵效率均值约为 {avg_pump_efficiency:.2f}，存在能耗偏高或设备工况不匹配的风险。",
                suggestion="核查泵组组合、启停策略和实际输量是否匹配当前工况。",
            )
        )
    if not pipelines:
        risks.append(
            ReportRiskItem(
                target=title_prefix,
                riskType="主数据缺失",
                level="高",
                reason="没有查询到管道参数，无法构造完整的运行或能耗画像。",
                suggestion="先补齐项目下的管道参数，再执行正式报告生成。",
            )
        )

    suggestions: list[ReportSuggestionItem] = []
    suggestions.append(
        ReportSuggestionItem(
            target=title_prefix,
            reason="当前报告已经汇总主数据、计算统计和近期记录，但仍需要更细粒度的对象级分层。",
            action="在下一版报告中增加按项目/管段/泵站拆分的章节，并支持单章节重生成。",
            expected="让报告从全局结论过渡到对象级执行清单。",
            priority="高",
        )
    )
    if total_count > 0:
        suggestions.append(
            ReportSuggestionItem(
                target="历史样本库",
                reason="已有计算历史可以用于对比，但当前预览更偏总览，缺少周期趋势。",
                action="对接按日趋势和同环比口径，生成趋势图或对比表。",
                expected="让报告具备趋势判断和波动识别能力，而不只是静态快照。",
                priority="中",
            )
        )
    if request.focuses:
        suggestions.append(
            ReportSuggestionItem(
                target="报告引擎",
                reason=f"本次重点关注 {', '.join(request.focuses[:4])}，适合走定制章节而不是固定模板。",
                action="根据焦点自动排序章节，把高相关章节置顶，低相关章节降级为附录。",
                expected="报告结构更贴近用户意图，避免固定模板感。",
                priority="高",
            )
        )

    conclusion = (
        f"{report_type_label}已基于真实数据库主数据和计算统计完成生成，当前更适合做管理层/技术负责人快速预览。"
        f"若要进一步增强智能度，下一步应补充对象级趋势、异常证据和章节级重生成能力。"
    )

    if style_key == "simple":
        summary = summary[:2]
        highlights = highlights[:2]
        suggestions = suggestions[:2]
        conclusion = "报告已按简洁版生成，重点保留核心结论、关键指标和直接建议，适合快速查看。"
    elif style_key == "presentation":
        summary = [
            f"本次报告覆盖 {len(projects)} 个项目、{len(pipelines)} 条管道和 {len(pump_stations)} 座泵站。",
            f"当前优先关注成功率 {_format_percent(success_rate)}、主要风险 {len(risks)} 项和行动建议 {len(suggestions)} 项。",
        ]
        highlights = highlights[:2] + ["当前已切换为汇报版，优先展示结论、风险和行动项。"]
        suggestions = suggestions[:3]
        conclusion = "报告已按汇报版生成，适合用于领导汇报、周会汇报和结果同步。"

    sections: list[DynamicReportSection] = [
        DynamicReportSection(
            id="overview-metrics",
            kind="metrics",
            title="数据概览",
            summary="先确认报告覆盖范围和样本规模，避免无样本时仍输出强结论。",
            metrics=[
                ReportMetricItem(label="覆盖项目", value=str(len(projects)), note="按当前筛选条件"),
                ReportMetricItem(label="覆盖管道", value=str(len(pipelines)), note="主数据表 t_pipeline"),
                ReportMetricItem(label="泵站数量", value=str(len(pump_stations)), note="共享泵站总量"),
                ReportMetricItem(label="油品数量", value=str(len(oil_properties)), note="油品参数主数据"),
                ReportMetricItem(label="计算历史", value=str(total_count), note="来自 Java 统计接口"),
            ],
        ),
        DynamicReportSection(
            id="scope-context",
            kind="table",
            title="分析范围与约束条件",
            summary="该章节用于展示本次报告的分析对象、时间范围、业务约束与输出偏好，确保报告内容与用户配置一致。",
            table=ReportTableData(
                columns=["项目", "内容"],
                rows=scope_rows,
            ),
        ),
        DynamicReportSection(
            id="core-findings",
            kind="bullets",
            title="核心发现",
            summary="核心发现按规则先行生成，再由模型做语言润色。",
            items=[ReportBulletItem(content=item) for item in summary],
        ),
        DynamicReportSection(
            id="project-profile",
            kind="table",
            title="项目画像",
            summary="用于支撑章节级钻取，而不是只看固定摘要。",
            table=ReportTableData(
                columns=["项目编号", "项目名称", "管道数量", "设计输量合计", "负责人"],
                rows=_project_rows(projects, pipelines),
            ),
        ),
        DynamicReportSection(
            id="operation-metrics",
            kind="metrics",
            title="运行与效率指标",
            summary="这部分把能耗/运行相关的核心指标统一成可复用组件。",
            metrics=[
                ReportMetricItem(label="成功率", value=_format_percent(success_rate), note="历史计算执行质量"),
                ReportMetricItem(label="平均泵效率", value=_format_decimal(avg_pump_efficiency, 2), note="低于 0.75 需关注"),
                ReportMetricItem(label="平均电机效率", value=_format_decimal(avg_electric_efficiency, 2), note="设备侧参考"),
                ReportMetricItem(label="平均水力分析耗时", value=_format_decimal(avg_hydraulic_duration, 2), note="ms"),
                ReportMetricItem(label="平均优化耗时", value=_format_decimal(avg_optimization_duration, 2), note="ms"),
            ],
        ),
    ]

    if recent_histories:
        sections.append(
            DynamicReportSection(
                id="recent-history",
                kind="table",
                title="近期计算记录",
                summary="近期记录可作为报告问答联动和二次追问入口。",
                table=ReportTableData(
                    columns=["类型", "项目", "状态", "耗时", "时间"],
                    rows=_recent_history_rows(recent_histories),
                ),
            )
        )

    if request.include_risk:
        sections.append(
            DynamicReportSection(
                id="risk-section",
                kind="bullets",
                title="主要风险",
                summary="风险由规则引擎先判，再交给前端决定以表格、告警卡或 callout 展示。",
                items=[
                    ReportBulletItem(
                        title=f"{item.level}风险 | {item.target} | {item.riskType}",
                        content=f"{item.reason} 建议：{item.suggestion}",
                    )
                    for item in risks
                ],
            )
        )

    if request.include_suggestions:
        sections.append(
            DynamicReportSection(
                id="action-plan",
                kind="bullets",
                title="行动建议",
                summary="建议绑定对象、原因和预期收益，避免泛化建议。",
                items=[
                    ReportBulletItem(
                        title=f"{item.priority}优先级 | {item.target}",
                        content=f"{item.reason} 建议动作：{item.action} 预期：{item.expected}",
                    )
                    for item in suggestions
                ],
            )
        )

    if request.include_conclusion:
        sections.append(
            DynamicReportSection(
                id="conclusion",
                kind="callout",
                title="结论",
                content=conclusion,
            )
        )

    if style_key == "simple":
        simple_ids = {"overview-metrics", "core-findings", "action-plan", "conclusion"}
        sections = [section for section in sections if section.id in simple_ids]
    elif style_key == "presentation":
        ordered_ids = ["core-findings", "risk-section", "action-plan", "conclusion", "overview-metrics"]
        section_map = {section.id: section for section in sections}
        sections = [section_map[section_id] for section_id in ordered_ids if section_id in section_map]

    llm_input = {
        "request": {
            "report_type": request.report_type,
            "report_type_label": report_type_label,
            "range_label": range_label,
            "analysis_object": analysis_target,
            "focuses": request.focuses,
            "output_style": output_style_label,
            "user_prompt": request.user_prompt or "",
        },
        "draft": {
            "title": f"{title_prefix} {report_type_label}",
            "abstract": f"报告基于真实数据库主数据、Java 计算统计以及近期计算记录生成，输出风格为{output_style_label}。",
            "summary": summary,
            "highlights": highlights,
            "conclusion": conclusion,
            "sections": [{"id": section.id, "title": section.title, "summary": section.summary or ""} for section in sections],
        },
    }
    polished = _polish_with_llm(llm_input, request)
    section_summaries = polished.get("section_summaries") if isinstance(polished.get("section_summaries"), dict) else {}

    final_title = str(polished.get("title") or f"{title_prefix} {report_type_label}").strip()
    final_abstract = str(
        polished.get("abstract")
        or f"报告基于真实数据库主数据、Java 计算统计以及近期计算记录生成，输出风格为{output_style_label}。"
    ).strip()
    final_summary = [str(item).strip() for item in polished.get("summary") or summary if str(item).strip()]
    final_highlights = [str(item).strip() for item in polished.get("highlights") or highlights if str(item).strip()]
    final_conclusion = str(polished.get("conclusion") or conclusion).strip()

    if section_summaries:
        sections = [
            section.model_copy(
                update={
                    "summary": str(section_summaries.get(section.id) or section.summary or "").strip() or section.summary
                }
            )
            for section in sections
        ]

    source = "hybrid" if polished else "rules"
    metadata = {
        "request": request.model_dump(),
        "range_label": range_label,
        "output_style_label": output_style_label,
        "selected_project_count": len(projects),
        "pipeline_count": len(pipelines),
        "pump_station_count": len(pump_stations),
        "oil_property_count": len(oil_properties),
        "history_total_count": total_count,
        "scope_rows": scope_rows,
    }

    return DynamicReportResponse(
        title=final_title,
        abstract=final_abstract,
        source=source,
        summary=final_summary,
        highlights=final_highlights,
        risks=risks if request.include_risk else [],
        suggestions=suggestions if request.include_suggestions else [],
        conclusion=final_conclusion if request.include_conclusion else "",
        sections=sections,
        metadata=metadata,
        raw_text=json.dumps(
            {
                "metrics": metadata,
                "recent_history_count": len(recent_histories),
                "project_names": project_names,
            },
            ensure_ascii=False,
            indent=2,
        ),
    )

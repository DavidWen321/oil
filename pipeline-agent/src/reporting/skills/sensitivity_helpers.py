from __future__ import annotations

from typing import Any

ENERGY_WARNING_THRESHOLD = 20.0
ENERGY_RISK_THRESHOLD = 45.0
PRESSURE_WARNING_DROP_THRESHOLD = 5.0
HIGH_LOAD_SENSITIVITY_THRESHOLD = 0.8
NONLINEAR_SLOPE_MIN_THRESHOLD = 0.01
NONLINEAR_SLOPE_RATIO_THRESHOLD = 1.8
NONLINEAR_SLOPE_DELTA_THRESHOLD = 0.3


def as_record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_record_array(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def to_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value)
        except ValueError:
            return None
    return None


def format_number(value: Any, digits: int = 2, suffix: str = "") -> str:
    numeric = to_float(value)
    if numeric is None:
        return "-"
    text = f"{numeric:.{digits}f}".rstrip("0").rstrip(".")
    return f"{text}{suffix}"


def format_signed_percent(value: Any, digits: int = 0) -> str:
    numeric = to_float(value)
    if numeric is None:
        return "-"
    sign = "+" if numeric > 0 else ""
    text = f"{numeric:.{digits}f}".rstrip("0").rstrip(".")
    return f"{sign}{text}%"


def pick_first_value(sources: list[dict[str, Any] | None], keys: list[str]) -> Any:
    for source in sources:
        if not isinstance(source, dict):
            continue
        for key in keys:
            value = source.get(key)
            if value is not None and str(value).strip() != "":
                return value
    return None


def classify_sensitivity_impact_level(value: float | None) -> str:
    if value is None:
        return "数据不足"
    if value >= 0.8:
        return "较强"
    if value >= 0.4:
        return "中等"
    return "较弱"


def evaluate_sensitivity_risk_level(
    sensitivity_coefficient: float | None,
    max_impact_percent: float | None,
    min_end_station_pressure: float | None,
    flow_regime_changed: bool,
) -> str:
    if (
        (sensitivity_coefficient is not None and sensitivity_coefficient >= 0.8)
        or (max_impact_percent is not None and max_impact_percent >= 20)
        or (min_end_station_pressure is not None and min_end_station_pressure < 0)
        or flow_regime_changed
    ):
        return "高风险"
    if (
        (sensitivity_coefficient is not None and sensitivity_coefficient >= 0.4)
        or (max_impact_percent is not None and max_impact_percent >= 10)
    ):
        return "中风险"
    return "可控"


def build_sensitivity_base_condition(input_payload: dict[str, Any], input_base: dict[str, Any] | None) -> str:
    sources = [input_base, input_payload]
    parts: list[str] = []

    flow_rate = pick_first_value(sources, ["flowRate", "throughput", "flow"])
    density = pick_first_value(sources, ["density"])
    diameter = pick_first_value(sources, ["diameter"])

    if to_float(flow_rate) is not None:
        parts.append(f"流量 {format_number(flow_rate)} m³/h")
    if to_float(density) is not None:
        parts.append(f"密度 {format_number(density)} kg/m³")
    if to_float(diameter) is not None:
        parts.append(f"管径 {format_number(diameter)} mm")

    return "，".join(parts) if parts else "当前数据不足以支持进一步判断"


def build_sensitive_variable_display(input_payload: dict[str, Any], input_base: dict[str, Any] | None) -> str:
    direct_value = pick_first_value(
        [input_payload, input_base],
        ["sensitiveVariableType", "sensitivityVariableType", "variableType"],
    )
    if direct_value is not None and str(direct_value).strip():
        return str(direct_value).strip()

    variables = as_record_array(input_payload.get("variables"))
    names = [
        str(item.get("variableName") or item.get("variableType") or "").strip()
        for item in variables
        if str(item.get("variableName") or item.get("variableType") or "").strip()
    ]
    return "、".join(names) if names else "-"


def sort_sensitivity_ranking_rows(output_payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = as_record_array(output_payload.get("sensitivityRanking"))

    def _sort_key(item: dict[str, Any]) -> tuple[float, float]:
        rank_value = to_float(item.get("rank"))
        score_value = to_float(item.get("sensitivityCoefficient"))
        if rank_value is not None:
            return (0.0, rank_value)
        return (1.0, -(score_value if score_value is not None else float("-inf")))

    return sorted(rows, key=_sort_key)


def sort_sensitivity_impact_rows(output_payload: dict[str, Any]) -> list[dict[str, Any]]:
    return sorted(
        as_record_array(output_payload.get("variableResults")),
        key=lambda item: -(to_float(item.get("maxImpactPercent")) or float("-inf")),
    )


def get_sensitivity_primary_variable_result(output_payload: dict[str, Any]) -> dict[str, Any]:
    variable_results = as_record_array(output_payload.get("variableResults"))
    if not variable_results:
        return {}

    ranking_rows = sort_sensitivity_ranking_rows(output_payload)
    top_rank = ranking_rows[0] if ranking_rows else {}
    top_variable_type = str(top_rank.get("variableType") or "").strip()
    if top_variable_type:
        for item in variable_results:
            if str(item.get("variableType") or "").strip() == top_variable_type:
                return item
    return variable_results[0]


def _get_change_label(row: dict[str, Any]) -> str:
    return format_signed_percent(row.get("changePercent"))


def _get_change_stats(point_rows: list[dict[str, Any]]) -> dict[str, float | None]:
    max_friction_increase_percent: float | None = None
    max_pressure_drop_percent: float | None = None

    for row in point_rows:
        friction_change = to_float(row.get("frictionChangePercent"))
        if friction_change is not None and friction_change > 0:
            if max_friction_increase_percent is None or friction_change > max_friction_increase_percent:
                max_friction_increase_percent = friction_change

        pressure_change = to_float(row.get("pressureChangePercent"))
        if pressure_change is not None and pressure_change < 0:
            drop_percent = abs(pressure_change)
            if max_pressure_drop_percent is None or drop_percent > max_pressure_drop_percent:
                max_pressure_drop_percent = drop_percent

    return {
        "maxFrictionIncreasePercent": max_friction_increase_percent,
        "maxPressureDropPercent": max_pressure_drop_percent,
    }


def _analyze_nonlinear_growth(point_rows: list[dict[str, Any]]) -> dict[str, Any]:
    sorted_rows = sorted(point_rows, key=lambda item: to_float(item.get("changePercent")) or 0.0)
    slopes: list[dict[str, Any]] = []

    for index in range(1, len(sorted_rows)):
        previous = sorted_rows[index - 1]
        current = sorted_rows[index]
        start = to_float(previous.get("changePercent"))
        end = to_float(current.get("changePercent"))
        previous_value = to_float(previous.get("frictionChangePercent"))
        current_value = to_float(current.get("frictionChangePercent"))
        if start is None or end is None or previous_value is None or current_value is None:
            continue

        span = end - start
        if abs(span) < 1e-9:
            continue

        slope = abs((current_value - previous_value) / span)
        if slope < NONLINEAR_SLOPE_MIN_THRESHOLD:
            continue

        slopes.append(
            {
                "label": f"{_get_change_label(previous)} 至 {_get_change_label(current)}",
                "slope": slope,
            }
        )

    if len(slopes) < 2:
        return {"hasNonlinearGrowth": False, "segmentLabel": "", "slopeRatio": None}

    min_slope = min(item["slope"] for item in slopes)
    max_item = max(slopes, key=lambda item: item["slope"])
    slope_ratio = None if min_slope <= 0 else max_item["slope"] / min_slope
    has_growth = bool(
        slope_ratio is not None
        and slope_ratio >= NONLINEAR_SLOPE_RATIO_THRESHOLD
        and (max_item["slope"] - min_slope) >= NONLINEAR_SLOPE_DELTA_THRESHOLD
    )
    return {
        "hasNonlinearGrowth": has_growth,
        "segmentLabel": max_item["label"] if has_growth else "",
        "slopeRatio": slope_ratio if has_growth else None,
    }


def build_sensitivity_fallback_risk_rules(insights: dict[str, Any]) -> list[dict[str, Any]]:
    if not insights:
        return []

    point_rows = as_record_array(insights.get("pointRows"))
    top_variable_name = str(insights.get("topVariableName") or "").strip() or "当前关键变量"
    sensitivity_coefficient = to_float(insights.get("sensitivityCoefficient"))
    max_impact_percent = to_float(insights.get("maxImpactPercent"))
    min_end_station_pressure = to_float(insights.get("minEndStationPressure"))
    pressure_trend_text = str(insights.get("pressureTrendText") or "").strip() or "变化不明显"
    flow_regime_changed = bool(insights.get("flowRegimeChanged"))
    flow_regime_segments = [
        str(item).strip()
        for item in insights.get("flowRegimeSegments") or []
        if str(item).strip()
    ]

    if not point_rows and sensitivity_coefficient is None and max_impact_percent is None and min_end_station_pressure is None:
        return []

    change_stats = _get_change_stats(point_rows)
    nonlinear_growth = _analyze_nonlinear_growth(point_rows)
    max_friction_increase_percent = change_stats["maxFrictionIncreasePercent"]
    max_pressure_drop_percent = change_stats["maxPressureDropPercent"]

    if max_friction_increase_percent is not None and max_friction_increase_percent >= ENERGY_RISK_THRESHOLD:
        energy_level = "风险区"
    elif max_friction_increase_percent is not None and max_friction_increase_percent >= ENERGY_WARNING_THRESHOLD:
        energy_level = "高能耗区"
    else:
        energy_level = "安全区"

    if min_end_station_pressure is not None and min_end_station_pressure < 0:
        stability_level = "风险区"
    elif max_pressure_drop_percent is not None and max_pressure_drop_percent >= PRESSURE_WARNING_DROP_THRESHOLD:
        stability_level = "预警区"
    else:
        stability_level = "安全区"

    if flow_regime_changed or nonlinear_growth["hasNonlinearGrowth"]:
        equipment_level = "风险区"
    elif sensitivity_coefficient is not None and sensitivity_coefficient >= HIGH_LOAD_SENSITIVITY_THRESHOLD:
        equipment_level = "高负荷区"
    else:
        equipment_level = "安全区"

    if energy_level == "风险区":
        energy_message = (
            f"核心算法结果未附带 riskRules，现按采样点补算：{top_variable_name}扰动后的摩阻损失最大正向增幅为 "
            f"{format_number(max_friction_increase_percent, suffix='%')}，已超过能耗风险阈值 "
            f"{format_number(ENERGY_RISK_THRESHOLD, suffix='%')}。"
        )
    elif energy_level == "高能耗区":
        energy_message = (
            f"核心算法结果未附带 riskRules，现按采样点补算：{top_variable_name}扰动后的摩阻损失最大正向增幅为 "
            f"{format_number(max_friction_increase_percent, suffix='%')}，已超过高能耗阈值 "
            f"{format_number(ENERGY_WARNING_THRESHOLD, suffix='%')}，但尚未达到风险阈值 "
            f"{format_number(ENERGY_RISK_THRESHOLD, suffix='%')}。"
        )
    else:
        energy_message = (
            f"核心算法结果未附带 riskRules，现按采样点补算：{top_variable_name}扰动后的摩阻损失最大正向增幅为 "
            f"{format_number(max_friction_increase_percent, suffix='%')}，未达到高能耗阈值 "
            f"{format_number(ENERGY_WARNING_THRESHOLD, suffix='%')}。"
        )

    if stability_level == "风险区":
        stability_message = (
            "核心算法结果未附带 riskRules，现按采样点补算：末站最小进站压力为 "
            f"{format_number(min_end_station_pressure)}，已低于 0，压力边界被直接触发。"
        )
    elif stability_level == "预警区":
        stability_message = (
            "核心算法结果未附带 riskRules，现按采样点补算：末站进站压力最大降幅为 "
            f"{format_number(max_pressure_drop_percent, suffix='%')}，已超过预警阈值 "
            f"{format_number(PRESSURE_WARNING_DROP_THRESHOLD, suffix='%')}；压力趋势为{pressure_trend_text}。"
        )
    else:
        stability_message = (
            "核心算法结果未附带 riskRules，现按采样点补算：最小末站进站压力为 "
            f"{format_number(min_end_station_pressure)}，最大压力降幅为 "
            f"{format_number(max_pressure_drop_percent, suffix='%')}，尚未触发压力风险或预警阈值。"
        )

    if equipment_level == "风险区":
        reasons: list[str] = []
        if flow_regime_changed and flow_regime_segments:
            reasons.append(f"采样区间内流态发生切换：{'；'.join(flow_regime_segments)}。")
        if nonlinear_growth["hasNonlinearGrowth"]:
            reasons.append(
                "摩阻变化在 "
                f"{str(nonlinear_growth['segmentLabel']) or '当前采样区间'} 出现非线性放大，最大局部响应约为最小响应的 "
                f"{format_number(nonlinear_growth['slopeRatio'])} 倍。"
            )
        equipment_message = "".join(reasons) or "采样区间内识别到设备边界放大迹象。"
    elif equipment_level == "高负荷区":
        equipment_message = (
            f"核心算法结果未附带 riskRules，现按采样点补算：{top_variable_name}敏感系数为 "
            f"{format_number(sensitivity_coefficient)}，达到高负荷关注阈值 "
            f"{format_number(HIGH_LOAD_SENSITIVITY_THRESHOLD)}。"
        )
    else:
        equipment_message = (
            "核心算法结果未附带 riskRules，现按采样点补算：采样区间内未发现明显流态切换或非线性放大；"
            f"{top_variable_name}敏感系数为 {format_number(sensitivity_coefficient)}，未达到高负荷关注阈值。"
        )

    return [
        {
            "riskCode": "energy_consumption_zone",
            "title": "能耗区判断",
            "targetName": top_variable_name,
            "level": energy_level,
            "message": energy_message,
            "impact": {
                "风险区": "单位输量能耗和泵组负荷会被阻力项快速放大，应限制继续向不利方向调整。",
                "高能耗区": "系统尚可运行，但新增扬程会优先用于克服沿程阻力，继续粗放上调变量会扩大能耗。",
            }.get(energy_level, "当前能耗侧仍有调节余量，但仍应围绕头部敏感变量做小步调整。"),
            "suggestion": "建议以摩阻损失增幅作为能耗侧复核指标，优先控制头部敏感变量。",
            "source": "calculated_rule_fallback",
        },
        {
            "riskCode": "operation_stability_zone",
            "title": "运行稳定区判断",
            "targetName": "当前方案",
            "level": stability_level,
            "message": stability_message,
            "impact": {
                "风险区": "末站供输裕度被压缩到边界以下，当前方案不宜按常规稳定工况处理。",
                "预警区": "当前仍可运行，但调度弹性已经变窄，继续向不利区间偏移可能进入风险区。",
            }.get(stability_level, "供输稳定性总体可控，但应持续监测末站压力降幅。"),
            "suggestion": "建议将末站进站压力和压力变化率作为稳定性复核指标。",
            "source": "calculated_rule_fallback",
        },
        {
            "riskCode": "equipment_boundary_zone",
            "title": "设备边界区判断",
            "targetName": "当前方案",
            "level": equipment_level,
            "message": equipment_message,
            "impact": {
                "风险区": "相同幅度的参数扰动不再可靠对应线性结果变化，容易导致误调度和泵组高负荷运行。",
                "高负荷区": "设备可运行但不宜长期贴近高阻、高负荷带，否则泵效率下降和维护周期缩短会先于故障边界出现。",
            }.get(equipment_level, "设备侧仍有调节余度，但调度策略仍应避免大步长调整。"),
            "suggestion": "建议同步跟踪流态、雷诺数和局部摩阻响应，避免越过稳定采样窗口。",
            "source": "calculated_rule_fallback",
        },
    ]


def normalize_sensitivity_risk_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows:
        title = str(pick_first_value([row], ["title", "name", "label"]) or "").strip()
        risk_code = str(
            pick_first_value([row], ["code", "riskCode", "riskType", "issueType", "metric"]) or "unknown"
        ).strip()
        target_name = str(
            pick_first_value([row], ["targetName", "target", "variableName", "variableType"]) or ""
        ).strip()
        level = str(pick_first_value([row], ["level", "riskLevel", "severity"]) or "").strip()
        message = str(
            pick_first_value([row], ["message", "reason", "description", "text", "title"]) or ""
        ).strip()
        suggestion = str(pick_first_value([row], ["suggestion", "action", "advice"]) or "").strip()
        impact = str(pick_first_value([row], ["impact", "effect", "resultImpact"]) or "").strip()
        if not risk_code and not message:
            continue
        normalized.append(
            {
                "title": title,
                "targetName": target_name,
                "riskCode": risk_code or "unknown",
                "level": level,
                "message": message,
                "suggestion": suggestion,
                "impact": impact,
            }
        )
    return normalized


def extract_sensitivity_risk_rules(ctx: dict[str, Any]) -> list[dict[str, Any]]:
    snapshot = as_record(ctx.get("sensitivity_snapshot"))
    output_payload = as_record(snapshot.get("output"))

    for key in ("riskRules", "riskIdentify", "riskItems", "risks"):
        rows = normalize_sensitivity_risk_rows(as_record_array(output_payload.get(key)))
        if rows:
            return rows

    fallback_rules = build_sensitivity_fallback_risk_rules(extract_sensitivity_insights(ctx))
    if fallback_rules:
        return fallback_rules

    return normalize_sensitivity_risk_rows(as_record_array(ctx.get("risk_flags")))


def resolve_trend_label(first_value: float | None, last_value: float | None) -> str:
    if first_value is None or last_value is None:
        return "数据不足"
    if last_value > first_value:
        return "整体上升"
    if last_value < first_value:
        return "整体下降"
    return "变化不明显"


def get_change_label(row: dict[str, Any]) -> str:
    return format_signed_percent(row.get("changePercent"))


def get_row_span_text(rows: list[dict[str, Any]], key: str, suffix: str = "") -> str:
    values = [to_float(item.get(key)) for item in rows]
    valid_values = [value for value in values if value is not None]
    if not valid_values:
        return "-"
    minimum = min(valid_values)
    maximum = max(valid_values)
    if minimum == maximum:
        return format_number(minimum, suffix=suffix)
    return f"{format_number(minimum, suffix=suffix)} ~ {format_number(maximum, suffix=suffix)}"


def build_regime_segments(rows: list[dict[str, Any]]) -> list[str]:
    if not rows:
        return []

    segments: list[str] = []
    current_regime = str(rows[0].get("flowRegime") or "").strip() or "-"
    start_label = get_change_label(rows[0])
    end_label = start_label

    for row in rows[1:]:
        regime = str(row.get("flowRegime") or "").strip() or "-"
        label = get_change_label(row)
        if regime == current_regime:
            end_label = label
            continue
        segments.append(f"{start_label} 至 {end_label} 为 {current_regime}")
        current_regime = regime
        start_label = label
        end_label = label

    segments.append(f"{start_label} 至 {end_label} 为 {current_regime}")
    return segments


def pick_extreme_point(
    rows: list[dict[str, Any]],
    key: str,
    mode: str,
) -> dict[str, Any]:
    valid_rows = [row for row in rows if to_float(row.get(key)) is not None]
    if not valid_rows:
        return {}
    if mode == "max":
        return max(valid_rows, key=lambda item: to_float(item.get(key)) or float("-inf"))
    return min(valid_rows, key=lambda item: to_float(item.get(key)) or float("inf"))


def extract_sensitivity_insights(ctx: dict[str, Any]) -> dict[str, Any]:
    snapshot = as_record(ctx.get("sensitivity_snapshot"))
    input_payload = as_record(snapshot.get("input"))
    output_payload = as_record(snapshot.get("output"))
    if not input_payload or not output_payload:
        return {}

    input_base = as_record(input_payload.get("baseParams"))
    base_result = as_record(output_payload.get("baseResult")) or output_payload
    variable_results = as_record_array(output_payload.get("variableResults"))
    ranking_rows = sort_sensitivity_ranking_rows(output_payload)
    impact_rows = sort_sensitivity_impact_rows(output_payload)
    primary_variable_result = get_sensitivity_primary_variable_result(output_payload)
    top_rank = ranking_rows[0] if ranking_rows else {}

    top_variable_name = str(
        top_rank.get("variableName")
        or primary_variable_result.get("variableName")
        or primary_variable_result.get("variableType")
        or build_sensitive_variable_display(input_payload, input_base)
    ).strip() or "-"
    top_rank_number = int(to_float(top_rank.get("rank")) or 1)
    sensitivity_coefficient = to_float(
        top_rank.get("sensitivityCoefficient") or primary_variable_result.get("sensitivityCoefficient")
    )

    max_impact_percent = to_float(primary_variable_result.get("maxImpactPercent"))
    if max_impact_percent is None:
        impact_values = [to_float(item.get("maxImpactPercent")) for item in variable_results]
        valid_impacts = [value for value in impact_values if value is not None]
        max_impact_percent = max(valid_impacts) if valid_impacts else None

    point_rows = sorted(
        as_record_array(primary_variable_result.get("dataPoints")),
        key=lambda item: to_float(item.get("changePercent")) or 0.0,
    )
    first_point = point_rows[0] if point_rows else {}
    last_point = point_rows[-1] if point_rows else {}
    flow_regimes = {
        str(item.get("flowRegime") or "").strip()
        for item in point_rows
        if str(item.get("flowRegime") or "").strip()
    }
    flow_regime_changed = len(flow_regimes) > 1

    end_station_pressures = [to_float(item.get("endStationPressure")) for item in point_rows]
    valid_pressures = [value for value in end_station_pressures if value is not None]
    min_end_station_pressure = min(valid_pressures) if valid_pressures else None

    base_end_station_pressure = to_float(
        pick_first_value([base_result], ["endStationInPressure", "endStationPressure", "terminalInPressure"])
    )
    if base_end_station_pressure is None:
        base_result_status = "数据不足"
    elif base_end_station_pressure >= 0:
        base_result_status = "正常"
    else:
        base_result_status = "存在压力风险"

    pressure_trend_text = resolve_trend_label(
        to_float(first_point.get("endStationPressure")),
        to_float(last_point.get("endStationPressure")),
    )
    friction_trend_text = resolve_trend_label(
        to_float(first_point.get("frictionHeadLoss")),
        to_float(last_point.get("frictionHeadLoss")),
    )

    project = as_record(ctx.get("project"))
    project_names = project.get("projectNames") or []
    project_name = str(snapshot.get("projectName") or (project_names[0] if project_names else "当前项目"))

    return {
        "projectName": project_name,
        "generatedAt": snapshot.get("generatedAt"),
        "inputPayload": input_payload,
        "inputBase": input_base,
        "outputPayload": output_payload,
        "baseResult": base_result,
        "baseCondition": build_sensitivity_base_condition(input_payload, input_base),
        "variableTypeText": build_sensitive_variable_display(input_payload, input_base),
        "baseResultStatus": base_result_status,
        "topVariableName": top_variable_name,
        "topRankNumber": top_rank_number,
        "sensitivityCoefficient": sensitivity_coefficient,
        "maxImpactPercent": max_impact_percent,
        "variableResults": variable_results,
        "rankingRows": ranking_rows,
        "impactRows": impact_rows,
        "primaryVariableResult": primary_variable_result,
        "pointRows": point_rows,
        "firstPoint": first_point,
        "lastPoint": last_point,
        "pressureTrendText": pressure_trend_text,
        "frictionTrendText": friction_trend_text,
        "flowRegimeChanged": flow_regime_changed,
        "flowRegimeSegments": build_regime_segments(point_rows),
        "minEndStationPressure": min_end_station_pressure,
        "impactLevel": classify_sensitivity_impact_level(sensitivity_coefficient),
        "riskLevel": evaluate_sensitivity_risk_level(
            sensitivity_coefficient,
            max_impact_percent,
            min_end_station_pressure,
            flow_regime_changed,
        ),
        "minPressurePoint": pick_extreme_point(point_rows, "endStationPressure", "min"),
        "maxPressurePoint": pick_extreme_point(point_rows, "endStationPressure", "max"),
        "maxFrictionPoint": pick_extreme_point(point_rows, "frictionHeadLoss", "max"),
        "minFrictionPoint": pick_extreme_point(point_rows, "frictionHeadLoss", "min"),
    }


def extract_primary_variable_type(insights: dict[str, Any]) -> str:
    if not insights:
        return ""
    primary_result = as_record(insights.get("primaryVariableResult"))
    return str(
        primary_result.get("variableType")
        or pick_first_value([as_record(insights.get("inputPayload"))], ["sensitiveVariableType", "sensitivityVariableType"])
        or ""
    ).strip().upper()


def build_sensitivity_mechanism_chain(variable_type: str, variable_name: str) -> str:
    normalized = str(variable_type or "").strip().upper()
    display_name = str(variable_name or "关键变量").strip() or "关键变量"
    mapping = {
        "FLOW_RATE": f"{display_name}变化 → 流速变化 → 雷诺数与摩阻响应变化 → 沿程压降变化 → 末站压力变化",
        "OIL_VISCOSITY": f"{display_name}变化 → 黏性阻力变化 → 雷诺数与摩阻系数变化 → 沿程压降变化 → 末站压力变化",
        "PIPE_DIAMETER": f"{display_name}变化 → 断面流速变化 → 雷诺数与摩阻损失变化 → 压降重分配 → 末站压力变化",
        "PIPE_ROUGHNESS": f"{display_name}变化 → 管壁摩擦条件变化 → 摩阻系数变化 → 沿程压降变化 → 压力裕度变化",
        "OIL_DENSITY": f"{display_name}变化 → 单位体积重力与压头换算变化 → 总压降变化 → 末站压力变化",
        "TEMPERATURE": f"{display_name}变化 → 黏度与流动性变化 → 雷诺数与摩阻损失变化 → 末站压力变化",
        "PUMP_EFFICIENCY": f"{display_name}变化 → 有效扬程利用率变化 → 压力支撑与单位输量能耗变化",
    }
    return mapping.get(
        normalized,
        f"{display_name}变化 → 阻力或压头条件变化 → 沿程压降重分配 → 末站压力与运行边界变化",
    )


def build_sensitivity_mechanism_reason(variable_type: str, variable_name: str) -> str:
    normalized = str(variable_type or "").strip().upper()
    display_name = str(variable_name or "该变量").strip() or "该变量"
    mapping = {
        "FLOW_RATE": f"{display_name}直接决定单位时间内通过管道的介质量，流量抬升后流速与沿程摩阻通常同步放大，因此结果侧会先表现为压降增大和末站压力回落。",
        "OIL_VISCOSITY": f"{display_name}变化会先改变流体黏性阻力，黏度升高时雷诺数更容易下降、摩阻损失更容易抬升，因此压力边界会更快收紧。",
        "PIPE_DIAMETER": f"{display_name}变化会改变过流断面和平均流速，同样输量下断面越小，速度项和沿程损失越容易被放大。",
        "PIPE_ROUGHNESS": f"{display_name}变化虽然不直接增加流量，但会改变壁面摩擦条件，因此阻力项会先于其他指标放大。",
        "OIL_DENSITY": f"{display_name}变化会改变压头换算和压力传递关系，进而影响总压降与末站压力的分配。",
        "TEMPERATURE": f"{display_name}变化通常通过改变原油黏度与流动性来间接影响雷诺数和摩阻损失，因此对压力结果具有传导效应。",
        "PUMP_EFFICIENCY": f"{display_name}变化会改变扬程利用率和单位输量能耗，效率偏低时更容易出现高能耗与边界收紧并存的情况。",
    }
    return mapping.get(
        normalized,
        f"{display_name}会通过阻力变化、压头分配或设备边界占用把扰动逐步传导到末站压力和能耗结果侧。",
    )


def extract_official_research_payload(ctx: dict[str, Any]) -> dict[str, Any]:
    return as_record(ctx.get("official_research"))


def extract_official_topic_payload(ctx: dict[str, Any], topic_key: str) -> dict[str, Any]:
    research = extract_official_research_payload(ctx)
    topics = as_record(research.get("topics"))
    return as_record(topics.get(topic_key))


def extract_official_topic_references(ctx: dict[str, Any], topic_key: str) -> list[dict[str, Any]]:
    topic_payload = extract_official_topic_payload(ctx, topic_key)
    topic_references = as_record_array(topic_payload.get("references"))
    if topic_references:
        return topic_references
    return as_record_array(extract_official_research_payload(ctx).get("references"))


def extract_official_risk_references(ctx: dict[str, Any]) -> list[dict[str, Any]]:
    research = as_record(ctx.get("official_risk_research"))
    return as_record_array(research.get("references"))


def build_official_reference_label(reference: dict[str, Any]) -> str:
    title = str(reference.get("title") or "").strip()
    publisher = str(reference.get("publisher") or reference.get("domain") or "").strip()
    if publisher and title:
        return f"{publisher}发布的《{title}》"
    if title:
        return f"《{title}》"
    if publisher:
        return publisher
    return "官方公开资料"


def build_official_reference_text(references: list[dict[str, Any]], limit: int = 2) -> str:
    labels: list[str] = []
    seen: set[str] = set()
    for item in references:
        label = build_official_reference_label(item)
        if label and label not in seen:
            labels.append(label)
            seen.add(label)
        if len(labels) >= limit:
            break
    if not labels:
        return ""
    if len(labels) == 1:
        return labels[0]
    return "、".join(labels[:-1]) + f"和{labels[-1]}"

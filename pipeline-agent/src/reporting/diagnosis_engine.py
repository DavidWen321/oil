from __future__ import annotations

from statistics import mean, stdev

from src.models.schemas import DynamicReportRequest

from .labeling import optimization_goal_label
from .report_types import (
    AnomalyFinding,
    CauseFinding,
    ConstraintFinding,
    DiagnosisResult,
    MetricSnapshot,
    RecommendationFinding,
    ReportDataBundle,
    TrendFinding,
)


def _to_float(value) -> float | None:
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


def _valid_values(rows: list[dict], key: str) -> list[float]:
    values: list[float] = []
    for row in rows:
        value = _to_float(row.get(key))
        if value is not None:
            values.append(value)
    return values


def _paired_values(rows: list[dict], left_key: str, right_key: str) -> list[tuple[float, float]]:
    pairs: list[tuple[float, float]] = []
    for row in rows:
        left = _to_float(row.get(left_key))
        right = _to_float(row.get(right_key))
        if left is None or right is None:
            continue
        pairs.append((left, right))
    return pairs


def _pearson(pairs: list[tuple[float, float]]) -> float | None:
    if len(pairs) < 5:
        return None
    xs = [item[0] for item in pairs]
    ys = [item[1] for item in pairs]
    mean_x = mean(xs)
    mean_y = mean(ys)
    x_diffs = [x - mean_x for x in xs]
    y_diffs = [y - mean_y for y in ys]
    numerator = sum(x * y for x, y in zip(x_diffs, y_diffs, strict=False))
    denominator_left = sum(x * x for x in x_diffs)
    denominator_right = sum(y * y for y in y_diffs)
    if denominator_left <= 0 or denominator_right <= 0:
        return None
    return numerator / ((denominator_left ** 0.5) * (denominator_right ** 0.5))


class DiagnosisEngine:
    TREND_METRIC_LABELS = {
        "flow_rate": "输量",
        "energy_consumption": "能耗",
        "pump_efficiency": "泵效",
        "end_station_pressure": "末站进站压头",
        "success_rate": "成功率",
        "avg_duration_ms": "平均计算耗时",
    }

    def run(
        self,
        data: ReportDataBundle,
        metrics: MetricSnapshot,
        request: DynamicReportRequest,
    ) -> DiagnosisResult:
        trends = self.analyze_trend(metrics.trend_metrics.get("operation_daily", []))
        anomalies = self.detect_anomalies(metrics, data)
        causes = self.infer_causes(anomalies, metrics, request)
        constraints = self.infer_constraints(metrics, request)
        recommendations = self.generate_recommendations(causes, constraints, request)
        risks = self.build_risks(anomalies, constraints)
        return DiagnosisResult(
            trends=trends,
            anomalies=anomalies,
            causes=causes,
            constraints=constraints,
            recommendations=recommendations,
            risks=risks,
            confidence={
                "trend": 0.82 if metrics.data_quality.get("usable_for_trend") else 0.35,
                "anomaly": 0.8 if anomalies else 0.45,
                "cause": 0.76 if causes else 0.4,
            },
        )

    def analyze_trend(self, rows: list[dict]) -> list[TrendFinding]:
        if len(rows) < 7:
            return []

        findings: list[TrendFinding] = []
        for metric in ("flow_rate", "energy_consumption", "pump_efficiency", "end_station_pressure", "success_rate", "avg_duration_ms"):
            values = _valid_values(rows, metric)
            if len(values) < 5:
                continue

            window = max(2, len(values) // 3)
            first = values[:window]
            middle = values[max(0, (len(values) - window) // 2): max(0, (len(values) - window) // 2) + window]
            last = values[-window:]
            first_avg = mean(first)
            middle_avg = mean(middle) if middle else first_avg
            last_avg = mean(last)
            change_rate = 0.0 if abs(first_avg) < 1e-9 else (last_avg - first_avg) / abs(first_avg)
            volatility = 0.0 if len(values) < 2 or abs(mean(values)) < 1e-9 else stdev(values) / abs(mean(values))

            reversal = (middle_avg - first_avg) * (last_avg - middle_avg) < 0 and abs(change_rate) >= 0.08
            if reversal:
                direction = "reversal"
            elif abs(change_rate) < 0.08 and volatility < 0.12:
                direction = "stable"
            elif volatility >= 0.22:
                direction = "volatile"
            elif change_rate > 0:
                direction = "up"
            else:
                direction = "down"

            metric_label = self.TREND_METRIC_LABELS.get(metric, metric)
            summary_map = {
                "up": f"{metric_label}较前段上升 {change_rate:.1%}",
                "down": f"{metric_label}较前段下降 {abs(change_rate):.1%}",
                "volatile": f"{metric_label}波动率较高，存在明显起伏",
                "stable": f"{metric_label}整体保持稳定",
                "reversal": f"{metric_label}存在趋势反转，前中后段均值方向不一致",
            }
            findings.append(
                TrendFinding(
                    metric=metric,
                    metric_label=metric_label,
                    direction=direction,
                    change_rate=change_rate,
                    volatility=volatility,
                    summary=summary_map[direction],
                    evidence=[
                        f"前段均值 {first_avg:.2f}",
                        f"中段均值 {middle_avg:.2f}",
                        f"后段均值 {last_avg:.2f}",
                        f"波动率 {volatility:.2%}",
                    ],
                )
            )
        return findings

    def detect_anomalies(self, metrics: MetricSnapshot, data: ReportDataBundle) -> list[AnomalyFinding]:
        anomalies: list[AnomalyFinding] = []
        operation_points = metrics.trend_metrics.get("operation_points", [])

        for metric, label in (
            ("flow_rate", "输量"),
            ("energy_consumption", "能耗"),
            ("pump_efficiency", "泵效"),
            ("end_station_pressure", "末站进站压头"),
        ):
            values = _valid_values(operation_points, metric)
            if len(values) < 6:
                continue
            baseline = mean(values)
            deviation = stdev(values) if len(values) > 1 else 0.0
            if deviation <= 0:
                continue
            metric_points = [row for row in operation_points if _to_float(row.get(metric)) is not None]

            for index, row in enumerate(metric_points):
                value = _to_float(row.get(metric))
                if value is None:
                    continue
                z_score = abs((value - baseline) / deviation)
                if z_score >= 2.4:
                    anomalies.append(
                        AnomalyFinding(
                            target=str(row.get("project_name") or "当前分析范围"),
                            target_type="history_series",
                            metric=metric,
                            value=value,
                            baseline=baseline,
                            severity="high" if z_score >= 3 else "medium",
                            summary=f"{label}在 {row.get('timestamp') or row.get('day') or '-'} 出现异常偏离",
                            evidence=[
                                f"当前值 {value:.2f}",
                                f"历史均值 {baseline:.2f}",
                                f"偏离倍数 {z_score:.2f}",
                            ],
                        )
                    )
                    break

                if index > 0:
                    prev_value = _to_float(metric_points[index - 1].get(metric))
                    if prev_value is None or abs(prev_value) < 1e-9:
                        continue
                    change = (value - prev_value) / abs(prev_value)
                    if abs(change) >= 0.35:
                        anomalies.append(
                            AnomalyFinding(
                                target=str(row.get("project_name") or "当前分析范围"),
                                target_type="history_series",
                                metric=f"{metric}_jump",
                                value=value,
                                baseline=prev_value,
                                severity="high" if abs(change) >= 0.5 else "medium",
                                summary=f"{label}在相邻时点出现突变",
                                evidence=[
                                    f"上一时点 {prev_value:.2f}",
                                    f"当前值 {value:.2f}",
                                    f"变化幅度 {change:.1%}",
                                ],
                            )
                        )
                        break

        pump_rows = metrics.object_metrics.get("pump_stations", [])
        eff_values = [row["pump_efficiency"] for row in pump_rows if row.get("pump_efficiency") is not None]
        eff_baseline = mean(eff_values) if eff_values else None
        eff_std = stdev(eff_values) if len(eff_values) > 1 else 0.0

        for row in pump_rows:
            value = row.get("pump_efficiency")
            if value is None or eff_baseline is None:
                continue
            low_by_threshold = value < 0.75
            low_by_distribution = eff_std > 0 and value < eff_baseline - eff_std
            if low_by_threshold or low_by_distribution:
                anomalies.append(
                    AnomalyFinding(
                        target=str(row["name"]),
                        target_type="pump_station",
                        metric="pump_efficiency",
                        value=value,
                        baseline=eff_baseline,
                        severity="high" if value < 0.7 else "medium",
                        summary=f"{row['name']}泵效偏低，低于当前样本基线",
                        evidence=[
                            f"当前值 {value:.2%}",
                            f"样本均值 {eff_baseline:.2%}",
                        ],
                    )
                )

        pipeline_rows = metrics.object_metrics.get("pipelines", [])
        throughput_values = [row["throughput"] for row in pipeline_rows if row.get("throughput") is not None]
        throughput_baseline = mean(throughput_values) if throughput_values else None
        avg_roughness = metrics.overview_metrics.get("avg_roughness")
        for row in pipeline_rows:
            value = row.get("throughput")
            roughness = row.get("roughness")
            if value is None or throughput_baseline is None or roughness is None or avg_roughness is None:
                continue
            if value > throughput_baseline * 1.2 and roughness > avg_roughness * 1.1:
                anomalies.append(
                    AnomalyFinding(
                        target=str(row["name"]),
                        target_type="pipeline",
                        metric="pressure_loss_risk",
                        value=roughness,
                        baseline=avg_roughness,
                        severity="medium",
                        summary=f"{row['name']}在高输量下粗糙度偏高，压损风险上升",
                        evidence=[
                            f"输量 {value:.2f}",
                            f"粗糙度 {roughness:.4f}",
                            f"均值粗糙度 {avg_roughness:.4f}",
                        ],
                    )
                )
        return anomalies

    def infer_causes(
        self,
        anomalies: list[AnomalyFinding],
        metrics: MetricSnapshot,
        request: DynamicReportRequest,
    ) -> list[CauseFinding]:
        causes: list[CauseFinding] = []
        operation_points = metrics.trend_metrics.get("operation_points", [])
        avg_viscosity = metrics.overview_metrics.get("avg_viscosity")
        avg_pump_eff = metrics.overview_metrics.get("avg_pump_efficiency")
        avg_pressure = metrics.overview_metrics.get("avg_end_station_pressure")
        flow_energy_corr = _pearson(_paired_values(operation_points, "flow_rate", "energy_consumption"))
        flow_pressure_corr = _pearson(_paired_values(operation_points, "flow_rate", "end_station_pressure"))

        for item in anomalies:
            primary = "当前异常需要结合更多运行时序做复核"
            secondary: list[str] = []
            evidence = list(item.evidence)
            confidence = 0.58

            if item.metric in {"energy_consumption", "energy_consumption_jump"}:
                if flow_energy_corr is not None and flow_energy_corr >= 0.65:
                    primary = "输量升高与能耗升高呈显著同向变化，异常更可能由高负荷工况触发"
                    evidence.append(f"输量-能耗相关系数 {flow_energy_corr:.2f}")
                    confidence += 0.16
                if avg_pump_eff is not None and avg_pump_eff < 0.78:
                    secondary.append("泵效整体偏低，放大了单位输量能耗")
                    evidence.append(f"平均泵效 {avg_pump_eff:.2%}")
                    confidence += 0.08
                if avg_viscosity is not None and avg_viscosity > 10:
                    secondary.append("油品黏度偏高，增加了输送阻力")
                    evidence.append(f"平均黏度 {avg_viscosity:.2f}")
                    confidence += 0.06

            elif item.metric in {"end_station_pressure", "end_station_pressure_jump", "pressure_loss_risk"}:
                if flow_pressure_corr is not None and flow_pressure_corr <= -0.45:
                    primary = "输量升高与末站压力下降存在负相关，压力异常更可能由高输量工况触发"
                    evidence.append(f"输量-压力相关系数 {flow_pressure_corr:.2f}")
                    confidence += 0.15
                if avg_viscosity is not None and avg_viscosity > 10:
                    secondary.append("高黏度工况增加了沿程压降")
                    evidence.append(f"平均黏度 {avg_viscosity:.2f}")
                    confidence += 0.06
                if not request.allow_pump_adjust:
                    secondary.append("当前禁止调泵，压头补偿手段受限")
                    evidence.append("运行限制：禁止调泵")
                    confidence += 0.08

            elif item.metric in {"pump_efficiency", "pump_efficiency_jump"}:
                primary = "泵效偏低导致单位输量能耗上升，并削弱有效扬程利用率"
                if avg_viscosity is not None and avg_viscosity > 10:
                    secondary.append("高黏度工况放大了低泵效带来的能耗影响")
                    evidence.append(f"平均黏度 {avg_viscosity:.2f}")
                    confidence += 0.06
                if avg_pressure is not None and request.min_pressure is not None and avg_pressure < request.min_pressure:
                    secondary.append("末站压力余量不足，泵效下降更容易触发压力风险")
                    evidence.append(f"平均末站进站压头 {avg_pressure:.2f}")
                    confidence += 0.08

            elif item.metric in {"flow_rate", "flow_rate_jump"}:
                primary = "输量波动本身较大，可能同时拉动能耗和压力结果变化"
                if flow_energy_corr is not None and flow_energy_corr >= 0.65:
                    secondary.append("输量与能耗呈显著正相关")
                    evidence.append(f"输量-能耗相关系数 {flow_energy_corr:.2f}")
                    confidence += 0.12
                if flow_pressure_corr is not None and flow_pressure_corr <= -0.45:
                    secondary.append("输量与末站压力呈显著负相关")
                    evidence.append(f"输量-压力相关系数 {flow_pressure_corr:.2f}")
                    confidence += 0.12

            causes.append(
                CauseFinding(
                    target=item.target,
                    metric=item.metric,
                    primary_cause=primary,
                    secondary_causes=secondary,
                    evidence=evidence,
                    confidence=min(confidence, 0.93),
                )
            )
        return causes

    def infer_constraints(self, metrics: MetricSnapshot, request: DynamicReportRequest) -> list[ConstraintFinding]:
        findings: list[ConstraintFinding] = []
        target_flow_gap = metrics.constraint_metrics.get("target_flow_gap")
        min_pressure_gap = metrics.constraint_metrics.get("min_pressure_gap")
        latest_pressure = metrics.overview_metrics.get("latest_end_station_pressure")
        avg_flow = metrics.overview_metrics.get("avg_flow_rate")

        if request.target_throughput is not None and target_flow_gap is not None and target_flow_gap < 0:
            findings.append(
                ConstraintFinding(
                    name="输量目标缺口",
                    severity="high" if abs(target_flow_gap) > 100 else "medium",
                    summary=f"当前平均输量低于目标输量，缺口约 {abs(target_flow_gap):.2f} m3/h",
                    evidence=[
                        f"目标输量 {request.target_throughput:.2f} m3/h",
                        f"当前平均输量 {avg_flow:.2f} m3/h" if avg_flow is not None else "当前平均输量缺失",
                    ],
                )
            )

        if request.min_pressure is not None and min_pressure_gap is not None and min_pressure_gap < 0:
            findings.append(
                ConstraintFinding(
                    name="压力约束偏紧",
                    severity="high" if abs(min_pressure_gap) > 0.2 else "medium",
                    summary=f"最新末站进站压头低于最小约束，缺口约 {abs(min_pressure_gap):.2f} MPa",
                    evidence=[
                        f"最小约束 {request.min_pressure:.2f} MPa",
                        f"最新末站进站压头 {latest_pressure:.2f} MPa" if latest_pressure is not None else "末站压力样本缺失",
                    ],
                )
            )

        if findings and not request.allow_pump_adjust:
            findings.append(
                ConstraintFinding(
                    name="调泵限制",
                    severity="high",
                    summary="当前禁止调整泵站组合，可行解空间被压缩",
                    evidence=["allow_pump_adjust = false"],
                )
            )
        return findings

    def generate_recommendations(
        self,
        causes: list[CauseFinding],
        constraints: list[ConstraintFinding],
        request: DynamicReportRequest,
    ) -> list[RecommendationFinding]:
        recommendations: list[RecommendationFinding] = []
        goal_label = optimization_goal_label(request.optimization_goal)
        constraint_map = {item.name: item for item in constraints}

        for cause in causes:
            evidence_text = "；".join(cause.evidence[:2]) if cause.evidence else ""
            if cause.metric.startswith("pump_efficiency"):
                action = "优先复核低效率泵组的启停组合，并校核当前工况下的泵效与电机效率"
                if request.optimization_goal == "safety":
                    action = "在保证末站压力余量的前提下，逐步收敛低效率泵组组合"
                recommendations.append(
                    RecommendationFinding(
                        target=cause.target,
                        priority="高",
                        reason=f"{cause.primary_cause}{f'；依据：{evidence_text}' if evidence_text else ''}",
                        action=action,
                        expected=f"降低单位输量能耗，并让运行状态更贴近 {goal_label or '当前优化目标'}",
                    )
                )
            elif "pressure" in cause.metric:
                action = "优先复核高输量工况下的压力余量与压降路径，必要时分时段压缩输量"
                if not request.allow_pump_adjust:
                    action = "先评估适度下调输量是否能恢复压力余量，再决定是否放开调泵限制"
                recommendations.append(
                    RecommendationFinding(
                        target=cause.target,
                        priority="高",
                        reason=f"{cause.primary_cause}{f'；依据：{evidence_text}' if evidence_text else ''}",
                        action=action,
                        expected="缓解压力约束冲突，降低末站压力失守风险",
                    )
                )
            elif cause.metric.startswith("energy"):
                recommendations.append(
                    RecommendationFinding(
                        target=cause.target,
                        priority="中",
                        reason=f"{cause.primary_cause}{f'；依据：{evidence_text}' if evidence_text else ''}",
                        action="围绕高能耗时段复核输量、泵效和电价口径，优先处理高成本工况",
                        expected="压降年能耗和综合电费支出",
                    )
                )

        flow_gap = constraint_map.get("输量目标缺口")
        if flow_gap is not None:
            recommendations.append(
                RecommendationFinding(
                    target="运行目标",
                    priority="高",
                    reason=flow_gap.summary,
                    action="基于真实时序样本重算目标输量可达性，必要时按阶段逼近目标",
                    expected="减少目标设定与实际工况之间的偏差",
                )
            )

        pressure_gap = constraint_map.get("压力约束偏紧")
        if pressure_gap is not None:
            recommendations.append(
                RecommendationFinding(
                    target="压力边界",
                    priority="高" if pressure_gap.severity == "high" else "中",
                    reason=pressure_gap.summary,
                    action="围绕末站进站压头建立阈值监控，并联动复算压降敏感参数",
                    expected="让后续优化在真实压力边界内进行，避免不可行方案反复试算",
                )
            )

        pump_limit = constraint_map.get("调泵限制")
        if pump_limit is not None:
            recommendations.append(
                RecommendationFinding(
                    target="运行限制",
                    priority="中",
                    reason=pump_limit.summary,
                    action="若业务允许，预留可调泵的应急策略；若不允许，则优先从输量和时段分配侧优化",
                    expected="扩大可行解空间，减少约束冲突对结果的放大效应",
                )
            )

        deduplicated: list[RecommendationFinding] = []
        for item in recommendations:
            key = (item.target, item.reason, item.action)
            if any((current.target, current.reason, current.action) == key for current in deduplicated):
                continue
            deduplicated.append(item)
        return deduplicated[:6]

    def build_risks(
        self,
        anomalies: list[AnomalyFinding],
        constraints: list[ConstraintFinding],
    ) -> list[dict]:
        risks: list[dict] = []
        for item in anomalies[:4]:
            risks.append(
                {
                    "target": item.target,
                    "riskType": item.metric,
                    "level": "高" if item.severity == "high" else "中",
                    "reason": item.summary,
                    "suggestion": item.evidence[0] if item.evidence else "建议补充对象级运行样本后复核",
                }
            )
        for item in constraints[:3]:
            risks.append(
                {
                    "target": item.name,
                    "riskType": "constraint",
                    "level": "高" if item.severity == "high" else "中",
                    "reason": item.summary,
                    "suggestion": "建议在正式优化前先消除约束缺口",
                }
            )
        return risks

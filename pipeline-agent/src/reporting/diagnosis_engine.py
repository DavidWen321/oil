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


class DiagnosisEngine:
    def run(
        self,
        data: ReportDataBundle,
        metrics: MetricSnapshot,
        request: DynamicReportRequest,
    ) -> DiagnosisResult:
        trends = self.analyze_trend(metrics.trend_metrics.get("history_daily", []))
        anomalies = self.detect_anomalies(metrics)
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
                "trend": 0.8 if metrics.data_quality.get("usable_for_trend") else 0.35,
                "anomaly": 0.75 if anomalies else 0.45,
                "cause": 0.7 if causes else 0.4,
            },
        )

    def analyze_trend(self, rows: list[dict]) -> list[TrendFinding]:
        if len(rows) < 7:
            return []

        findings: list[TrendFinding] = []
        for metric in ("total", "failed", "avg_duration_ms", "success_rate"):
            values = [float(item.get(metric) or 0.0) for item in rows]
            first = values[: max(2, len(values) // 3)]
            last = values[-max(2, len(values) // 3) :]
            first_avg = mean(first) if first else 0.0
            last_avg = mean(last) if last else 0.0
            change_rate = 0.0 if first_avg == 0 else (last_avg - first_avg) / first_avg
            volatility = 0.0 if len(values) < 2 or mean(values) == 0 else stdev(values) / mean(values)

            if abs(change_rate) < 0.08 and volatility < 0.12:
                direction = "stable"
            elif volatility >= 0.2:
                direction = "volatile"
            elif change_rate > 0:
                direction = "up"
            else:
                direction = "down"

            label_map = {
                "total": "计算量",
                "failed": "失败次数",
                "avg_duration_ms": "平均计算耗时",
                "success_rate": "成功率",
            }
            summary_map = {
                "up": f"{label_map[metric]}较前段上升 {change_rate:.1%}",
                "down": f"{label_map[metric]}较前段下降 {abs(change_rate):.1%}",
                "volatile": f"{label_map[metric]}波动率较高，存在明显起伏",
                "stable": f"{label_map[metric]}整体保持稳定",
            }
            findings.append(
                TrendFinding(
                    metric=metric,
                    direction=direction,
                    change_rate=change_rate,
                    volatility=volatility,
                    summary=summary_map[direction],
                    evidence=[
                        f"前段均值 {first_avg:.2f}",
                        f"后段均值 {last_avg:.2f}",
                        f"波动率 {volatility:.2%}",
                    ],
                )
            )
        return findings

    def detect_anomalies(self, metrics: MetricSnapshot) -> list[AnomalyFinding]:
        anomalies: list[AnomalyFinding] = []
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
                        target=row["name"],
                        target_type="pump_station",
                        metric="pump_efficiency",
                        value=value,
                        baseline=eff_baseline,
                        severity="high" if value < 0.7 else "medium",
                        summary=f"{row['name']} 泵效偏低，低于当前样本基线",
                        evidence=[
                            f"当前值 {value:.2f}",
                            f"样本均值 {eff_baseline:.2f}",
                        ],
                    )
                )

        pipeline_rows = metrics.object_metrics.get("pipelines", [])
        throughput_values = [row["throughput"] for row in pipeline_rows if row.get("throughput") is not None]
        throughput_baseline = mean(throughput_values) if throughput_values else None
        for row in pipeline_rows:
            value = row.get("throughput")
            roughness = row.get("roughness")
            if value is None or throughput_baseline is None:
                continue
            if value > throughput_baseline * 1.2 and roughness is not None and roughness > (metrics.overview_metrics.get("avg_roughness") or roughness) * 1.1:
                anomalies.append(
                    AnomalyFinding(
                        target=row["name"],
                        target_type="pipeline",
                        metric="pressure_loss_risk",
                        value=roughness,
                        baseline=metrics.overview_metrics.get("avg_roughness"),
                        severity="medium",
                        summary=f"{row['name']} 在高输量下粗糙度偏高，压损风险较大",
                        evidence=[
                            f"输量 {value:.2f}",
                            f"粗糙度 {roughness:.4f}",
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
        avg_viscosity = metrics.overview_metrics.get("avg_viscosity")
        min_pressure_gap = metrics.constraint_metrics.get("min_pressure_gap")
        target_flow_gap = metrics.constraint_metrics.get("target_flow_gap")

        for item in anomalies:
            primary = ""
            secondary: list[str] = []
            evidence = list(item.evidence)
            confidence = 0.6

            if item.metric == "pump_efficiency":
                primary = "泵站效率偏低，单位输量能耗和扬程利用率可能失衡"
                if avg_viscosity and avg_viscosity > 10:
                    secondary.append("油品黏度偏高，输送阻力增加")
                    evidence.append(f"平均黏度 {avg_viscosity:.2f}")
                    confidence += 0.08
                if request.target_throughput and target_flow_gap and target_flow_gap > 0:
                    secondary.append("当前目标输量高于样本平均承载能力")
                    evidence.append(f"目标输量缺口 {target_flow_gap:.2f} m3/h")
                    confidence += 0.08
            elif item.metric == "pressure_loss_risk":
                primary = "高输量与较高管道粗糙度叠加，容易放大压损"
                if min_pressure_gap is not None and min_pressure_gap > 0:
                    secondary.append("最低出口压力约束偏严，系统调节余量有限")
                    evidence.append(f"压力约束缺口 {min_pressure_gap:.2f} MPa")
                    confidence += 0.08
                if not request.allow_pump_adjust:
                    secondary.append("不允许调整泵站组合，限制了压力补偿手段")
                    evidence.append("运行限制：禁止调泵")
                    confidence += 0.1
            else:
                primary = "当前样本存在偏离，需要结合更多对象级时序数据复核"

            causes.append(
                CauseFinding(
                    target=item.target,
                    metric=item.metric,
                    primary_cause=primary,
                    secondary_causes=secondary,
                    evidence=evidence,
                    confidence=min(confidence, 0.92),
                )
            )
        return causes

    def infer_constraints(self, metrics: MetricSnapshot, request: DynamicReportRequest) -> list[ConstraintFinding]:
        findings: list[ConstraintFinding] = []
        target_flow_gap = metrics.constraint_metrics.get("target_flow_gap")
        min_pressure_gap = metrics.constraint_metrics.get("min_pressure_gap")

        if target_flow_gap is not None and target_flow_gap > 0:
            findings.append(
                ConstraintFinding(
                    name="输量目标缺口",
                    severity="high" if target_flow_gap > 100 else "medium",
                    summary=f"目标输量高于当前样本总输量，缺口约 {target_flow_gap:.2f} m3/h",
                    evidence=[f"目标输量 {request.target_throughput:.2f} m3/h"],
                )
            )

        if min_pressure_gap is not None and min_pressure_gap > 0:
            findings.append(
                ConstraintFinding(
                    name="压力约束偏紧",
                    severity="high" if min_pressure_gap > 0.2 else "medium",
                    summary=f"最低出口压力要求高于估计压力余量，缺口约 {min_pressure_gap:.2f} MPa",
                    evidence=[f"最低出口压力 {request.min_pressure:.2f} MPa"],
                )
            )

        if findings and not request.allow_pump_adjust:
            findings.append(
                ConstraintFinding(
                    name="调泵限制",
                    severity="high",
                    summary="当前禁止调整泵站组合，可行解空间收缩",
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

        for cause in causes:
            if cause.metric == "pump_efficiency":
                action = "优先复核低效率泵组的启停组合，并核查当前输量下是否存在低负荷运行"
                if request.optimization_goal == "safety":
                    action = "在保证出口压力冗余的前提下，逐步收敛低效率泵组组合"
                recommendations.append(
                    RecommendationFinding(
                        target=cause.target,
                        priority="高",
                        reason=cause.primary_cause,
                        action=action,
                        expected=f"降低单位输量能耗，贴近 {goal_label or '当前优化目标'}",
                    )
                )
            elif cause.metric == "pressure_loss_risk":
                action = "优先校核高输量工况下的粗糙度和压损参数，并评估分段调度或调泵方案"
                if not request.allow_pump_adjust:
                    action = "先评估适度下调输量是否能恢复压力余量，再决定是否放开调泵限制"
                recommendations.append(
                    RecommendationFinding(
                        target=cause.target,
                        priority="高",
                        reason=cause.primary_cause,
                        action=action,
                        expected="降低高输量工况下的压损和约束冲突风险",
                    )
                )

        for item in constraints:
            if item.name == "输量目标缺口":
                recommendations.append(
                    RecommendationFinding(
                        target="运行目标",
                        priority="中",
                        reason=item.summary,
                        action="补充对象级时序样本后重新评估目标输量，必要时分阶段逼近目标",
                        expected="减少目标设定与实际工况的偏差",
                    )
                )
        return recommendations[:6]

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

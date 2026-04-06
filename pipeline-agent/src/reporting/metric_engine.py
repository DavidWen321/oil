from __future__ import annotations

from statistics import mean
from typing import Any

from src.models.schemas import DynamicReportRequest

from .report_types import MetricSnapshot, ReportDataBundle


def _to_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _avg(values: list[float | None]) -> float | None:
    actual = [value for value in values if value is not None]
    if not actual:
        return None
    return mean(actual)


def build_metric_snapshot(data: ReportDataBundle, request: DynamicReportRequest) -> MetricSnapshot:
    throughput_values = [_to_float(item.get("throughput")) for item in data.pipelines]
    length_values = [_to_float(item.get("length")) for item in data.pipelines]
    roughness_values = [_to_float(item.get("roughness")) for item in data.pipelines]
    density_values = [_to_float(item.get("density")) for item in data.oil_properties]
    viscosity_values = [_to_float(item.get("viscosity")) for item in data.oil_properties]
    pump_eff_values = [_to_float(item.get("pump_efficiency")) for item in data.pump_stations]
    electric_eff_values = [_to_float(item.get("electric_efficiency")) for item in data.pump_stations]

    total_throughput = sum(value for value in throughput_values if value is not None)
    avg_pump_eff = _avg(pump_eff_values)
    avg_electric_eff = _avg(electric_eff_values)
    avg_density = _avg(density_values)
    avg_viscosity = _avg(viscosity_values)
    avg_length = _avg(length_values)
    avg_roughness = _avg(roughness_values)

    overview = data.history_overview or {}
    total_count = int(overview.get("totalCount") or 0)
    success_count = int(overview.get("successCount") or 0)
    failed_count = int(overview.get("failedCount") or 0)
    success_rate = _to_float(overview.get("successRate"))

    min_pressure_gap = None
    if request.min_pressure is not None and avg_roughness is not None:
        estimated_pressure_loss = avg_roughness * (avg_length or 1.0)
        min_pressure_gap = request.min_pressure - estimated_pressure_loss

    target_flow_gap = None
    if request.target_throughput is not None:
        target_flow_gap = request.target_throughput - total_throughput

    pump_rows = []
    for row in data.pump_stations:
        pump_rows.append(
            {
                "name": str(row.get("name") or "-"),
                "pump_efficiency": _to_float(row.get("pump_efficiency")),
                "electric_efficiency": _to_float(row.get("electric_efficiency")),
                "displacement": _to_float(row.get("displacement")),
                "come_power": _to_float(row.get("come_power")),
            }
        )

    pipeline_rows = []
    for row in data.pipelines:
        pipeline_rows.append(
            {
                "name": str(row.get("name") or "-"),
                "length": _to_float(row.get("length")),
                "throughput": _to_float(row.get("throughput")),
                "roughness": _to_float(row.get("roughness")),
            }
        )

    return MetricSnapshot(
        overview_metrics={
            "project_count": len(data.projects),
            "pipeline_count": len(data.pipelines),
            "pump_station_count": len(data.pump_stations),
            "oil_property_count": len(data.oil_properties),
            "history_total_count": total_count,
            "history_success_count": success_count,
            "history_failed_count": failed_count,
            "success_rate": success_rate,
            "total_throughput": total_throughput,
            "avg_pipeline_length": avg_length,
            "avg_roughness": avg_roughness,
            "avg_density": avg_density,
            "avg_viscosity": avg_viscosity,
            "avg_pump_efficiency": avg_pump_eff,
            "avg_electric_efficiency": avg_electric_eff,
        },
        trend_metrics={
            "history_daily": data.time_series.get("history_daily", []),
        },
        object_metrics={
            "pump_stations": pump_rows,
            "pipelines": pipeline_rows,
        },
        constraint_metrics={
            "target_throughput": request.target_throughput,
            "min_pressure": request.min_pressure,
            "target_flow_gap": target_flow_gap,
            "min_pressure_gap": min_pressure_gap,
            "allow_pump_adjust": request.allow_pump_adjust,
            "optimization_goal": request.optimization_goal,
        },
        data_quality={
            "has_projects": bool(data.projects),
            "has_pipelines": bool(data.pipelines),
            "has_histories": bool(data.history_records),
            "series_points": len(data.time_series.get("history_daily", [])),
            "usable_for_trend": len(data.time_series.get("history_daily", [])) >= 7,
        },
    )

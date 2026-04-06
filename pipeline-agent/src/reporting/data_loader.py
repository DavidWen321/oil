from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from src.models.schemas import DynamicReportRequest
from src.tools.database_tools import execute_query
from src.tools.java_service_tools import get_java_client
from src.utils import logger

from .report_types import ReportDataBundle


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


def _fetch_recent_histories(limit: int = 120) -> list[dict[str, Any]]:
    client = get_java_client()
    page = client.call_api(
        "/calculation/history/page",
        method="GET",
        params={"pageNum": 1, "pageSize": limit},
    )
    data = page.get("data", {}) if isinstance(page, dict) else {}
    return data.get("list") or []


def _fetch_overview() -> dict[str, Any]:
    client = get_java_client()
    overview = client.call_api("/calculation/statistics/overview", method="GET")
    return overview.get("data", {}) if isinstance(overview, dict) else {}


def _safe_history_data() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    try:
        return _fetch_overview(), _fetch_recent_histories()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load history snapshot for report: %s", exc)
        return {}, []


def _history_series(records: list[dict[str, Any]], days: int) -> dict[str, list[dict[str, Any]]]:
    end = datetime.now()
    start = end - timedelta(days=max(days - 1, 0))
    buckets: dict[str, dict[str, Any]] = {}
    for index in range(days):
        current = start + timedelta(days=index)
        key = current.strftime("%Y-%m-%d")
        buckets[key] = {
            "timestamp": key,
            "total": 0,
            "success": 0,
            "failed": 0,
            "avg_duration_ms": 0.0,
            "durations": [],
        }

    for row in records:
        time_text = str(row.get("createTime") or "")
        day_key = time_text[:10]
        if day_key not in buckets:
            continue
        bucket = buckets[day_key]
        bucket["total"] += 1
        status_name = str(row.get("statusName") or "")
        if "成功" in status_name:
            bucket["success"] += 1
        elif "失败" in status_name:
            bucket["failed"] += 1
        duration = row.get("calcDuration")
        if isinstance(duration, (int, float)):
            bucket["durations"].append(float(duration))

    series_rows: list[dict[str, Any]] = []
    for item in buckets.values():
        durations = item.pop("durations")
        item["avg_duration_ms"] = sum(durations) / len(durations) if durations else 0.0
        success = item["success"]
        total = item["total"]
        item["success_rate"] = (success / total * 100.0) if total else 0.0
        series_rows.append(item)
    return {"history_daily": series_rows}


def _range_days(request: DynamicReportRequest) -> int:
    mapping = {
        "today": 1,
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "year": 30,
        "all": 30,
        "custom": 30,
    }
    return mapping.get(request.range_preset or "", 30)


def load_report_data(request: DynamicReportRequest) -> ReportDataBundle:
    projects = _load_projects(request)
    project_ids = [int(item.get("pro_id")) for item in projects if item.get("pro_id") is not None]
    pipelines = _load_pipelines(project_ids)
    if request.selected_pipeline_id is not None:
        pipelines = [item for item in pipelines if item.get("id") == request.selected_pipeline_id]
    elif request.selected_pipeline_name:
        pipelines = [item for item in pipelines if str(item.get("name") or "").strip() == request.selected_pipeline_name.strip()]

    pump_stations = _filter_by_ids_or_names(
        _load_pump_stations(),
        id_key="id",
        name_key="name",
        ids=request.selected_pump_station_ids,
        names=request.selected_pump_station_names,
    )
    oil_properties = _filter_by_ids_or_names(
        _load_oil_properties(),
        id_key="id",
        name_key="name",
        ids=[request.selected_oil_id] if request.selected_oil_id is not None else [],
        names=[request.selected_oil_name] if request.selected_oil_name else [],
    )

    overview, histories = _safe_history_data()
    filtered_histories = histories
    if request.project_names:
        project_name_set = set(request.project_names)
        filtered_histories = [row for row in filtered_histories if str(row.get("projectName") or "") in project_name_set]

    return ReportDataBundle(
        projects=projects,
        pipelines=pipelines,
        pump_stations=pump_stations,
        oil_properties=oil_properties,
        history_overview=overview,
        history_records=filtered_histories,
        time_series=_history_series(filtered_histories, _range_days(request)),
    )

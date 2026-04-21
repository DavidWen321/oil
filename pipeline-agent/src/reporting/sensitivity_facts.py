from __future__ import annotations

from typing import Any


KNOWN_VARIABLE_NAMES = {"流量", "黏度", "密度", "管径", "粗糙度"}


def _as_records(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def _first_text(record: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = record.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def canonical_sensitivity_variable(value: Any) -> str:
    text = str(value or "").strip()
    upper = text.upper()
    if "FLOW" in upper or "THROUGHPUT" in upper or "流量" in text or "输量" in text:
        return "流量"
    if "VISCOSITY" in upper or "粘" in text or "黏" in text:
        return "黏度"
    if "DENSITY" in upper or "密度" in text:
        return "密度"
    if "DIAMETER" in upper or "管径" in text:
        return "管径"
    if "ROUGH" in upper or "粗糙" in text:
        return "粗糙度"
    return text


def sensitivity_term_aliases(value: Any) -> list[str]:
    variable_name = canonical_sensitivity_variable(value)
    if variable_name == "流量":
        return ["流量", "输量", "flow", "throughput"]
    if variable_name == "黏度":
        return ["黏度", "粘度", "viscosity"]
    if variable_name == "密度":
        return ["密度", "density"]
    if variable_name == "管径":
        return ["管径", "diameter"]
    if variable_name == "粗糙度":
        return ["粗糙度", "roughness"]
    return [variable_name] if variable_name else []


def _sensitivity_score(row: dict[str, Any]) -> float:
    coefficient = abs(_to_float(row.get("sensitivityCoefficient")) or 0.0)
    impact = abs(_to_float(row.get("maxImpactPercent")) or 0.0)
    return max(coefficient, impact)


def _sort_by_sensitivity(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda item: (
            _to_float(item.get("rank")) is None,
            _to_float(item.get("rank")) if _to_float(item.get("rank")) is not None else -_sensitivity_score(item),
        ),
    )


def _same_variable(left: dict[str, Any], right: dict[str, Any]) -> bool:
    left_type = _first_text(left, ("variableType", "code")).upper()
    right_type = _first_text(right, ("variableType", "code")).upper()
    if left_type and right_type and left_type == right_type:
        return True

    left_name = canonical_sensitivity_variable(_first_text(left, ("variableName", "name", "variableType", "code")))
    right_name = canonical_sensitivity_variable(_first_text(right, ("variableName", "name", "variableType", "code")))
    return bool(left_name and right_name and left_name == right_name)


def extract_primary_sensitivity(report_context: dict[str, Any]) -> dict[str, Any]:
    snapshot = report_context.get("sensitivity_snapshot")
    if not isinstance(snapshot, dict):
        return {}

    output_payload = snapshot.get("output")
    output_payload = output_payload if isinstance(output_payload, dict) else {}
    ranking_rows = _sort_by_sensitivity(_as_records(output_payload.get("sensitivityRanking")))
    variable_results = _as_records(output_payload.get("variableResults"))
    source_row = ranking_rows[0] if ranking_rows else (variable_results[0] if variable_results else {})
    if not source_row:
        return {}

    matched_result = next((item for item in variable_results if _same_variable(source_row, item)), {})
    combined = {**matched_result, **source_row}
    raw_name = _first_text(combined, ("variableName", "name", "variableType", "code"))
    raw_type = _first_text(combined, ("variableType", "code"))
    name_from_text = canonical_sensitivity_variable(raw_name)
    name_from_type = canonical_sensitivity_variable(raw_type)
    variable_name = (
        name_from_text
        if name_from_text in KNOWN_VARIABLE_NAMES
        else (name_from_type if name_from_type in KNOWN_VARIABLE_NAMES else name_from_text or name_from_type)
    )
    if not variable_name:
        return {}

    return {
        "variableName": variable_name,
        "rawVariableName": raw_name,
        "variableType": raw_type,
        "rank": _to_float(combined.get("rank")),
        "sensitivityCoefficient": _to_float(combined.get("sensitivityCoefficient")),
        "maxImpactPercent": _to_float(combined.get("maxImpactPercent")),
    }


def extract_sensitivity_terms(report_context: dict[str, Any]) -> list[str]:
    primary = extract_primary_sensitivity(report_context)
    terms: list[str] = []
    seen: set[str] = set()
    for alias in sensitivity_term_aliases(
        primary.get("rawVariableName") or primary.get("variableName") or primary.get("variableType")
    ):
        cleaned = str(alias or "").strip()
        if cleaned.isascii() and terms:
            continue
        if cleaned and cleaned not in seen:
            terms.append(cleaned)
            seen.add(cleaned)
    return terms[:4]

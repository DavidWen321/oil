from __future__ import annotations

from typing import Any


KNOWN_VARIABLE_NAMES = {"流量", "粘度", "密度", "管径", "粗糙度", "温度", "泵效率"}


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
    if "VISCOSITY" in upper or "粘度" in text or "黏度" in text:
        return "粘度"
    if "DENSITY" in upper or "密度" in text:
        return "密度"
    if "DIAMETER" in upper or "管径" in text or "内径" in text:
        return "管径"
    if "ROUGH" in upper or "粗糙" in text:
        return "粗糙度"
    if "TEMPERATURE" in upper or "温度" in text:
        return "温度"
    if "EFFICIENCY" in upper or "泵效" in text or "效率" in text:
        return "泵效率"
    return text


def sensitivity_term_aliases(value: Any) -> list[str]:
    variable_name = canonical_sensitivity_variable(value)
    if variable_name == "流量":
        return ["流量", "输量", "flow", "throughput"]
    if variable_name == "粘度":
        return ["粘度", "黏度", "原油粘度", "viscosity"]
    if variable_name == "密度":
        return ["密度", "原油密度", "density"]
    if variable_name == "管径":
        return ["管径", "内径", "diameter"]
    if variable_name == "粗糙度":
        return ["粗糙度", "管道粗糙度", "内壁状态", "roughness"]
    if variable_name == "温度":
        return ["温度", "输送温度", "粘温", "temperature"]
    if variable_name == "泵效率":
        return ["泵效率", "系统效率", "离心泵系统经济运行", "pump efficiency"]
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
    if left_type and right_type:
        return left_type == right_type

    left_name = canonical_sensitivity_variable(_first_text(left, ("variableName", "name", "variableType", "code")))
    right_name = canonical_sensitivity_variable(_first_text(right, ("variableName", "name", "variableType", "code")))
    return bool(left_name and right_name and left_name == right_name)


def _build_variable_fact(source_row: dict[str, Any], variable_results: list[dict[str, Any]]) -> dict[str, Any]:
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


def extract_ranked_sensitivities(report_context: dict[str, Any], limit: int = 5) -> list[dict[str, Any]]:
    snapshot = report_context.get("sensitivity_snapshot")
    if not isinstance(snapshot, dict):
        return []

    output_payload = snapshot.get("output")
    output_payload = output_payload if isinstance(output_payload, dict) else {}
    ranking_rows = _sort_by_sensitivity(_as_records(output_payload.get("sensitivityRanking")))
    variable_results = _as_records(output_payload.get("variableResults"))

    ordered_rows: list[dict[str, Any]] = []
    if ranking_rows:
        ordered_rows.extend(ranking_rows)
    elif variable_results:
        ordered_rows.extend(
            sorted(variable_results, key=lambda item: _sensitivity_score(item), reverse=True)
        )

    ranked: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for row in ordered_rows:
        fact = _build_variable_fact(row, variable_results)
        if not fact:
            continue
        key = str(fact.get("variableType") or fact.get("variableName") or "").upper()
        if not key or key in seen_keys:
            continue
        ranked.append(fact)
        seen_keys.add(key)
        if len(ranked) >= max(limit, 1):
            break
    return ranked


def extract_primary_sensitivity(report_context: dict[str, Any]) -> dict[str, Any]:
    ranked = extract_ranked_sensitivities(report_context, limit=1)
    return ranked[0] if ranked else {}


def extract_sensitivity_terms(report_context: dict[str, Any], limit: int = 8) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    ranked = extract_ranked_sensitivities(report_context, limit=4)
    for variable in ranked:
        aliases = sensitivity_term_aliases(
            variable.get("rawVariableName") or variable.get("variableName") or variable.get("variableType")
        )
        for alias in aliases:
            cleaned = str(alias or "").strip()
            if cleaned.isascii() and terms:
                continue
            if cleaned and cleaned not in seen:
                terms.append(cleaned)
                seen.add(cleaned)
            if len(terms) >= max(limit, 1):
                return terms
    return terms

from __future__ import annotations

from pathlib import Path
import importlib.util


def _load_sensitivity_helpers_module():
    module_path = Path(__file__).resolve().parents[1] / "src" / "reporting" / "skills" / "sensitivity_helpers.py"
    spec = importlib.util.spec_from_file_location("test_sensitivity_helpers_module", module_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


sensitivity_helpers = _load_sensitivity_helpers_module()


def test_extract_sensitivity_risk_rules_prefers_snapshot_fallback_over_generic_oil_risk():
    context = {
        "project": {"projectNames": ["测试项目"]},
        "sensitivity_snapshot": {
            "projectName": "测试项目",
            "input": {
                "baseParams": {
                    "flowRate": 850,
                    "density": 860,
                    "diameter": 508,
                }
            },
            "output": {
                "baseResult": {"endStationInPressure": 58},
                "sensitivityRanking": [
                    {
                        "rank": 1,
                        "variableType": "FLOW_RATE",
                        "variableName": "流量",
                        "sensitivityCoefficient": 1.75,
                    }
                ],
                "variableResults": [
                    {
                        "variableType": "FLOW_RATE",
                        "variableName": "流量",
                        "sensitivityCoefficient": 1.75,
                        "maxImpactPercent": 37.58,
                        "dataPoints": [
                            {
                                "changePercent": -10,
                                "frictionChangePercent": -18,
                                "endStationPressure": 62,
                                "pressureChangePercent": 3,
                                "flowRegime": "湍流",
                            },
                            {
                                "changePercent": 0,
                                "frictionChangePercent": 0,
                                "endStationPressure": 58,
                                "pressureChangePercent": 0,
                                "flowRegime": "湍流",
                            },
                            {
                                "changePercent": 10,
                                "frictionChangePercent": 28,
                                "endStationPressure": 54,
                                "pressureChangePercent": -6,
                                "flowRegime": "湍流",
                            },
                            {
                                "changePercent": 20,
                                "frictionChangePercent": 48,
                                "endStationPressure": 50,
                                "pressureChangePercent": -11,
                                "flowRegime": "过渡流",
                            },
                        ],
                    }
                ],
            },
        },
        "risk_flags": [
            {
                "targetName": "油品",
                "riskCode": "viscosity_high",
                "level": "高",
                "message": "油品黏度偏高，输送风险上升",
            }
        ],
    }

    rows = sensitivity_helpers.extract_sensitivity_risk_rules(context)

    assert [row["riskCode"] for row in rows] == [
        "energy_consumption_zone",
        "operation_stability_zone",
        "equipment_boundary_zone",
    ]
    assert rows[0]["targetName"] == "流量"
    assert all(row["riskCode"] != "viscosity_high" for row in rows)
    assert rows[0]["source"] == "calculated_rule_fallback"

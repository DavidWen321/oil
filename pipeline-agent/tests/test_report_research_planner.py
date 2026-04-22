from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from types import ModuleType
from typing import Any
import importlib.util
import sys


@dataclass
class DynamicReportRequest:
    selected_project_ids: list[int]
    focuses: list[str] = field(default_factory=list)
    include_summary: bool = True
    include_risk: bool = True
    include_suggestions: bool = True
    include_conclusion: bool = True
    web_research_plan: dict[str, Any] | None = None
    hydraulic_snapshot: dict[str, Any] | None = None
    optimization_snapshot: dict[str, Any] | None = None
    sensitivity_snapshot: dict[str, Any] | None = None


def _load_research_planner_module():
    previous_modules = {
        name: sys.modules.get(name)
        for name in ("src", "src.models", "src.models.schemas")
    }
    fake_src = ModuleType("src")
    fake_models = ModuleType("src.models")
    fake_schemas = ModuleType("src.models.schemas")
    fake_schemas.DynamicReportRequest = DynamicReportRequest
    fake_models.schemas = fake_schemas
    fake_src.models = fake_models

    sys.modules["src"] = fake_src
    sys.modules["src.models"] = fake_models
    sys.modules["src.models.schemas"] = fake_schemas

    module_path = Path(__file__).resolve().parents[1] / "src" / "reporting" / "research_planner.py"
    spec = importlib.util.spec_from_file_location("test_report_research_planner_module", module_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    finally:
        for name, previous in previous_modules.items():
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous
    return module


research_planner = _load_research_planner_module()
build_report_module_evidence = research_planner.build_report_module_evidence
is_web_research_topic_enabled = research_planner.is_web_research_topic_enabled
requested_web_research_topics = research_planner.requested_web_research_topics
resolve_report_research_plan = research_planner.resolve_report_research_plan


def test_sensitivity_research_plan_reuses_existing_snapshot_and_enables_targeted_topics():
    request = DynamicReportRequest(
        selected_project_ids=[1],
        sensitivity_snapshot={"input": {"baseParams": {}}, "output": {"variableResults": []}},
    )

    plan = resolve_report_research_plan(request, "sensitivity")

    assert plan["workflow"] == "local_results_plus_web_evidence"
    assert plan["local_computation"]["mode"] == "reuse_existing_snapshot"
    assert plan["local_computation"]["required"] is False
    assert is_web_research_topic_enabled(plan, "mechanism") is True
    assert is_web_research_topic_enabled(plan, "standards") is True
    assert is_web_research_topic_enabled(plan, "operations") is True
    assert is_web_research_topic_enabled(plan, "risk") is True
    assert requested_web_research_topics(plan, ["mechanism", "standards", "operations", "risk"]) == [
        "mechanism",
        "standards",
        "operations",
        "risk",
    ]
    assert plan["web_research"]["modules"]["coreConclusion"]["topics"] == ["standards", "mechanism", "operations"]
    assert plan["web_research"]["modules"]["mechanismAnalysis"]["topics"] == ["mechanism", "standards"]
    assert plan["web_research"]["modules"]["riskAnalysis"]["topics"] == ["risk", "standards", "operations"]


def test_client_web_research_plan_can_disable_specific_topic():
    request = DynamicReportRequest(
        selected_project_ids=[1],
        sensitivity_snapshot={"input": {"baseParams": {}}, "output": {"variableResults": []}},
        web_research_plan={
            "web_research": {
                "topics": {
                    "operations": {
                        "enabled": False,
                        "reason": "skip operations references",
                    }
                }
            }
        },
    )

    plan = resolve_report_research_plan(request, "sensitivity")

    assert plan["source"] == "client_plan_merged"
    assert is_web_research_topic_enabled(plan, "operations") is False


def test_generic_report_plan_uses_saved_history_when_no_snapshot_exists():
    request = DynamicReportRequest(
        selected_project_ids=[1],
        include_summary=True,
        include_risk=False,
        include_suggestions=False,
        include_conclusion=True,
    )

    plan = resolve_report_research_plan(request, "hydraulic")

    assert plan["local_computation"]["mode"] == "reuse_saved_history"
    assert plan["local_computation"]["completed"] is True
    assert is_web_research_topic_enabled(plan, "general") is True
    assert is_web_research_topic_enabled(plan, "risk") is False


def test_module_evidence_can_differ_by_module():
    request = DynamicReportRequest(
        selected_project_ids=[1],
        sensitivity_snapshot={"input": {"baseParams": {}}, "output": {"variableResults": []}},
    )
    plan = resolve_report_research_plan(request, "sensitivity")

    official_research = {
        "topics": {
            "mechanism": {
                "references": [
                    {"title": "Mechanism Source", "url": "https://example.com/mechanism", "publisher": "A"},
                ]
            },
            "standards": {
                "references": [
                    {"title": "Standard Source", "url": "https://example.com/standard", "publisher": "B"},
                ]
            },
            "operations": {
                "references": [
                    {"title": "Operation Source", "url": "https://example.com/operation", "publisher": "C"},
                ]
            },
        }
    }
    official_risk_research = {
        "topics": {
            "risk": {
                "references": [
                    {"title": "Risk Source", "url": "https://example.com/risk", "publisher": "D"},
                ]
            }
        }
    }

    module_evidence = build_report_module_evidence(plan, official_research, official_risk_research)

    assert [item["title"] for item in module_evidence["coreConclusion"]["references"]] == [
        "Standard Source",
        "Mechanism Source",
        "Operation Source",
    ]
    assert [item["title"] for item in module_evidence["mechanismAnalysis"]["references"]] == [
        "Mechanism Source",
        "Standard Source",
    ]
    assert [item["title"] for item in module_evidence["riskAnalysis"]["references"]] == [
        "Risk Source",
        "Standard Source",
        "Operation Source",
    ]
    assert [item["title"] for item in module_evidence["operationSuggestions"]["references"]] == [
        "Operation Source",
        "Standard Source",
    ]

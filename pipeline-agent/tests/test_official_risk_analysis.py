from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
import importlib.util
import sys


@dataclass
class DynamicReportRequest:
    selected_project_ids: list[int]


@dataclass
class ReportRiskItem:
    target: str
    riskType: str
    level: str
    reason: str
    impact: str | None = None
    suggestion: str = ""
    code: str | None = None
    message: str | None = None
    source: str | None = None
    referenceTitle: str | None = None
    referenceUrl: str | None = None
    referencePublisher: str | None = None


def _load_official_risk_analysis_module():
    module_names = [
        "src",
        "src.models",
        "src.models.schemas",
        "src.reporting",
        "src.reporting.sensitivity_facts",
        "src.reporting.skills",
        "src.reporting.skills.sensitivity_helpers",
    ]
    previous_modules = {name: sys.modules.get(name) for name in module_names}

    fake_src = ModuleType("src")
    fake_src.__path__ = []  # type: ignore[attr-defined]
    fake_models = ModuleType("src.models")
    fake_schemas = ModuleType("src.models.schemas")
    fake_schemas.DynamicReportRequest = DynamicReportRequest
    fake_schemas.ReportRiskItem = ReportRiskItem
    fake_models.schemas = fake_schemas

    fake_reporting = ModuleType("src.reporting")
    fake_reporting.__path__ = []  # type: ignore[attr-defined]
    fake_sensitivity_facts = ModuleType("src.reporting.sensitivity_facts")
    fake_sensitivity_facts.sensitivity_term_aliases = lambda value: ["流量", "输量", "flow"]

    fake_skills = ModuleType("src.reporting.skills")
    fake_skills.__path__ = []  # type: ignore[attr-defined]
    fake_sensitivity_helpers = ModuleType("src.reporting.skills.sensitivity_helpers")
    fake_sensitivity_helpers.extract_sensitivity_insights = lambda ctx: {
        "topVariableName": "流量",
        "sensitivityCoefficient": 1.75,
        "maxImpactPercent": 37.58,
        "minEndStationPressure": 50,
    }
    fake_sensitivity_helpers.extract_sensitivity_risk_rules = lambda ctx: [
        {
            "title": "能耗区判断",
            "targetName": "流量",
            "riskCode": "energy_consumption_zone",
            "level": "风险区",
            "message": "流量扰动后的摩阻增幅已超过阈值。",
            "impact": "单位输量能耗快速放大。",
            "suggestion": "优先控制流量。",
        }
    ]
    fake_sensitivity_helpers.format_number = lambda value, digits=2, suffix="": f"{value}{suffix}" if value is not None else "-"

    sys.modules.update(
        {
            "src": fake_src,
            "src.models": fake_models,
            "src.models.schemas": fake_schemas,
            "src.reporting": fake_reporting,
            "src.reporting.sensitivity_facts": fake_sensitivity_facts,
            "src.reporting.skills": fake_skills,
            "src.reporting.skills.sensitivity_helpers": fake_sensitivity_helpers,
        }
    )

    module_path = Path(__file__).resolve().parents[1] / "src" / "reporting" / "official_risk_analysis.py"
    spec = importlib.util.spec_from_file_location("src.reporting.official_risk_analysis", module_path)
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


official_risk_analysis = _load_official_risk_analysis_module()


def test_build_official_risk_items_uses_human_readable_risk_type_label():
    items = official_risk_analysis.build_official_risk_items(
        DynamicReportRequest(selected_project_ids=[1]),
        {},
        {
            "status": "found",
            "references": [
                {
                    "title": "GB/T 35068-2018 油气管道运行规范",
                    "url": "https://openstd.samr.gov.cn/example-1",
                    "publisher": "国家标准全文公开系统",
                    "query": "流量 风险",
                },
                {
                    "title": "GB/T 34165-2017 油气输送管道系统节能监测规范",
                    "url": "https://openstd.samr.gov.cn/example-2",
                    "publisher": "国家标准全文公开系统",
                    "query": "流量 风险",
                },
            ],
        },
        "sensitivity",
    )

    assert len(items) == 1
    assert items[0].target == "流量"
    assert items[0].riskType == "能耗区判断"
    assert items[0].code == "energy_consumption_zone"


def test_build_official_risk_items_keeps_specific_oil_risk_separate_from_top_flow_variable(monkeypatch):
    monkeypatch.setattr(
        official_risk_analysis,
        "extract_sensitivity_insights",
        lambda ctx: {
            "projectName": "测试项目",
            "topVariableName": "流量",
            "variableTypeText": "流量、油品黏度",
            "sensitivityCoefficient": 1.75,
            "maxImpactPercent": 37.58,
            "minEndStationPressure": 50,
        },
    )
    monkeypatch.setattr(
        official_risk_analysis,
        "extract_sensitivity_risk_rules",
        lambda ctx: [
            {
                "targetName": "油品",
                "riskCode": "viscosity_high",
                "level": "高",
                "message": "油品黏度偏高，输送风险上升",
            }
        ],
    )
    monkeypatch.setattr(
        official_risk_analysis,
        "sensitivity_term_aliases",
        lambda value: {
            "流量": ["流量", "输量", "flow"],
            "流量、油品黏度": ["流量", "输量", "flow"],
            "油品": ["油品", "黏度", "viscosity"],
        }.get(str(value), [str(value)] if value else []),
    )

    items = official_risk_analysis.build_official_risk_items(
        DynamicReportRequest(selected_project_ids=[1]),
        {},
        {
            "status": "found",
            "references": [
                {
                    "title": "GB/T 34165-2017 油气输送管道系统节能监测规范",
                    "url": "https://openstd.samr.gov.cn/flow-ref",
                    "publisher": "国家标准全文公开系统",
                    "query": "流量 风险 输量",
                },
                {
                    "title": "GB/T 31446-2015 原油和燃料油管道输送黏度测量及计算方法",
                    "url": "https://openstd.samr.gov.cn/oil-ref-1",
                    "publisher": "国家标准全文公开系统",
                    "query": "油品 黏度 风险",
                },
                {
                    "title": "SY/T 0520-2008 原油析蜡点、浊点及倾点测定法",
                    "url": "https://openstd.samr.gov.cn/oil-ref-2",
                    "publisher": "国家标准全文公开系统",
                    "query": "油品 黏度 运行",
                },
            ],
        },
        "sensitivity",
    )

    assert len(items) == 1
    assert items[0].target == "油品"
    assert items[0].riskType == "油品黏度风险"
    assert items[0].referenceUrl != "https://openstd.samr.gov.cn/flow-ref"
    assert "当前最敏感变量为流量" not in items[0].reason
    assert "敏感系数为1.75" not in items[0].reason
    assert "油品" in (items[0].impact or "")
    assert "流量" not in (items[0].impact or "")

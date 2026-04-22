from __future__ import annotations

from pathlib import Path
from types import ModuleType, SimpleNamespace
import importlib.util
import sys


def _load_official_research_module():
    module_names = [
        "httpx",
        "src",
        "src.config",
        "src.utils",
        "src.reporting",
        "src.reporting.official_research",
        "src.reporting.research_planner",
        "src.reporting.sensitivity_facts",
        "src.reporting.skills",
        "src.reporting.skills.sensitivity_helpers",
    ]
    previous_modules = {name: sys.modules.get(name) for name in module_names}

    fake_src = ModuleType("src")
    fake_src.__path__ = []  # type: ignore[attr-defined]
    fake_httpx = ModuleType("httpx")
    fake_httpx.Client = object
    fake_config = ModuleType("src.config")
    fake_config.settings = SimpleNamespace(
        REPORT_WEB_RESEARCH_ENABLED=True,
        REPORT_WEB_RESEARCH_TIMEOUT_SECONDS=8,
        REPORT_WEB_RESEARCH_TOP_K=6,
        REPORT_WEB_RESEARCH_ALLOWED_DOMAINS="",
        REPORT_WEB_RESEARCH_PROXY="",
    )
    fake_utils = ModuleType("src.utils")
    fake_utils.logger = SimpleNamespace(debug=lambda *args, **kwargs: None, info=lambda *args, **kwargs: None, warning=lambda *args, **kwargs: None)
    fake_reporting = ModuleType("src.reporting")
    fake_reporting.__path__ = []  # type: ignore[attr-defined]
    fake_research_planner = ModuleType("src.reporting.research_planner")
    fake_research_planner.requested_web_research_topics = lambda plan, keys: keys
    fake_research_planner.resolve_report_research_plan = lambda request, profile_key: {}
    fake_sensitivity_facts = ModuleType("src.reporting.sensitivity_facts")
    fake_sensitivity_facts.extract_ranked_sensitivities = lambda *args, **kwargs: []
    fake_sensitivity_facts.extract_sensitivity_terms = lambda *args, **kwargs: []
    fake_skills = ModuleType("src.reporting.skills")
    fake_skills.__path__ = []  # type: ignore[attr-defined]
    fake_sensitivity_helpers = ModuleType("src.reporting.skills.sensitivity_helpers")
    fake_sensitivity_helpers.extract_sensitivity_risk_rules = lambda *args, **kwargs: []

    sys.modules.update(
        {
            "src": fake_src,
            "httpx": fake_httpx,
            "src.config": fake_config,
            "src.utils": fake_utils,
            "src.reporting": fake_reporting,
            "src.reporting.research_planner": fake_research_planner,
            "src.reporting.sensitivity_facts": fake_sensitivity_facts,
            "src.reporting.skills": fake_skills,
            "src.reporting.skills.sensitivity_helpers": fake_sensitivity_helpers,
        }
    )

    module_path = Path(__file__).resolve().parents[1] / "src" / "reporting" / "official_research.py"
    spec = importlib.util.spec_from_file_location("src.reporting.official_research", module_path)
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


official_research = _load_official_research_module()


def test_curated_pipeline_operation_standard_is_attached_to_standards_topic():
    references = official_research._with_curated_references(
        [],
        queries=["输油管道 运行 标准 规范 官方 公开资料"],
        allowed_domains=("openstd.samr.gov.cn",),
        topic_key="standards",
    )

    assert len(references) == 1
    assert references[0]["title"] == "GB/T 35068-2018 油气管道运行规范"
    assert "油气管道运行与维护规范" in references[0]["aliases"]
    assert references[0]["url"].startswith("https://openstd.samr.gov.cn/")


def test_curated_pipeline_operation_standard_matches_legacy_maintenance_alias():
    references = official_research._with_curated_references(
        [],
        queries=["油气管道运行与维护规范 流量 压力 国家标准"],
        allowed_domains=("openstd.samr.gov.cn",),
    )

    assert [item["title"] for item in references] == ["GB/T 35068-2018 油气管道运行规范"]


def test_risk_topic_can_use_curated_floor_when_search_returns_one_reference():
    references = official_research._with_curated_references(
        [{"title": "Risk Search Source", "url": "https://mem.gov.cn/example", "publisher": "应急管理部"}],
        queries=["输油管道 风险 监测 官方"],
        allowed_domains=("openstd.samr.gov.cn", "mem.gov.cn"),
        topic_key="risk",
        minimum_count=2,
    )

    assert len(references) == 2
    assert references[0]["title"] == "GB/T 35068-2018 油气管道运行规范"
    assert references[1]["title"] == "Risk Search Source"


def test_generic_samr_result_title_is_filtered_as_low_quality():
    assert official_research._is_low_quality_reference(
        "https://std.samr.gov.cn/gb/search/gbDetailed?id=123",
        "国家标准 - 全国标准信息公共服务平台",
        "全国标准信息公共服务平台",
    )


def test_topic_references_are_deduped_by_title_and_publisher():
    references = official_research._flatten_topic_references(
        {
            "risk": {
                "references": [
                    {
                        "title": "国家标准 - 全国标准信息公共服务平台",
                        "url": "https://std.samr.gov.cn/gb/search/gbDetailed?id=1",
                        "publisher": "全国标准信息公共服务平台",
                    },
                    {
                        "title": "国家标准 - 全国标准信息公共服务平台",
                        "url": "https://std.samr.gov.cn/gb/search/gbDetailed?id=2",
                        "publisher": "全国标准信息公共服务平台",
                    },
                ]
            }
        }
    )

    assert len(references) == 1
    assert references[0]["url"].endswith("id=1")

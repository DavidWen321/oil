from __future__ import annotations

from typing import Any


SENSITIVITY_MODULE_SOURCE_STRATEGIES: dict[str, dict[str, Any]] = {
    "summary": {
        "label": "summary",
        "primary_topics": ["standards"],
        "optional_topics": ["mechanism", "operations"],
    },
    "core_conclusions": {
        "label": "core conclusions",
        "primary_topics": ["standards"],
        "optional_topics": ["mechanism"],
    },
    "mechanism_analysis": {
        "label": "mechanism analysis",
        "primary_topics": ["mechanism"],
        "optional_topics": ["standards"],
    },
    "ranking_dashboard": {
        "label": "ranking dashboard",
        "primary_topics": ["mechanism"],
        "optional_topics": ["standards"],
    },
    "trend_chart": {
        "label": "trend chart",
        "primary_topics": ["mechanism"],
        "optional_topics": ["standards"],
    },
    "impact_chart": {
        "label": "impact chart",
        "primary_topics": ["standards"],
        "optional_topics": ["mechanism"],
    },
    "trend_table": {
        "label": "trend table",
        "primary_topics": ["standards", "risk"],
        "optional_topics": ["mechanism"],
    },
    "risk_analysis": {
        "label": "risk analysis",
        "primary_topics": ["risk", "standards"],
        "optional_topics": ["operations"],
    },
    "operation_suggestions": {
        "label": "operation suggestions",
        "primary_topics": ["operations"],
        "optional_topics": ["standards"],
    },
}


def get_sensitivity_module_strategy(module_key: str) -> dict[str, Any]:
    return dict(SENSITIVITY_MODULE_SOURCE_STRATEGIES.get(module_key, {}))


def get_sensitivity_module_topics(module_key: str) -> list[str]:
    strategy = get_sensitivity_module_strategy(module_key)
    ordered_topics: list[str] = []
    seen: set[str] = set()

    for topic in [*(strategy.get("primary_topics") or []), *(strategy.get("optional_topics") or [])]:
        normalized = str(topic or "").strip()
        if normalized and normalized not in seen:
            ordered_topics.append(normalized)
            seen.add(normalized)

    return ordered_topics


def build_sensitivity_module_strategy_prompt_lines() -> list[str]:
    return [
        "对敏感性报告，不同模块按适配原则选用证据源，不要求每个模块都同时使用行业知识和标准/规范/公开资料。",
        "机理分析、仪表盘解读、趋势图解读优先使用 official_research.topics.mechanism；只有在需要校核运行边界或公开口径时，再补充 official_research.topics.standards。",
        "影响幅度解读、数据表解读和核心结论优先使用 official_research.topics.standards；如需补充物理解释，再引用 official_research.topics.mechanism。",
        "运行建议优先使用 official_research.topics.operations；如需约束建议边界或核对公开说法，再补充 official_research.topics.standards。",
        "风险分析优先使用 official_risk_research，其次才补充 official_research.topics.standards；不要把普通机理材料写成风险依据。",
    ]

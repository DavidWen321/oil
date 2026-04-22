from __future__ import annotations

from copy import deepcopy
from typing import Any

from src.models.schemas import DynamicReportRequest

SENSITIVITY_TOPIC_KEYWORDS: dict[str, tuple[str, ...]] = {
    "mechanism": (
        "机理分析",
        "趋势解读",
        "仪表盘",
        "排序",
        "排名",
        "图表",
        "雷诺数",
        "流态",
        "摩阻",
        "压降",
        "压力变化趋势",
        "摩阻损失变化趋势",
        "敏感系数",
        "最大影响幅度",
    ),
    "standards": (
        "核心结论",
        "官方资料依据",
        "标准",
        "规范",
        "公开资料",
        "真实标准",
        "标准名称",
        "结论",
    ),
    "operations": (
        "运行建议",
        "调度",
        "节能",
        "优化建议",
        "预期收益",
        "运行经验",
        "控制范围",
        "调整策略",
        "监测指标",
    ),
    "risk": (
        "风险",
        "风险分析",
        "风险识别",
        "高黏度",
        "输送影响",
        "处理方式",
        "安全区",
        "高能耗区",
        "预警区",
        "高负荷区",
        "风险区",
    ),
}

SENSITIVITY_MODULE_DEFINITIONS: dict[str, dict[str, Any]] = {
    "coreConclusion": {
        "title": "核心结论",
        "topics": ["standards", "mechanism", "operations"],
        "keywords": ("核心结论", "官方资料依据", "结论", "标准", "规范"),
        "purpose": "核对真实标准/规范/公开资料，并把本地计算结果与行业依据融合为最终结论。",
    },
    "mechanismAnalysis": {
        "title": "机理分析",
        "topics": ["mechanism", "standards"],
        "keywords": ("机理分析", "雷诺数", "流态", "摩阻", "压降"),
        "purpose": "补充流量、流速、雷诺数、摩阻、压降之间的物理机制解释。",
    },
    "dashboardInterpretation": {
        "title": "仪表盘解读",
        "topics": ["mechanism", "standards"],
        "keywords": ("仪表盘", "排序", "排名", "敏感系数"),
        "purpose": "解释敏感排序与头部变量为何排在前列，以及背后的工程含义。",
    },
    "trendChartInterpretation": {
        "title": "趋势图解读",
        "topics": ["mechanism", "standards"],
        "keywords": ("趋势解读", "压力变化趋势", "摩阻损失变化趋势", "流态变化"),
        "purpose": "解释趋势图中压力、摩阻与流态变化的原因，以及是否进入主要放大区间。",
    },
    "impactInterpretation": {
        "title": "影响幅度解读",
        "topics": ["standards", "mechanism"],
        "keywords": ("最大影响幅度", "影响幅度"),
        "purpose": "说明影响幅度变化的物理原因，以及工程上意味着哪些边界更需要校核。",
    },
    "tableInterpretation": {
        "title": "数据表解读",
        "topics": ["standards", "risk", "mechanism"],
        "keywords": ("数据表", "区间", "变化比例"),
        "purpose": "解释区间表格中的边界变化、控制带与需要重点复核的区段。",
    },
    "riskAnalysis": {
        "title": "风险分析",
        "topics": ["risk", "standards", "operations"],
        "keywords": ("风险", "风险分析", "风险识别", "高黏度", "输送影响", "处理方式"),
        "purpose": "补充风险资料，对既有风险规则做联网校核，不把本地规则直接包装成结论。",
    },
    "operationSuggestions": {
        "title": "运行建议",
        "topics": ["operations", "standards"],
        "keywords": ("运行建议", "调度", "节能", "优化建议", "预期收益"),
        "purpose": "补充调度策略、运行经验与节能方案，形成可执行的运行建议。",
    },
}

GENERIC_MODULE_DEFINITIONS: dict[str, dict[str, Any]] = {
    "generalConclusion": {
        "title": "核心结论",
        "topics": ["general"],
        "purpose": "补充官方背景和公开资料依据，支撑报告结论。",
    },
    "riskAnalysis": {
        "title": "风险分析",
        "topics": ["risk"],
        "purpose": "补充风险校核依据。",
    },
    "operationSuggestions": {
        "title": "运行建议",
        "topics": ["general"],
        "purpose": "补充运行建议和管理建议的公开资料依据。",
    },
}


def _normalize_focuses(values: list[str] | None) -> list[str]:
    return [str(item).strip() for item in values or [] if str(item).strip()]


def _focus_hits(focuses: list[str], keywords: tuple[str, ...]) -> list[str]:
    hits: list[str] = []
    seen: set[str] = set()
    for focus in focuses:
        if any(keyword in focus for keyword in keywords):
            if focus not in seen:
                hits.append(focus)
                seen.add(focus)
    return hits


def _has_snapshot(snapshot: Any) -> bool:
    return isinstance(snapshot, dict) and bool(snapshot)


def _local_computation_plan(request: DynamicReportRequest, profile_key: str) -> dict[str, Any]:
    snapshot_by_profile = {
        "sensitivity": request.sensitivity_snapshot,
        "optimization": request.optimization_snapshot,
        "hydraulic": request.hydraulic_snapshot,
    }
    active_snapshot = snapshot_by_profile.get(profile_key)

    if _has_snapshot(active_snapshot):
        return {
            "mode": "reuse_existing_snapshot",
            "required": False,
            "completed": True,
            "reason": "本地业务计算已在勾选报告时完成，本次报告阶段直接复用既有计算快照，不重复做业务计算。",
        }

    return {
        "mode": "reuse_saved_history",
        "required": False,
        "completed": True,
        "reason": "报告阶段只加载已保存的历史结果与主数据上下文，不在生成报告时重新执行业务计算。",
    }


def _topic_plan(
    *,
    enabled: bool,
    focus_hits: list[str],
    purpose: str,
    reason: str,
) -> dict[str, Any]:
    return {
        "enabled": enabled,
        "focus_hits": focus_hits,
        "purpose": purpose,
        "reason": reason,
    }


def _module_plan(
    *,
    title: str,
    enabled: bool,
    topics: list[str],
    focus_hits: list[str],
    purpose: str,
    reason: str,
) -> dict[str, Any]:
    return {
        "title": title,
        "enabled": enabled,
        "topics": topics,
        "focus_hits": focus_hits,
        "purpose": purpose,
        "reason": reason,
    }


def _build_sensitivity_modules(
    request: DynamicReportRequest,
    *,
    mechanism_enabled: bool,
    standards_enabled: bool,
    operations_enabled: bool,
    risk_enabled: bool,
) -> dict[str, dict[str, Any]]:
    focuses = _normalize_focuses(request.focuses)
    topic_flags = {
        "mechanism": mechanism_enabled,
        "standards": standards_enabled,
        "operations": operations_enabled,
        "risk": risk_enabled,
    }
    modules: dict[str, dict[str, Any]] = {}

    for module_id, definition in SENSITIVITY_MODULE_DEFINITIONS.items():
        module_topics = [topic for topic in definition["topics"] if topic_flags.get(topic)]
        module_focus_hits = _focus_hits(focuses, tuple(definition.get("keywords") or ()))

        if module_id == "coreConclusion":
            include_flag = bool(request.include_conclusion)
        elif module_id == "riskAnalysis":
            include_flag = bool(request.include_risk)
        elif module_id == "operationSuggestions":
            include_flag = bool(request.include_suggestions)
        else:
            include_flag = bool(request.include_summary)

        enabled = bool(include_flag and module_topics)
        modules[module_id] = _module_plan(
            title=str(definition["title"]),
            enabled=enabled,
            topics=module_topics,
            focus_hits=module_focus_hits,
            purpose=str(definition["purpose"]),
            reason=(
                f"{definition['title']}需要单独绑定对应的公开资料来源。"
                if enabled
                else f"当前请求未启用 {definition['title']} 对应的联网校核。"
            ),
        )

    return modules


def _build_generic_modules(request: DynamicReportRequest) -> dict[str, dict[str, Any]]:
    modules: dict[str, dict[str, Any]] = {}

    modules["generalConclusion"] = _module_plan(
        title=str(GENERIC_MODULE_DEFINITIONS["generalConclusion"]["title"]),
        enabled=bool(request.include_conclusion or request.include_summary),
        topics=["general"] if (request.include_conclusion or request.include_summary) else [],
        focus_hits=[],
        purpose=str(GENERIC_MODULE_DEFINITIONS["generalConclusion"]["purpose"]),
        reason="结论模块需要单独绑定公开资料。" if (request.include_conclusion or request.include_summary) else "当前未启用结论模块联网校核。",
    )
    modules["riskAnalysis"] = _module_plan(
        title=str(GENERIC_MODULE_DEFINITIONS["riskAnalysis"]["title"]),
        enabled=bool(request.include_risk),
        topics=["risk"] if request.include_risk else [],
        focus_hits=[],
        purpose=str(GENERIC_MODULE_DEFINITIONS["riskAnalysis"]["purpose"]),
        reason="风险模块需要单独绑定风险资料。" if request.include_risk else "当前未启用风险模块联网校核。",
    )
    modules["operationSuggestions"] = _module_plan(
        title=str(GENERIC_MODULE_DEFINITIONS["operationSuggestions"]["title"]),
        enabled=bool(request.include_suggestions),
        topics=["general"] if request.include_suggestions else [],
        focus_hits=[],
        purpose=str(GENERIC_MODULE_DEFINITIONS["operationSuggestions"]["purpose"]),
        reason="建议模块需要单独绑定公开资料。" if request.include_suggestions else "当前未启用建议模块联网校核。",
    )
    return modules


def _build_sensitivity_plan(request: DynamicReportRequest) -> dict[str, Any]:
    focuses = _normalize_focuses(request.focuses)

    mechanism_hits = _focus_hits(focuses, SENSITIVITY_TOPIC_KEYWORDS["mechanism"])
    standards_hits = _focus_hits(focuses, SENSITIVITY_TOPIC_KEYWORDS["standards"])
    operations_hits = _focus_hits(focuses, SENSITIVITY_TOPIC_KEYWORDS["operations"])
    risk_hits = _focus_hits(focuses, SENSITIVITY_TOPIC_KEYWORDS["risk"])

    mechanism_enabled = bool(request.include_summary or mechanism_hits)
    standards_enabled = bool(request.include_conclusion or standards_hits)
    operations_enabled = bool(request.include_suggestions or operations_hits)
    risk_enabled = bool(request.include_risk or risk_hits)

    return {
        "workflow": "local_results_plus_web_evidence",
        "source": "server_inferred",
        "local_computation": _local_computation_plan(request, "sensitivity"),
        "web_research": {
            "enabled": True,
            "strategy": "topic_scoped_official_search",
            "guardrails": [
                "先根据报告区块和分析目的决定研究主题，不做无差别全网搜索。",
                "联网结果仅用于行业解释、标准校核和运行建议补充，不替代本地计算事实。",
                "检索结果必须被消化成工程判断，不把网页原文原样堆给用户。",
            ],
            "topics": {
                "mechanism": _topic_plan(
                    enabled=mechanism_enabled,
                    focus_hits=mechanism_hits,
                    purpose="补充流量/流速/雷诺数/摩阻/压降链路的工程解释，以及图表和趋势的物理机制说明。",
                    reason=(
                        "敏感性报告需要解释为什么会这样。"
                        if mechanism_enabled
                        else "当前请求未包含机理解释或趋势图解读相关区块。"
                    ),
                ),
                "standards": _topic_plan(
                    enabled=standards_enabled,
                    focus_hits=standards_hits,
                    purpose="核对真实标准名称、标准表述和公开资料中的行业通用说法，为核心结论提供可追溯依据。",
                    reason=(
                        "核心结论和官方资料依据需要真实标准/规范支撑。"
                        if standards_enabled
                        else "当前请求未要求输出基于标准/规范的核心结论。"
                    ),
                ),
                "operations": _topic_plan(
                    enabled=operations_enabled,
                    focus_hits=operations_hits,
                    purpose="补充行业调度策略、运行经验和节能优化方案，为运行建议和预期收益提供参考。",
                    reason=(
                        "运行建议需要联网补充调度策略和节能经验。"
                        if operations_enabled
                        else "当前请求未包含运行建议或调度优化相关区块。"
                    ),
                ),
                "risk": _topic_plan(
                    enabled=risk_enabled,
                    focus_hits=risk_hits,
                    purpose="补充高黏度油品风险、输送影响和行业处理方式，对既有风险规则做联网校核。",
                    reason=(
                        "风险分析需要独立的风险资料校核，不能只复述本地规则。"
                        if risk_enabled
                        else "当前请求未包含风险分析区块。"
                    ),
                ),
            },
            "modules": _build_sensitivity_modules(
                request,
                mechanism_enabled=mechanism_enabled,
                standards_enabled=standards_enabled,
                operations_enabled=operations_enabled,
                risk_enabled=risk_enabled,
            ),
        },
    }


def _build_generic_plan(request: DynamicReportRequest, profile_key: str) -> dict[str, Any]:
    general_enabled = bool(request.include_summary or request.include_conclusion or request.include_suggestions)
    risk_enabled = bool(request.include_risk)
    return {
        "workflow": "local_results_plus_web_evidence",
        "source": "server_inferred",
        "local_computation": _local_computation_plan(request, profile_key),
        "web_research": {
            "enabled": general_enabled or risk_enabled,
            "strategy": "topic_scoped_official_search",
            "guardrails": [
                "先用本地结果确定结论框架，再做针对性的官方资料校核。",
                "优先采信官方、标准和公开资料，不做无差别结果堆砌。",
            ],
            "topics": {
                "general": {
                    "enabled": general_enabled,
                    "reason": "报告摘要、结论和建议需要官方资料补充背景与依据。"
                    if general_enabled
                    else "当前请求未要求常规联网补充。",
                },
                "risk": {
                    "enabled": risk_enabled,
                    "reason": "风险区块需要联网校核。"
                    if risk_enabled
                    else "当前请求未包含风险分析区块。",
                },
            },
            "modules": _build_generic_modules(request),
        },
    }


def _merge_plan(base_plan: dict[str, Any], client_plan: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(base_plan)
    merged["source"] = "client_plan_merged"

    if isinstance(client_plan.get("workflow"), str) and client_plan["workflow"].strip():
        merged["workflow"] = client_plan["workflow"].strip()

    client_local = client_plan.get("local_computation")
    if isinstance(client_local, dict):
        local_payload = merged.setdefault("local_computation", {})
        for key in ("mode", "required", "completed", "reason"):
            if key in client_local:
                local_payload[key] = client_local[key]

    client_web = client_plan.get("web_research")
    if isinstance(client_web, dict):
        web_payload = merged.setdefault("web_research", {})
        for key in ("enabled", "strategy"):
            if key in client_web:
                web_payload[key] = client_web[key]
        if isinstance(client_web.get("guardrails"), list):
            web_payload["guardrails"] = [
                str(item).strip() for item in client_web["guardrails"] if str(item).strip()
            ]

        client_topics = client_web.get("topics")
        if isinstance(client_topics, dict):
            topic_payload = web_payload.setdefault("topics", {})
            for topic_key, topic_value in client_topics.items():
                if not isinstance(topic_value, dict):
                    continue
                merged_topic = topic_payload.setdefault(str(topic_key), {})
                for key in ("enabled", "purpose", "reason"):
                    if key in topic_value:
                        merged_topic[key] = topic_value[key]
                if isinstance(topic_value.get("focus_hits"), list):
                    merged_topic["focus_hits"] = [
                        str(item).strip() for item in topic_value["focus_hits"] if str(item).strip()
                    ]

        client_modules = client_web.get("modules")
        if isinstance(client_modules, dict):
            module_payload = web_payload.setdefault("modules", {})
            for module_key, module_value in client_modules.items():
                if not isinstance(module_value, dict):
                    continue
                merged_module = module_payload.setdefault(str(module_key), {})
                for key in ("title", "enabled", "purpose", "reason"):
                    if key in module_value:
                        merged_module[key] = module_value[key]
                if isinstance(module_value.get("topics"), list):
                    merged_module["topics"] = [
                        str(item).strip() for item in module_value["topics"] if str(item).strip()
                    ]
                if isinstance(module_value.get("focus_hits"), list):
                    merged_module["focus_hits"] = [
                        str(item).strip() for item in module_value["focus_hits"] if str(item).strip()
                    ]

    return merged


def resolve_report_research_plan(
    request: DynamicReportRequest,
    profile_key: str,
) -> dict[str, Any]:
    if profile_key == "sensitivity":
        base_plan = _build_sensitivity_plan(request)
    else:
        base_plan = _build_generic_plan(request, profile_key)

    client_plan = request.web_research_plan if isinstance(request.web_research_plan, dict) else None
    if not client_plan:
        return base_plan
    return _merge_plan(base_plan, client_plan)


def is_web_research_topic_enabled(plan: dict[str, Any], topic_key: str) -> bool:
    web_payload = plan.get("web_research") if isinstance(plan, dict) else None
    if not isinstance(web_payload, dict):
        return False
    topics = web_payload.get("topics")
    if not isinstance(topics, dict):
        return False
    topic_payload = topics.get(topic_key)
    if not isinstance(topic_payload, dict):
        return False
    return bool(topic_payload.get("enabled"))


def requested_web_research_topics(plan: dict[str, Any], topic_keys: list[str]) -> list[str]:
    return [topic_key for topic_key in topic_keys if is_web_research_topic_enabled(plan, topic_key)]


def build_report_module_evidence(
    plan: dict[str, Any],
    official_research: dict[str, Any],
    official_risk_research: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    web_payload = plan.get("web_research") if isinstance(plan, dict) else None
    if not isinstance(web_payload, dict):
        return {}

    modules = web_payload.get("modules")
    if not isinstance(modules, dict):
        return {}

    topic_reference_map: dict[str, list[dict[str, Any]]] = {}
    for payload in (official_research, official_risk_research):
        if not isinstance(payload, dict):
            continue
        topic_payloads = payload.get("topics")
        if not isinstance(topic_payloads, dict):
            continue
        for topic_key, topic_payload in topic_payloads.items():
            if not isinstance(topic_payload, dict):
                continue
            topic_reference_map[str(topic_key)] = [
                item for item in topic_payload.get("references") or [] if isinstance(item, dict)
            ]

    module_evidence: dict[str, dict[str, Any]] = {}
    for module_id, module_payload in modules.items():
        if not isinstance(module_payload, dict):
            continue

        enabled = bool(module_payload.get("enabled"))
        topics = [str(item).strip() for item in module_payload.get("topics") or [] if str(item).strip()]
        references: list[dict[str, Any]] = []
        seen_urls: set[str] = set()
        for topic_key in topics:
            for item in topic_reference_map.get(topic_key, []):
                url = str(item.get("url") or "").strip()
                if not url or url in seen_urls:
                    continue
                references.append(item)
                seen_urls.add(url)

        module_evidence[str(module_id)] = {
            "title": str(module_payload.get("title") or module_id),
            "enabled": enabled,
            "topics": topics,
            "focus_hits": [str(item).strip() for item in module_payload.get("focus_hits") or [] if str(item).strip()],
            "purpose": str(module_payload.get("purpose") or "").strip(),
            "reason": str(module_payload.get("reason") or "").strip(),
            "status": "not_requested" if not enabled else ("found" if references else "not_found"),
            "references": references,
        }

    return module_evidence

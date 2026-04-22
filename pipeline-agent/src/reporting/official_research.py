from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from bs4 import BeautifulSoup
import httpx

from src.config import settings
from src.utils import logger

from .research_planner import requested_web_research_topics, resolve_report_research_plan
from .sensitivity_facts import extract_ranked_sensitivities, extract_sensitivity_terms
from .skills.sensitivity_helpers import extract_sensitivity_risk_rules


DEFAULT_OFFICIAL_DOMAINS = (
    "std.samr.gov.cn",
    "openstd.samr.gov.cn",
    "samr.gov.cn",
    "www.samr.gov.cn",
    "gov.cn",
    "www.gov.cn",
    "nea.gov.cn",
    "www.nea.gov.cn",
    "zfxxgk.nea.gov.cn",
    "ndrc.gov.cn",
    "www.ndrc.gov.cn",
    "mem.gov.cn",
    "www.mem.gov.cn",
    "mee.gov.cn",
    "www.mee.gov.cn",
    "mot.gov.cn",
    "www.mot.gov.cn",
    "mnr.gov.cn",
    "www.mnr.gov.cn",
)

PUBLISHER_LABELS = {
    "std.samr.gov.cn": "全国标准信息公共服务平台",
    "openstd.samr.gov.cn": "国家标准全文公开系统",
    "samr.gov.cn": "国家市场监督管理总局",
    "www.samr.gov.cn": "国家市场监督管理总局",
    "gov.cn": "中国政府网",
    "www.gov.cn": "中国政府网",
    "nea.gov.cn": "国家能源局",
    "www.nea.gov.cn": "国家能源局",
    "zfxxgk.nea.gov.cn": "国家能源局政府信息公开",
    "ndrc.gov.cn": "国家发展和改革委员会",
    "www.ndrc.gov.cn": "国家发展和改革委员会",
    "mem.gov.cn": "应急管理部",
    "www.mem.gov.cn": "应急管理部",
    "mee.gov.cn": "生态环境部",
    "www.mee.gov.cn": "生态环境部",
    "mot.gov.cn": "交通运输部",
    "www.mot.gov.cn": "交通运输部",
    "mnr.gov.cn": "自然资源部",
    "www.mnr.gov.cn": "自然资源部",
}

SENSITIVITY_VARIABLE_QUERIES = {
    "流量": [
        "GB/T 35068-2018 油气管道运行规范 流量 压力 国家标准",
        "输油管道 工艺控制参数 流量 标准",
        "油气输送管道系统节能监测规范 输量 标准",
    ],
    "粘度": [
        "原油粘温曲线 测定 标准",
        "原油管道加热处理输送工艺规程 粘度 温度 标准",
        "输油管道 原油粘度 官方 标准",
    ],
    "密度": [
        "石油液体密度测定法 国家标准",
        "输油管道 原油密度 官方 标准",
        "油气输送管道系统节能监测规范 密度 标准",
    ],
    "管径": [
        "石油天然气工业 管线输送系统用钢管 国家标准",
        "输油管道 工程设计 管径 标准",
        "输油管道 工艺控制参数 管径 官方 标准",
    ],
    "粗糙度": [
        "钢质管道内腐蚀控制规范 国家标准",
        "油气管道 内腐蚀 控制 规范 官方",
        "输油管道 粗糙度 内壁状态 标准",
    ],
    "温度": [
        "原油管道加热处理输送工艺规程 标准",
        "原油粘温曲线 测定 标准",
        "输油管道 输送温度 官方 标准",
    ],
    "泵效率": [
        "离心泵系统经济运行 通则 国家标准",
        "泵系统 优化 设计 国家标准",
        "离心泵 效率 国家标准",
    ],
}

SENSITIVITY_RISK_CODE_QUERIES = {
    "energy_consumption_zone": [
        "油气输送管道系统节能监测规范 能耗 风险 国家标准",
        "输油管道 节能 运行控制 官方 标准",
    ],
    "operation_stability_zone": [
        "GB/T 35068-2018 油气管道运行规范 压力 波动 运行风险 国家标准",
        "输油管道 压力 控制 运行维护 官方 标准",
    ],
    "equipment_boundary_zone": [
        "GB/T 35068-2018 油气管道运行规范 设备 运行边界 官方 标准",
        "离心泵系统经济运行 高负荷 风险 国家标准",
    ],
}

OFFICIAL_SITE_QUERY_TAIL_TERMS = (
    "官方",
    "国家标准",
    "标准",
    "风险",
    "监测",
    "安全",
    "运行",
    "维护",
)

SENSITIVITY_RESEARCH_TOPIC_LABELS = {
    "mechanism": "工程机理与行业解释",
    "standards": "标准规范与公开资料",
    "operations": "运行调度与节能建议",
}

RISK_RESEARCH_TOPIC_LABELS = {
    "risk": "风险校核与公开资料",
}

CURATED_OFFICIAL_REFERENCES: tuple[dict[str, Any], ...] = (
    {
        "title": "GB/T 35068-2018 油气管道运行规范",
        "aliases": ["油气管道运行与维护规范", "Operation and maintenance specification for oil and gas pipeline"],
        "url": "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=6B0898A7602D53B32EC80967E4064D3C",
        "domain": "openstd.samr.gov.cn",
        "publisher": "国家标准全文公开系统",
        "snippet": (
            "国家标准《油气管道运行规范》（GB/T 35068-2018），英文名为 Operation and maintenance "
            "specification for oil and gas pipeline，规定油气管道投产、运行、维护和修理的技术与管理要求。"
        ),
        "query": "GB/T 35068-2018 油气管道运行规范 国家标准",
        "match_terms": ["油气管道运行", "管道运行", "运行标准", "运行维护", "压力控制", "运行风险", "监测"],
    },
    {
        "title": "GB/T 34165-2017 油气输送管道系统节能监测规范",
        "aliases": [
            "Monitoring and testing code for energy conservation of oil and gas transportation pipeline system",
            "油气管道节能监测规范",
        ],
        "url": "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=8AC3CCF067F9C5129C590B1EEA543DBA",
        "domain": "openstd.samr.gov.cn",
        "publisher": "国家标准全文公开系统",
        "snippet": (
            "国家标准《油气输送管道系统节能监测规范》（GB/T 34165-2017）用于油气输送管道系统节能监测，"
            "可作为能耗、输量和运行控制类风险校核的官方依据。"
        ),
        "query": "GB/T 34165-2017 油气输送管道系统节能监测规范 国家标准",
        "match_terms": ["节能监测", "能耗", "输量", "油气输送管道系统", "运行控制"],
    },
    {
        "title": "GB 32167-2015 油气输送管道完整性管理规范",
        "aliases": ["Oil and gas pipeline integrity management specification", "管道完整性管理规范"],
        "url": "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=ABCEE62F82A7FDBB99F2E5B5228CA040",
        "domain": "openstd.samr.gov.cn",
        "publisher": "国家标准全文公开系统",
        "snippet": (
            "国家标准《油气输送管道完整性管理规范》（GB 32167-2015）面向油气输送管道完整性管理，"
            "可作为风险识别、运行维护和监测复核的官方依据。"
        ),
        "query": "GB 32167-2015 油气输送管道完整性管理规范 国家标准",
        "match_terms": ["完整性管理", "风险识别", "运行维护", "监测", "安全"],
    },
    {
        "title": "GB/T 42033-2022 油气管道完整性评价技术规范",
        "aliases": ["Specification for oil and gas pipeline integrity assessment", "油气管道完整性评价"],
        "url": "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=EE03AA0C294D67895796C8A8F80DA705",
        "domain": "openstd.samr.gov.cn",
        "publisher": "国家标准全文公开系统",
        "snippet": (
            "国家标准《油气管道完整性评价技术规范》（GB/T 42033-2022）用于油气管道完整性评价，"
            "可支撑运行边界、完整性和风险状态复核。"
        ),
        "query": "GB/T 42033-2022 油气管道完整性评价技术规范 国家标准",
        "match_terms": ["完整性评价", "风险状态", "运行边界", "油气管道"],
    },
    {
        "title": "GB/T 13469-2021 离心泵、混流泵与轴流泵系统经济运行",
        "aliases": ["Economical operation for centrifugal, mixed flow and axial flow pump systems", "泵系统经济运行"],
        "url": "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=C301BDCFD7BEB8B250165DEFA4678469",
        "domain": "openstd.samr.gov.cn",
        "publisher": "国家标准全文公开系统",
        "snippet": (
            "国家标准《离心泵、混流泵与轴流泵系统经济运行》（GB/T 13469-2021）用于泵系统经济运行，"
            "可作为泵效率、设备负荷和高能耗区校核的官方依据。"
        ),
        "query": "GB/T 13469-2021 离心泵 混流泵 轴流泵 系统经济运行 国家标准",
        "match_terms": ["泵", "泵效率", "经济运行", "设备边界", "高负荷", "能耗"],
    },
    {
        "title": "GB/T 16666-2012 泵类液体输送系统节能监测",
        "aliases": ["Monitoring and testing for energy saving of motor-pump liquid transport system", "泵类输送系统节能监测"],
        "url": "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=F18298C31DBA247CAA8312BB499FEC5A",
        "domain": "openstd.samr.gov.cn",
        "publisher": "国家标准全文公开系统",
        "snippet": (
            "国家标准《泵类液体输送系统节能监测》（GB/T 16666-2012）用于泵类液体输送系统节能监测，"
            "可补充泵站能耗、效率和运行监测类风险依据。"
        ),
        "query": "GB/T 16666-2012 泵类液体输送系统节能监测 国家标准",
        "match_terms": ["泵类", "液体输送", "节能监测", "效率", "能耗"],
    },
    {
        "title": "GB/T 38076-2019 输油管道环境风险评估与防控技术指南",
        "aliases": ["Technical guideline on environmental risk assessment and prevention for oil pipelines", "输油管道风险评估防控"],
        "url": "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=36DDE87F638E91D8BAEA9FB838A58BFD",
        "domain": "openstd.samr.gov.cn",
        "publisher": "国家标准全文公开系统",
        "snippet": (
            "国家标准《输油管道环境风险评估与防控技术指南》（GB/T 38076-2019）面向输油管道环境风险评估与防控，"
            "可作为风险识别和防控建议的官方参考。"
        ),
        "query": "GB/T 38076-2019 输油管道环境风险评估与防控技术指南 国家标准",
        "match_terms": ["输油管道", "环境风险", "风险评估", "防控", "风险识别"],
    },
)


def _clean_text(value: Any, max_length: int = 900) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(text) <= max_length:
        return text
    return f"{text[:max_length].rstrip()}..."


def _parse_csv(value: str | None, fallback: tuple[str, ...]) -> tuple[str, ...]:
    parts = [item.strip().lower() for item in str(value or "").split(",") if item.strip()]
    return tuple(parts or fallback)


def _host_matches(host: str, domain: str) -> bool:
    host = host.lower()
    domain = domain.lower()
    return host == domain or host.endswith(f".{domain}")


def _is_allowed_official_url(url: str, allowed_domains: tuple[str, ...]) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.hostname or "").lower()
    return any(_host_matches(host, domain) for domain in allowed_domains)


def _publisher_for(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    for domain, label in PUBLISHER_LABELS.items():
        if _host_matches(host, domain):
            return label
    return host or "官方来源"


def _normalize_reference_lookup_text(value: Any) -> str:
    return re.sub(r"[《》〈〉【】〔〕（）()「」『』、，。；：\s/_\\\-—–]", "", str(value or "")).strip().lower()


def _canonical_reference_url(value: Any) -> str:
    return str(value or "").strip().split("#", maxsplit=1)[0]


def _is_generic_official_page_title(value: Any) -> bool:
    normalized = _normalize_reference_lookup_text(value)
    if not normalized:
        return False
    exact_generic_titles = {
        "国家标准全国标准信息公共服务平台",
        "国家标准计划全国标准信息公共服务平台",
        "全国标准信息公共服务平台",
        "国家标准全文公开系统",
        "首页",
        "目录查询",
        "公告查询",
        "标准公告",
    }
    return normalized in exact_generic_titles


def _reference_title_key(reference: dict[str, Any]) -> str:
    title = _normalize_reference_lookup_text(reference.get("title"))
    if not title:
        return ""
    publisher = _normalize_reference_lookup_text(reference.get("publisher") or reference.get("domain"))
    return f"{title}|{publisher}"


def _reference_identity_keys(reference: dict[str, Any]) -> set[str]:
    keys: set[str] = set()
    url = _canonical_reference_url(reference.get("url"))
    if url:
        keys.add(f"url:{url}")
    title_key = _reference_title_key(reference)
    if title_key:
        keys.add(f"title:{title_key}")
    return keys


def _curated_reference_matches_queries(reference: dict[str, Any], queries: list[str]) -> bool:
    haystack = _normalize_reference_lookup_text(" ".join(queries))
    if not haystack:
        return False

    candidates = [
        reference.get("title"),
        reference.get("query"),
        *(reference.get("aliases") or []),
    ]
    match_terms = [_normalize_reference_lookup_text(item) for item in reference.get("match_terms") or []]
    direct_match = any(
        candidate_text and (
            candidate_text in haystack
            or haystack in candidate_text
        )
        for candidate_text in (_normalize_reference_lookup_text(item) for item in candidates)
    )
    term_hits = [term for term in match_terms if term and term in haystack]
    return direct_match or len(term_hits) >= 2


def _public_reference_payload(reference: dict[str, Any], *, query: str | None = None) -> dict[str, str | list[str]]:
    return {
        "title": str(reference.get("title") or "").strip(),
        "aliases": [str(item).strip() for item in reference.get("aliases") or [] if str(item).strip()],
        "url": str(reference.get("url") or "").strip(),
        "domain": str(reference.get("domain") or urlparse(str(reference.get("url") or "")).hostname or "").strip(),
        "publisher": str(reference.get("publisher") or _publisher_for(str(reference.get("url") or ""))).strip(),
        "snippet": str(reference.get("snippet") or "").strip(),
        "query": str(query or reference.get("query") or "").strip(),
    }


def _with_curated_references(
    references: list[dict[str, Any]],
    *,
    queries: list[str],
    allowed_domains: tuple[str, ...],
    topic_key: str | None = None,
    minimum_count: int | None = None,
) -> list[dict[str, Any]]:
    if minimum_count is not None and len(references) >= minimum_count:
        return references

    merged: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for item in references:
        if isinstance(item, dict):
            seen_keys.update(_reference_identity_keys(item))

    for reference in CURATED_OFFICIAL_REFERENCES:
        url = _canonical_reference_url(reference.get("url"))
        payload = _public_reference_payload(reference, query=queries[0] if queries else None)
        payload_keys = _reference_identity_keys(payload)
        if not url or payload_keys & seen_keys or not _is_allowed_official_url(url, allowed_domains):
            continue
        is_floor_fallback = minimum_count is not None and topic_key in {"standards", "risk"}
        if not is_floor_fallback and not _curated_reference_matches_queries(reference, queries):
            continue
        merged.append(payload)
        seen_keys.update(payload_keys)
        if minimum_count is not None and len(merged) + len(references) >= minimum_count:
            break

    merged.extend(references)
    return merged


def _resolve_search_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    parsed = urlparse(raw_url)
    query = parse_qs(parsed.query)
    for key in ("uddg", "url", "u"):
        value = query.get(key)
        if value and value[0]:
            return unquote(value[0])
    return raw_url


def _search_duckduckgo(client: httpx.Client, query: str) -> list[dict[str, str]]:
    response = client.get("https://duckduckgo.com/html/", params={"q": query, "kl": "cn-zh"})
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    results: list[dict[str, str]] = []

    for item in soup.select(".result"):
        link = item.select_one("a.result__a") or item.select_one("a")
        if not link:
            continue
        href = _resolve_search_url(str(link.get("href") or ""))
        title = _clean_text(link.get_text(" ", strip=True), max_length=160)
        snippet_el = item.select_one(".result__snippet")
        snippet = _clean_text(snippet_el.get_text(" ", strip=True) if snippet_el else "", max_length=260)
        if href and title:
            results.append({"title": title, "url": href, "snippet": snippet})
    return results


def _search_bing(client: httpx.Client, query: str) -> list[dict[str, str]]:
    response = client.get("https://cn.bing.com/search", params={"q": query, "setlang": "zh-Hans"})
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    results: list[dict[str, str]] = []

    for item in soup.select("li.b_algo"):
        link = item.select_one("h2 a") or item.select_one("a")
        if not link:
            continue
        href = str(link.get("href") or "").strip()
        title = _clean_text(link.get_text(" ", strip=True), max_length=160)
        snippet_el = item.select_one(".b_caption p") or item.select_one("p")
        snippet = _clean_text(snippet_el.get_text(" ", strip=True) if snippet_el else "", max_length=260)
        if href and title:
            results.append({"title": title, "url": href, "snippet": snippet})
    return results


def _build_std_samr_detail_url(pid: str, tid: str) -> str:
    normalized_tid = str(tid or "").strip().upper()
    normalized_pid = str(pid or "").strip()
    if not normalized_pid:
        return ""
    if normalized_tid == "BV_HB":
        return f"https://std.samr.gov.cn/hb/search/stdHBDetailed?id={normalized_pid}"
    if normalized_tid == "BV_DB":
        return f"https://std.samr.gov.cn/db/search/stdDBDetailed?id={normalized_pid}"
    return f"https://std.samr.gov.cn/gb/search/gbDetailed?id={normalized_pid}"


def _build_official_site_query_variants(query: str) -> list[str]:
    raw_text = _clean_text(query, max_length=200)
    if not raw_text:
        return []

    tokens = [token for token in raw_text.split(" ") if token and not token.lower().startswith("site:")]
    if not tokens:
        return []

    variants: list[str] = []
    seen: set[str] = set()

    def _push(value: str) -> None:
        cleaned = _clean_text(value, max_length=120)
        if cleaned and cleaned not in seen:
            variants.append(cleaned)
            seen.add(cleaned)

    _push(" ".join(tokens))

    trimmed_tokens = list(tokens)
    while trimmed_tokens and trimmed_tokens[-1] in OFFICIAL_SITE_QUERY_TAIL_TERMS:
        trimmed_tokens.pop()
        _push(" ".join(trimmed_tokens))

    if len(trimmed_tokens) >= 3:
        _push(" ".join(trimmed_tokens[:3]))
    if len(trimmed_tokens) >= 2:
        _push(" ".join(trimmed_tokens[:2]))

    return variants[:4]


def _search_std_samr_results_page(client: httpx.Client, query: str) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for variant in _build_official_site_query_variants(query):
        response = client.get("https://std.samr.gov.cn/search/stdPage", params={"q": variant, "tid": ""})
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        for panel in soup.select(".panel.panel-default.post"):
            anchor = panel.select_one(".s-title a[pid][tid]")
            if not anchor:
                continue

            pid = str(anchor.get("pid") or "").strip()
            tid = str(anchor.get("tid") or "").strip()
            detail_url = _build_std_samr_detail_url(pid, tid)
            if not detail_url or detail_url in seen_urls:
                continue

            title = _clean_text(anchor.get_text(" ", strip=True), max_length=180)
            english_title = ""
            text_bodies = [
                _clean_text(node.get_text(" ", strip=True), max_length=220)
                for node in panel.select(".media-body")
                if _clean_text(node.get_text(" ", strip=True), max_length=220)
            ]
            if len(text_bodies) >= 2:
                english_title = text_bodies[0]
            snippet_parts = [part for part in text_bodies[1:] if part]

            footer = panel.select_one(".panel-footer")
            footer_text = _clean_text(footer.get_text(" ", strip=True) if footer else "", max_length=220)
            if footer_text:
                snippet_parts.append(footer_text)

            if english_title and english_title.lower() not in title.lower():
                snippet_parts.insert(0, english_title)

            snippet = _clean_text("；".join(snippet_parts), max_length=260)
            results.append({"title": title, "url": detail_url, "snippet": snippet})
            seen_urls.add(detail_url)

    return results


def _is_low_quality_reference(url: str, title: str, snippet: str) -> bool:
    parsed = urlparse(url)
    path = (parsed.path or "").strip("/")
    title_text = _clean_text(title, max_length=200)
    snippet_text = _clean_text(snippet, max_length=260)
    generic_tokens = (
        "首页",
        "目录查询",
        "公告查询",
        "标准公告",
        "国家标准信息公共服务平台",
        "全国标准信息公共服务平台",
        "国家标准全文公开系统",
    )

    if _is_generic_official_page_title(title_text):
        return True

    if any(token in title_text for token in generic_tokens):
        if len(path) <= 3:
            return True
        if "id=" not in url and "detail" not in path.lower() and "search" not in path.lower():
            return True

    if not snippet_text and len(path) <= 1:
        return True

    return False


def _fetch_reference_page(client: httpx.Client, url: str, fallback: dict[str, str]) -> dict[str, str]:
    title = fallback.get("title", "")
    snippet = fallback.get("snippet", "")
    try:
        response = client.get(url, follow_redirects=True)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if "html" not in content_type.lower():
            return {"title": title, "snippet": snippet}

        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        page_title = soup.title.get_text(" ", strip=True) if soup.title else ""
        h1 = soup.find("h1")
        h1_title = h1.get_text(" ", strip=True) if h1 else ""
        page_text = soup.get_text(" ", strip=True)
        resolved_title = h1_title or page_title or title
        if _is_generic_official_page_title(resolved_title) and title and not _is_generic_official_page_title(title):
            resolved_title = title
        return {
            "title": _clean_text(resolved_title, max_length=180),
            "snippet": _clean_text(snippet or page_text, max_length=900),
        }
    except Exception as exc:  # noqa: BLE001
        logger.debug("Official reference page fetch skipped | url={} error={}", url, exc)
        return {"title": title, "snippet": snippet}


def _build_sensitivity_queries(report_context: dict[str, Any], focuses: list[str]) -> list[str]:
    ranked_variables = extract_ranked_sensitivities(report_context, limit=5)
    sensitivity_terms = extract_sensitivity_terms(report_context, limit=8)
    topic_terms = " ".join((sensitivity_terms + focuses[:4])[:8])

    queries = [
        f"输油管道 水力计算 {topic_terms} 摩阻 压力 标准 规范",
        f"GB/T 35068-2018 油气管道运行规范 {topic_terms} 官方",
        "油气输送管道系统节能监测规范 国家标准",
    ]

    for item in ranked_variables:
        variable_name = str(item.get("variableName") or "").strip()
        queries.extend(SENSITIVITY_VARIABLE_QUERIES.get(variable_name, []))

    return queries


def _build_sensitivity_topic_queries(
    report_context: dict[str, Any],
    focuses: list[str],
    *,
    enabled_topics: set[str] | None = None,
) -> dict[str, list[str]]:
    ranked_variables = extract_ranked_sensitivities(report_context, limit=5)
    sensitivity_terms = extract_sensitivity_terms(report_context, limit=8)
    variable_terms = [
        str(item.get("variableName") or item.get("variableType") or "").strip()
        for item in ranked_variables
        if str(item.get("variableName") or item.get("variableType") or "").strip()
    ]
    primary_variable = variable_terms[0] if variable_terms else ""
    topic_terms = " ".join((variable_terms + sensitivity_terms + focuses[:4])[:8]).strip()

    mechanism_queries = [
        f"输油管道 {primary_variable or topic_terms} 流速 雷诺数 摩阻 压降 工程 公开资料",
        f"原油管道 {primary_variable or topic_terms} 流态 摩阻损失 末站压力 官方 公开资料",
        f"输油管道 {topic_terms or '敏感性分析'} 水力计算 雷诺数 摩阻损失 官方 公开资料",
    ]
    standards_queries = [
        f"输油管道 {primary_variable or topic_terms} 运行 标准 规范 官方 公开资料",
        f"石油天然气 管道 {primary_variable or topic_terms} 国家标准 官方 公开资料",
        "GB/T 35068-2018 油气管道运行规范 官方",
        "油气管道运行规范 Operation and maintenance specification for oil and gas pipeline 国家标准",
        "输油管道 运行与维护 规范 国家标准 官方",
        "输油管道 节能监测 规范 国家标准 官方",
    ]
    operations_queries = [
        f"输油管道 {primary_variable or topic_terms} 调度 节能 优化 运行 公开资料",
        f"原油管道 {primary_variable or topic_terms} 运行 经验 节能 调整 官方 公开资料",
        f"输油管道 {topic_terms or '敏感性分析'} 泵站 调度 策略 节能 官方 公开资料",
    ]

    if "黏度" in variable_terms or "温度" in variable_terms:
        operations_queries.append("高黏度原油 管道 输送 调度 加热 降黏 官方 公开资料")
    if "流量" in variable_terms:
        mechanism_queries.append("输油管道 流量 流速 雷诺数 摩阻 压降 官方 公开资料")
    if "管径" in variable_terms or "粗糙度" in variable_terms:
        standards_queries.append("输油管道 管径 粗糙度 压降 设计 运行 官方 公开资料")

    for item in ranked_variables[:3]:
        variable_name = str(item.get("variableName") or "").strip()
        variable_queries = SENSITIVITY_VARIABLE_QUERIES.get(variable_name, [])
        mechanism_queries.extend(variable_queries[:1])
        standards_queries.extend(variable_queries[:2])
        operations_queries.extend(f"{query} 运行 调度 节能" for query in variable_queries[:1])

    result: dict[str, list[str]] = {}
    for topic_key, queries in (
        ("mechanism", mechanism_queries),
        ("standards", standards_queries),
        ("operations", operations_queries),
    ):
        if enabled_topics is not None and topic_key not in enabled_topics:
            continue
        deduped: list[str] = []
        seen: set[str] = set()
        for query in queries:
            cleaned = _clean_text(query, max_length=160)
            if cleaned and cleaned not in seen:
                deduped.append(cleaned)
                seen.add(cleaned)
        result[topic_key] = deduped[:4]
    return result


def _build_sensitivity_risk_queries(report_context: dict[str, Any], focuses: list[str]) -> list[str]:
    ranked_variables = extract_ranked_sensitivities(report_context, limit=5)
    risk_rules = extract_sensitivity_risk_rules(report_context)
    variable_terms = [str(item.get("variableName") or "").strip() for item in ranked_variables if item.get("variableName")]
    topic_terms = " ".join((variable_terms + focuses[:4])[:8])

    queries = [
        f"GB/T 35068-2018 油气管道运行规范 {topic_terms} 风险 监测 官方",
        f"输油管道 运行维护 {topic_terms} 安全 风险 标准",
        "油气输送管道系统节能监测规范 风险 官方",
        "GB 32167-2015 油气输送管道完整性管理规范 风险 官方",
        "GB/T 42033-2022 油气管道完整性评价技术规范 风险 官方",
    ]

    for item in ranked_variables:
        variable_name = str(item.get("variableName") or "").strip()
        for query in SENSITIVITY_VARIABLE_QUERIES.get(variable_name, [])[:2]:
            queries.append(f"{query} 风险")

    for row in risk_rules[:3]:
        risk_code = str(row.get("riskCode") or "").strip()
        queries.extend(SENSITIVITY_RISK_CODE_QUERIES.get(risk_code, []))

    return queries


def _build_queries(request: Any, report_context: dict[str, Any], profile_key: str) -> list[str]:
    focuses = [str(item).strip() for item in getattr(request, "focuses", []) or [] if str(item).strip()]
    sensitivity_terms = extract_sensitivity_terms(report_context, limit=6)
    topic_terms = " ".join((sensitivity_terms + focuses[:4])[:6])

    if profile_key == "sensitivity":
        topic_queries = _build_sensitivity_topic_queries(report_context, focuses)
        base_queries: list[str] = []
        for queries in topic_queries.values():
            base_queries.extend(queries)
    else:
        base_queries = {
            "optimization": [
                f"输油管道 泵站 优化 调度 能耗 末站压力 官方 标准 {topic_terms}",
                f"油气管道 节能 降耗 泵站 运行 国家能源局 {topic_terms}",
            ],
            "hydraulic": [
                f"输油管道 水力计算 雷诺数 摩阻损失 压力 标准 规范 {topic_terms}",
                f"油气管道 运行与维护 压力 控制 水力 官方 {topic_terms}",
            ],
        }.get(
            profile_key,
            [
                f"输油管道 运行 分析 官方 标准 {topic_terms}",
                f"油气管道 安全 节能 调度 官方 {topic_terms}",
            ],
        )

    domain_queries = [
        "输油管道 工程设计规范 site:std.samr.gov.cn",
        "GB/T 35068-2018 油气管道运行规范 site:openstd.samr.gov.cn",
        "GB/T 35068-2018 油气管道运行规范 site:std.samr.gov.cn",
        "离心泵系统经济运行 通则 site:std.samr.gov.cn",
        "油气输送管道系统节能监测规范 site:std.samr.gov.cn",
    ]
    queries = base_queries + domain_queries

    result: list[str] = []
    seen: set[str] = set()
    for query in queries:
        cleaned = _clean_text(query, max_length=160)
        if cleaned and cleaned not in seen:
            result.append(cleaned)
            seen.add(cleaned)
    return result[:10]


def _build_risk_queries(request: Any, report_context: dict[str, Any], profile_key: str) -> list[str]:
    focuses = [str(item).strip() for item in getattr(request, "focuses", []) or [] if str(item).strip()]
    if profile_key == "sensitivity":
        base_queries = _build_sensitivity_risk_queries(report_context, focuses)
    else:
        base_queries = [
            "油气管道 运行维护 风险 官方 标准",
            "油气管道 安全 风险 监测 官方 标准",
        ]

    domain_queries = [
        "GB/T 35068-2018 油气管道运行规范 风险 site:openstd.samr.gov.cn",
        "GB/T 35068-2018 油气管道运行规范 风险 site:std.samr.gov.cn",
        "GB/T 34165-2017 油气输送管道系统节能监测规范 site:openstd.samr.gov.cn",
        "GB 32167-2015 油气输送管道完整性管理规范 site:openstd.samr.gov.cn",
        "GB/T 42033-2022 油气管道完整性评价技术规范 site:openstd.samr.gov.cn",
        "GB/T 13469-2021 离心泵 混流泵 轴流泵 系统经济运行 site:openstd.samr.gov.cn",
        "GB/T 16666-2012 泵类液体输送系统节能监测 site:openstd.samr.gov.cn",
        "GB/T 38076-2019 输油管道 环境风险评估 防控 site:openstd.samr.gov.cn",
        "油气管道 风险 监测 site:mem.gov.cn",
        "油气管道 节能 运行 site:nea.gov.cn",
        "中国政府网 油气管道 安全 风险 site:gov.cn",
    ]

    result: list[str] = []
    seen: set[str] = set()
    for query in base_queries + domain_queries:
        cleaned = _clean_text(query, max_length=160)
        if cleaned and cleaned not in seen:
            result.append(cleaned)
            seen.add(cleaned)
    return result[:14]


def _collect_references(
    *,
    queries: list[str],
    timeout_seconds: int,
    top_k: int,
    allowed_domains: tuple[str, ...],
    proxy_url: str | None,
) -> list[dict[str, Any]]:
    references: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
        )
    }

    with httpx.Client(
        timeout=timeout_seconds,
        headers=headers,
        follow_redirects=True,
        proxy=proxy_url,
    ) as client:
        for query in queries:
            if len(references) >= top_k:
                break
            raw_results: list[dict[str, str]] = []
            for search_name, searcher in (
                ("std_samr", _search_std_samr_results_page),
                ("duckduckgo", _search_duckduckgo),
                ("bing", _search_bing),
            ):
                try:
                    raw_results.extend(searcher(client, query))
                except Exception as exc:  # noqa: BLE001
                    logger.debug("Official web search skipped | engine={} query={} error={}", search_name, query, exc)

            for item in raw_results:
                url = _resolve_search_url(item.get("url", ""))
                if not _is_allowed_official_url(url, allowed_domains):
                    continue
                normalized_url = _canonical_reference_url(url)
                if _is_low_quality_reference(
                    normalized_url,
                    str(item.get("title") or ""),
                    str(item.get("snippet") or ""),
                ):
                    continue

                page = _fetch_reference_page(client, normalized_url, item)
                page_title = page.get("title") or item.get("title") or "官方资料"
                page_snippet = page.get("snippet") or item.get("snippet") or ""
                if _is_low_quality_reference(normalized_url, page_title, page_snippet):
                    continue

                reference = {
                    "title": page_title,
                    "url": normalized_url,
                    "domain": urlparse(normalized_url).hostname or "",
                    "publisher": _publisher_for(normalized_url),
                    "snippet": page_snippet,
                    "query": query,
                }
                reference_keys = _reference_identity_keys(reference)
                if reference_keys & seen_keys:
                    continue

                references.append(reference)
                seen_keys.update(reference_keys)
                if len(references) >= top_k:
                    break

    return _with_curated_references(
        references,
        queries=queries,
        allowed_domains=allowed_domains,
    )


def _build_topic_payload(
    *,
    label: str,
    queries: list[str],
    references: list[dict[str, str]],
) -> dict[str, Any]:
    return {
        "label": label,
        "status": "found" if references else "not_found",
        "queries": queries,
        "references": references,
    }


def _flatten_topic_queries(topic_payloads: dict[str, dict[str, Any]]) -> list[str]:
    flattened: list[str] = []
    seen: set[str] = set()
    for topic in topic_payloads.values():
        for query in topic.get("queries") or []:
            cleaned = _clean_text(query, max_length=200)
            if cleaned and cleaned not in seen:
                flattened.append(cleaned)
                seen.add(cleaned)
    return flattened


def _flatten_topic_references(topic_payloads: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    flattened: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for topic in topic_payloads.values():
        for item in topic.get("references") or []:
            if not isinstance(item, dict):
                continue
            item_keys = _reference_identity_keys(item)
            if not item_keys or item_keys & seen_keys:
                continue
            flattened.append(item)
            seen_keys.update(item_keys)
    return flattened


def _collect_topic_references(
    *,
    topic_queries: dict[str, list[str]],
    topic_labels: dict[str, str],
    timeout_seconds: int,
    top_k: int,
    allowed_domains: tuple[str, ...],
    proxy_url: str | None,
) -> dict[str, dict[str, Any]]:
    topic_payloads: dict[str, dict[str, Any]] = {}
    topic_limit = max(2, min(top_k, 3))

    for topic_key, queries in topic_queries.items():
        references: list[dict[str, Any]] = []
        if queries:
            references = _collect_references(
                queries=queries,
                timeout_seconds=timeout_seconds,
                top_k=topic_limit,
                allowed_domains=allowed_domains,
                proxy_url=proxy_url,
            )
            references = _with_curated_references(
                references,
                queries=queries,
                allowed_domains=allowed_domains,
                topic_key=topic_key,
            )
        topic_payloads[topic_key] = _build_topic_payload(
            label=topic_labels.get(topic_key, topic_key),
            queries=queries,
            references=references,
        )

    return topic_payloads


def _empty_research(
    status: str,
    *,
    topics: dict[str, dict[str, Any]] | None = None,
    allowed_domains: tuple[str, ...] | list[str] | None = None,
) -> dict[str, Any]:
    return {
        "enabled": status != "disabled",
        "status": status,
        "queries": [],
        "references": [],
        "topics": topics or {},
        "searched_at": datetime.now(timezone.utc).isoformat(),
        "allowed_domains": list(allowed_domains or []),
    }


def merge_official_research_payloads(*payloads: dict[str, Any]) -> dict[str, Any]:
    references: list[dict[str, Any]] = []
    queries: list[str] = []
    allowed_domains: list[str] = []
    seen_reference_keys: set[str] = set()
    seen_queries: set[str] = set()
    seen_domains: set[str] = set()
    enabled = False
    searched_at = ""
    merged_topics: dict[str, dict[str, Any]] = {}
    topic_query_seen: dict[str, set[str]] = {}
    topic_url_seen: dict[str, set[str]] = {}

    for payload in payloads:
        if not isinstance(payload, dict):
            continue
        enabled = enabled or bool(payload.get("enabled"))
        searched_at = str(payload.get("searched_at") or searched_at)

        for query in payload.get("queries") or []:
            cleaned = _clean_text(query, max_length=200)
            if cleaned and cleaned not in seen_queries:
                queries.append(cleaned)
                seen_queries.add(cleaned)

        for domain in payload.get("allowed_domains") or []:
            cleaned = str(domain or "").strip().lower()
            if cleaned and cleaned not in seen_domains:
                allowed_domains.append(cleaned)
                seen_domains.add(cleaned)

        for item in payload.get("references") or []:
            if not isinstance(item, dict):
                continue
            item_keys = _reference_identity_keys(item)
            if not item_keys or item_keys & seen_reference_keys:
                continue
            references.append(item)
            seen_reference_keys.update(item_keys)

        topic_payloads = payload.get("topics")
        if not isinstance(topic_payloads, dict):
            continue

        for topic_key, topic_payload in topic_payloads.items():
            if not isinstance(topic_payload, dict):
                continue
            merged_topic = merged_topics.setdefault(
                str(topic_key),
                {
                    "label": str(topic_payload.get("label") or topic_key),
                    "status": "not_found",
                    "queries": [],
                    "references": [],
                },
            )
            topic_query_seen.setdefault(str(topic_key), set())
            topic_url_seen.setdefault(str(topic_key), set())

            for query in topic_payload.get("queries") or []:
                cleaned = _clean_text(query, max_length=200)
                if cleaned and cleaned not in topic_query_seen[str(topic_key)]:
                    merged_topic["queries"].append(cleaned)
                    topic_query_seen[str(topic_key)].add(cleaned)

            for item in topic_payload.get("references") or []:
                if not isinstance(item, dict):
                    continue
                item_keys = _reference_identity_keys(item)
                if not item_keys or item_keys & topic_url_seen[str(topic_key)]:
                    continue
                merged_topic["references"].append(item)
                topic_url_seen[str(topic_key)].update(item_keys)

            merged_topic["status"] = "found" if merged_topic["references"] else "not_found"

    return {
        "enabled": enabled,
        "status": "found" if references else "not_found",
        "queries": queries,
        "references": references,
        "topics": merged_topics,
        "searched_at": searched_at or datetime.now(timezone.utc).isoformat(),
        "allowed_domains": allowed_domains,
    }


def collect_official_research(
    request: Any,
    report_context: dict[str, Any],
    profile_key: str,
    research_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not settings.REPORT_WEB_RESEARCH_ENABLED:
        return _empty_research("disabled")

    timeout_seconds = max(int(settings.REPORT_WEB_RESEARCH_TIMEOUT_SECONDS or 8), 3)
    minimum_top_k = 6 if profile_key == "sensitivity" else 4
    top_k = max(int(settings.REPORT_WEB_RESEARCH_TOP_K or minimum_top_k), minimum_top_k)
    allowed_domains = _parse_csv(settings.REPORT_WEB_RESEARCH_ALLOWED_DOMAINS, DEFAULT_OFFICIAL_DOMAINS)
    proxy_url = str(settings.REPORT_WEB_RESEARCH_PROXY or "").strip() or None
    active_research_plan = research_plan or resolve_report_research_plan(request, profile_key)

    started_at = datetime.now(timezone.utc)
    try:
        if profile_key == "sensitivity":
            enabled_topics = set(
                requested_web_research_topics(active_research_plan, ["mechanism", "standards", "operations"])
            )
            if not enabled_topics:
                return _empty_research("not_requested", allowed_domains=allowed_domains)

            topic_payloads = _collect_topic_references(
                topic_queries=_build_sensitivity_topic_queries(
                    report_context,
                    [str(item).strip() for item in getattr(request, "focuses", []) or [] if str(item).strip()],
                    enabled_topics=enabled_topics,
                ),
                topic_labels=SENSITIVITY_RESEARCH_TOPIC_LABELS,
                timeout_seconds=timeout_seconds,
                top_k=top_k,
                allowed_domains=allowed_domains,
                proxy_url=proxy_url,
            )
            queries = _flatten_topic_queries(topic_payloads)
            references = _flatten_topic_references(topic_payloads)
        else:
            queries = _build_queries(request, report_context, profile_key)
            references = _collect_references(
                queries=queries,
                timeout_seconds=timeout_seconds,
                top_k=top_k,
                allowed_domains=allowed_domains,
                proxy_url=proxy_url,
            )
            topic_payloads = {
                "general": _build_topic_payload(
                    label="官方资料与公开资料",
                    queries=queries,
                    references=references,
                )
            }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Official web research failed: {}", exc)
        queries = []
        references = []
        topic_payloads = {}

    status = "found" if references else "not_found"
    elapsed_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
    logger.info(
        "Official web research completed | profile={} status={} refs={} queries={} elapsed_ms={}",
        profile_key,
        status,
        len(references),
        len(queries),
        elapsed_ms,
    )

    return {
        "enabled": True,
        "status": status,
        "queries": queries,
        "references": references,
        "topics": topic_payloads,
        "searched_at": datetime.now(timezone.utc).isoformat(),
        "allowed_domains": list(allowed_domains),
    }


def collect_official_risk_research(
    request: Any,
    report_context: dict[str, Any],
    profile_key: str,
    research_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not settings.REPORT_WEB_RESEARCH_ENABLED:
        return _empty_research("disabled")

    timeout_seconds = max(int(settings.REPORT_WEB_RESEARCH_TIMEOUT_SECONDS or 8), 3)
    allowed_domains = _parse_csv(settings.REPORT_WEB_RESEARCH_ALLOWED_DOMAINS, DEFAULT_OFFICIAL_DOMAINS)
    minimum_top_k = 6 if profile_key == "sensitivity" else 4
    top_k = max(int(settings.REPORT_WEB_RESEARCH_TOP_K or minimum_top_k), minimum_top_k)
    proxy_url = str(settings.REPORT_WEB_RESEARCH_PROXY or "").strip() or None
    active_research_plan = research_plan or resolve_report_research_plan(request, profile_key)
    if profile_key == "sensitivity" and "risk" not in requested_web_research_topics(active_research_plan, ["risk"]):
        return _empty_research("not_requested", allowed_domains=allowed_domains)

    queries = _build_risk_queries(request, report_context, profile_key)

    started_at = datetime.now(timezone.utc)
    try:
        queries = _build_risk_queries(request, report_context, profile_key)
        references = _collect_references(
            queries=queries,
            timeout_seconds=timeout_seconds,
            top_k=top_k,
            allowed_domains=allowed_domains,
            proxy_url=proxy_url,
        )
        references = _with_curated_references(
            references,
            queries=queries,
            allowed_domains=allowed_domains,
            topic_key="risk",
            minimum_count=2,
        )
        topic_payloads = {
            "risk": _build_topic_payload(
                label=RISK_RESEARCH_TOPIC_LABELS["risk"],
                queries=queries,
                references=references,
            )
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Official risk web research failed: {}", exc)
        queries = []
        references = []
        topic_payloads = {}

    status = "found" if references else "not_found"
    elapsed_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
    logger.info(
        "Official risk research completed | profile={} status={} refs={} queries={} elapsed_ms={}",
        profile_key,
        status,
        len(references),
        len(queries),
        elapsed_ms,
    )

    return {
        "enabled": True,
        "status": status,
        "queries": queries,
        "references": references,
        "topics": topic_payloads,
        "searched_at": datetime.now(timezone.utc).isoformat(),
        "allowed_domains": list(allowed_domains),
    }

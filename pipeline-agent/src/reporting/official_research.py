from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from bs4 import BeautifulSoup
import httpx

from src.config import settings
from src.utils import logger

from .sensitivity_facts import extract_ranked_sensitivities, extract_sensitivity_terms
from .skills.sensitivity_helpers import extract_sensitivity_risk_rules


DEFAULT_OFFICIAL_DOMAINS = (
    "std.samr.gov.cn",
    "openstd.samr.gov.cn",
    "www.samr.gov.cn",
    "www.gov.cn",
    "www.nea.gov.cn",
    "zfxxgk.nea.gov.cn",
    "www.ndrc.gov.cn",
    "www.mem.gov.cn",
    "www.mee.gov.cn",
    "www.mot.gov.cn",
    "www.mnr.gov.cn",
)

PUBLISHER_LABELS = {
    "std.samr.gov.cn": "全国标准信息公共服务平台",
    "openstd.samr.gov.cn": "国家标准全文公开系统",
    "www.samr.gov.cn": "国家市场监督管理总局",
    "www.gov.cn": "中国政府网",
    "www.nea.gov.cn": "国家能源局",
    "zfxxgk.nea.gov.cn": "国家能源局政府信息公开",
    "www.ndrc.gov.cn": "国家发展和改革委员会",
    "www.mem.gov.cn": "应急管理部",
    "www.mee.gov.cn": "生态环境部",
    "www.mot.gov.cn": "交通运输部",
    "www.mnr.gov.cn": "自然资源部",
}

SENSITIVITY_VARIABLE_QUERIES = {
    "流量": [
        "油气管道运行与维护规范 流量 压力 国家标准",
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
        "油气管道运行与维护规范 压力 波动 运行风险 国家标准",
        "输油管道 压力 控制 运行维护 官方 标准",
    ],
    "equipment_boundary_zone": [
        "油气管道运行与维护规范 设备 运行边界 官方 标准",
        "离心泵系统经济运行 高负荷 风险 国家标准",
    ],
}


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
        return {
            "title": _clean_text(h1_title or page_title or title, max_length=180),
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
        f"油气管道运行与维护规范 {topic_terms} 官方",
        "油气输送管道系统节能监测规范 国家标准",
    ]

    for item in ranked_variables:
        variable_name = str(item.get("variableName") or "").strip()
        queries.extend(SENSITIVITY_VARIABLE_QUERIES.get(variable_name, []))

    return queries


def _build_sensitivity_risk_queries(report_context: dict[str, Any], focuses: list[str]) -> list[str]:
    ranked_variables = extract_ranked_sensitivities(report_context, limit=5)
    risk_rules = extract_sensitivity_risk_rules(report_context)
    variable_terms = [str(item.get("variableName") or "").strip() for item in ranked_variables if item.get("variableName")]
    topic_terms = " ".join((variable_terms + focuses[:4])[:8])

    queries = [
        f"油气管道运行与维护规范 {topic_terms} 风险 监测 官方",
        f"输油管道 运行维护 {topic_terms} 安全 风险 标准",
        "油气输送管道系统节能监测规范 风险 官方",
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
        base_queries = _build_sensitivity_queries(report_context, focuses)
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
        "油气管道 运行与维护规范 site:std.samr.gov.cn",
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
        "油气管道 运行与维护规范 风险 site:std.samr.gov.cn",
        "油气输送管道系统节能监测规范 风险 site:std.samr.gov.cn",
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
    return result[:8]


def _collect_references(
    *,
    queries: list[str],
    timeout_seconds: int,
    top_k: int,
    allowed_domains: tuple[str, ...],
    proxy_url: str | None,
) -> list[dict[str, str]]:
    references: list[dict[str, str]] = []
    seen_urls: set[str] = set()
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
            try:
                search_results = _search_duckduckgo(client, query)
            except Exception as exc:  # noqa: BLE001
                logger.debug("Official web search skipped | query={} error={}", query, exc)
                continue

            for item in search_results:
                url = _resolve_search_url(item.get("url", ""))
                if not _is_allowed_official_url(url, allowed_domains):
                    continue
                normalized_url = url.split("#", maxsplit=1)[0]
                if normalized_url in seen_urls:
                    continue
                seen_urls.add(normalized_url)
                page = _fetch_reference_page(client, normalized_url, item)
                references.append(
                    {
                        "title": page.get("title") or item.get("title") or "官方资料",
                        "url": normalized_url,
                        "domain": urlparse(normalized_url).hostname or "",
                        "publisher": _publisher_for(normalized_url),
                        "snippet": page.get("snippet") or item.get("snippet") or "",
                        "query": query,
                    }
                )
                if len(references) >= top_k:
                    break

    return references


def _empty_research(status: str) -> dict[str, Any]:
    return {
        "enabled": status != "disabled",
        "status": status,
        "queries": [],
        "references": [],
        "searched_at": datetime.now(timezone.utc).isoformat(),
    }


def collect_official_research(
    request: Any,
    report_context: dict[str, Any],
    profile_key: str,
) -> dict[str, Any]:
    if not settings.REPORT_WEB_RESEARCH_ENABLED:
        return _empty_research("disabled")

    timeout_seconds = max(int(settings.REPORT_WEB_RESEARCH_TIMEOUT_SECONDS or 8), 3)
    minimum_top_k = 6 if profile_key == "sensitivity" else 4
    top_k = max(int(settings.REPORT_WEB_RESEARCH_TOP_K or minimum_top_k), minimum_top_k)
    allowed_domains = _parse_csv(settings.REPORT_WEB_RESEARCH_ALLOWED_DOMAINS, DEFAULT_OFFICIAL_DOMAINS)
    queries = _build_queries(request, report_context, profile_key)
    proxy_url = str(settings.REPORT_WEB_RESEARCH_PROXY or "").strip() or None

    started_at = datetime.now(timezone.utc)
    try:
        references = _collect_references(
            queries=queries,
            timeout_seconds=timeout_seconds,
            top_k=top_k,
            allowed_domains=allowed_domains,
            proxy_url=proxy_url,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Official web research failed: {}", exc)
        references = []

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
        "searched_at": datetime.now(timezone.utc).isoformat(),
        "allowed_domains": list(allowed_domains),
    }


def collect_official_risk_research(
    request: Any,
    report_context: dict[str, Any],
    profile_key: str,
) -> dict[str, Any]:
    if not settings.REPORT_WEB_RESEARCH_ENABLED:
        return _empty_research("disabled")

    timeout_seconds = max(int(settings.REPORT_WEB_RESEARCH_TIMEOUT_SECONDS or 8), 3)
    allowed_domains = _parse_csv(settings.REPORT_WEB_RESEARCH_ALLOWED_DOMAINS, DEFAULT_OFFICIAL_DOMAINS)
    queries = _build_risk_queries(request, report_context, profile_key)
    minimum_top_k = 6 if profile_key == "sensitivity" else 4
    top_k = max(int(settings.REPORT_WEB_RESEARCH_TOP_K or minimum_top_k), minimum_top_k)
    proxy_url = str(settings.REPORT_WEB_RESEARCH_PROXY or "").strip() or None

    started_at = datetime.now(timezone.utc)
    try:
        references = _collect_references(
            queries=queries,
            timeout_seconds=timeout_seconds,
            top_k=top_k,
            allowed_domains=allowed_domains,
            proxy_url=proxy_url,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Official risk web research failed: {}", exc)
        references = []

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
        "searched_at": datetime.now(timezone.utc).isoformat(),
        "allowed_domains": list(allowed_domains),
    }

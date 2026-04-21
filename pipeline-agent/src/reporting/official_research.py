from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from bs4 import BeautifulSoup
import httpx

from src.config import settings
from src.utils import logger


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


def _first_text(record: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = record.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _as_records(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _extract_sensitivity_terms(report_context: dict[str, Any]) -> list[str]:
    snapshot = report_context.get("sensitivity_snapshot")
    if not isinstance(snapshot, dict):
        return []

    output_payload = snapshot.get("output")
    input_payload = snapshot.get("input")
    output_payload = output_payload if isinstance(output_payload, dict) else {}
    input_payload = input_payload if isinstance(input_payload, dict) else {}

    ranking_rows = _as_records(output_payload.get("sensitivityRanking"))
    variable_results = _as_records(output_payload.get("variableResults"))
    variables = _as_records(input_payload.get("variables"))
    terms: list[str] = []

    for row in ranking_rows[:2] + variable_results[:2] + variables[:2]:
        text = _first_text(row, ("variableName", "variableType", "name", "code"))
        if text:
            terms.append(text)

    mapped_terms: list[str] = []
    for term in terms:
        normalized = term.upper()
        if "FLOW" in normalized or "THROUGHPUT" in normalized or "流量" in term or "输量" in term:
            mapped_terms.extend(["流量", "输量"])
        elif "VISCOSITY" in normalized or "粘" in term or "黏" in term:
            mapped_terms.append("黏度")
        elif "DENSITY" in normalized or "密度" in term:
            mapped_terms.append("密度")
        elif "DIAMETER" in normalized or "管径" in term:
            mapped_terms.append("管径")
        elif "ROUGH" in normalized or "粗糙" in term:
            mapped_terms.append("粗糙度")
        else:
            mapped_terms.append(term)

    result: list[str] = []
    seen: set[str] = set()
    for term in mapped_terms:
        cleaned = _clean_text(term, max_length=30)
        if cleaned and cleaned not in seen:
            result.append(cleaned)
            seen.add(cleaned)
    return result[:4]


def _search_duckduckgo(client: httpx.Client, query: str) -> list[dict[str, str]]:
    url = "https://duckduckgo.com/html/"
    response = client.get(url, params={"q": query, "kl": "cn-zh"})
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


def _build_queries(request: Any, report_context: dict[str, Any], profile_key: str) -> list[str]:
    focuses = [str(item).strip() for item in getattr(request, "focuses", []) or [] if str(item).strip()]
    sensitivity_terms = _extract_sensitivity_terms(report_context)
    topic_terms = " ".join((sensitivity_terms + focuses[:4])[:6])

    base_queries = {
        "sensitivity": [
            f"输油管道 水力计算 {topic_terms} 摩阻 压力 标准 规范",
            f"油气管道 安全运行 {topic_terms} 压力 流量 调度 官方",
            f"管道运输 节能 降耗 泵站 调度 {topic_terms} 官方",
        ],
        "optimization": [
            f"输油管道 泵站 优化 调度 能耗 末站压力 官方 标准 {topic_terms}",
            f"油气管道 节能 降耗 泵站 运行 国家能源局 {topic_terms}",
        ],
        "hydraulic": [
            f"输油管道 水力计算 雷诺数 摩阻损失 压力 标准 规范 {topic_terms}",
            f"油气管道 安全运行 压力 控制 水力 官方 {topic_terms}",
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
        "油气管道 安全运行 官方 site:gov.cn",
        "油气管道 节能 降耗 国家能源局",
    ]
    queries = base_queries + domain_queries

    result: list[str] = []
    seen: set[str] = set()
    for query in queries:
        cleaned = _clean_text(query, max_length=140)
        if cleaned and cleaned not in seen:
            result.append(cleaned)
            seen.add(cleaned)
    return result[:5]


def collect_official_research(
    request: Any,
    report_context: dict[str, Any],
    profile_key: str,
) -> dict[str, Any]:
    if not settings.REPORT_WEB_RESEARCH_ENABLED:
        return {
            "enabled": False,
            "status": "disabled",
            "queries": [],
            "references": [],
            "searched_at": datetime.now(timezone.utc).isoformat(),
        }

    timeout_seconds = max(int(settings.REPORT_WEB_RESEARCH_TIMEOUT_SECONDS or 8), 3)
    top_k = max(int(settings.REPORT_WEB_RESEARCH_TOP_K or 4), 1)
    allowed_domains = _parse_csv(settings.REPORT_WEB_RESEARCH_ALLOWED_DOMAINS, DEFAULT_OFFICIAL_DOMAINS)
    queries = _build_queries(request, report_context, profile_key)
    references: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
        )
    }
    proxy_url = str(settings.REPORT_WEB_RESEARCH_PROXY or "").strip() or None

    started_at = datetime.now(timezone.utc)
    try:
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
    except Exception as exc:  # noqa: BLE001
        logger.warning("Official web research failed: {}", exc)

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

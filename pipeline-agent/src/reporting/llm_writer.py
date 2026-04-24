from __future__ import annotations

import json
import time
from typing import Any

from langchain_openai import ChatOpenAI

from src.config import settings
from src.models.schemas import DynamicReportRequest
from src.utils import logger


def explain_report(payload: dict[str, Any], request: DynamicReportRequest) -> dict[str, Any]:
    started_at = time.perf_counter()

    try:
        timeout_seconds = max(int(settings.LLM_TIMEOUT_SECONDS or 20), 5)
        payload_text = json.dumps(payload, ensure_ascii=False, default=str)
        payload_size_kb = len(payload_text.encode("utf-8")) / 1024

        logger.info(
            "Dynamic report LLM start | model={} timeout={}s payload_kb={:.1f}",
            settings.LLM_MODEL,
            timeout_seconds,
            payload_size_kb,
        )

        llm = ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE,
            model=settings.LLM_MODEL,
            temperature=0.1,
            max_tokens=min(settings.LLM_MAX_TOKENS, 2400),
            streaming=False,
            timeout=timeout_seconds,
            max_retries=0,
        )
        prompt = "\n".join(
            [
                "你是工业输油业务的报告撰写助手。",
                "你只能基于输入中的 facts、outline、draft、report_context、official_research 和 official_risk_research 写内容，不允许编造任何数值、对象、时间点、原因或结论。",
                "本地业务计算已经完成；你不能重复做业务计算、补算新工况或伪造新的仿真结果，只能解释既有结果并做证据校核。",
                "如果输入里包含 research_plan，必须遵循该计划：先复用本地已算结果，再按请求的主题联网校核；未被请求的主题不要自行扩搜。",
                "如果 official_research.references 有内容，必须把这些官方/标准来源作为外部证据，用来校核“是否调整、怎么调、调多少”的判断；如果没有官方来源，不要假装已经联网查证。",
                "对敏感性报告，official_research.topics.mechanism 用于机理解释与图表解读，official_research.topics.standards 用于标准/规范/公开资料校核，official_research.topics.operations 用于运行建议与节能策略补充，official_risk_research 用于风险分析。",
                "不要让联网结果喧宾夺主，不要把检索到的网页内容原样堆给用户；必须把“本地计算事实 + 联网证据”融合成工程判断。",
                "official_conclusions 必须是中文字符串数组。仅当 official_research.references 非空时输出 2 到 5 条，每条都要直接回答工程动作，并把计算事实和官方依据结合起来。",
                "如果 facts.primary_sensitivity.variableName 存在，official_conclusions 的第一条必须围绕该最敏感变量展开。",
                "如果 facts.ranked_sensitivities 存在多个变量，后续条目应优先覆盖其余高影响变量；不要只围绕一个变量反复改写，也不要把未出现在事实中的变量写成项目主导矛盾。",
                "敏感性分析里要区分运行调度变量与设计/状态变量：前者可以直接给控制建议，后者应写成校核、复核、整改或改造建议。",
                "official_conclusions 不要套用固定句式，不要只重复敏感系数；必须说明依据来自哪个官方发布者或标准平台。不要编造未提供的标准编号、条款号或结论。",
                "如果证据不足，必须明确写出“数据不足，无法下结论”。",
                "你只能输出 JSON，字段仅允许包含 title、abstract、summary、highlights、conclusion、section_summaries、official_conclusions。",
                "summary、highlights、official_conclusions 必须是字符串数组。",
                "section_summaries 必须是对象，key 为 section id，value 为一句中文摘要。",
                "如果 report_context.official_module_evidence.coreConclusion.references 有内容，official_conclusions 必须优先使用这组来源，确保核心结论的文字与页面展示的官方资料来源一致；不要引用未挂到核心结论模块的来源标题。",
                "If multiple official_conclusions rely on the same official source, merge them into one item: mention the source once and combine the related engineering judgments in one coherent sentence or short paragraph.",
                payload_text,
            ]
        )
        response = llm.invoke(prompt)

        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.info(
            "Dynamic report LLM finished | model={} elapsed_ms={:.0f}",
            settings.LLM_MODEL,
            elapsed_ms,
        )

        text = getattr(response, "content", "") if response is not None else ""
        cleaned = str(text).replace("```json", "").replace("```", "").strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            cleaned = cleaned[start : end + 1]
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else {}
    except Exception as exc:  # noqa: BLE001
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.warning(
            "LLM explanation skipped for dynamic report after {:.0f}ms: {}",
            elapsed_ms,
            exc,
        )
        return {}

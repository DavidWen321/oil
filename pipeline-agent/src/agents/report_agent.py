"""Report generation agent."""

from __future__ import annotations

import json
from typing import Dict, List, Optional

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from src.config import settings
from src.utils import now_iso, logger

from .prompts import REPORT_AGENT_PROMPT


class ReportAgent:
    """Generate report outline and report sections."""

    def __init__(self) -> None:
        self._llm: Optional[ChatOpenAI] = None

    @property
    def llm(self) -> ChatOpenAI:
        if self._llm is None:
            self._llm = ChatOpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_API_BASE,
                model=settings.LLM_MODEL,
                temperature=0.2,
                max_tokens=2500,
            )
        return self._llm

    def generate_outline(self, user_request: str, available_data: dict) -> dict:
        """Generate report outline for optional HITL confirmation."""

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", REPORT_AGENT_PROMPT),
                (
                    "human",
                    "用户请求: {user_request}\n可用数据: {available_data}\n请先给出报告大纲 JSON。",
                ),
            ]
        )
        chain = prompt | self.llm | StrOutputParser()

        try:
            result = chain.invoke(
                {
                    "user_request": user_request,
                    "available_data": json.dumps(available_data or {}, ensure_ascii=False),
                }
            )
            parsed = self._extract_json(result)
            if "sections" in parsed:
                return {
                    "title": parsed.get("title", "管道运行分析报告"),
                    "sections": parsed.get("sections", []),
                }
        except Exception as exc:
            logger.warning(f"Report outline fallback: {exc}")

        return {
            "title": "管道运行分析报告",
            "sections": [
                {"title": "一、运行概况", "data_requirements": ["流量", "运行时长", "能耗"]},
                {"title": "二、水力分析", "data_requirements": ["雷诺数", "摩阻", "压力分布"]},
                {"title": "三、优化建议", "data_requirements": ["优化方案", "风险点", "收益"]},
            ],
        }

    def generate_section(
        self,
        section_title: str,
        data: dict,
        calc_results: dict,
        standards: dict,
    ) -> dict:
        """Generate one report section."""

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", REPORT_AGENT_PROMPT),
                (
                    "human",
                    "章节: {section_title}\n数据: {data}\n计算结果: {calc_results}\n标准: {standards}\n"
                    "输出单章节 JSON，字段 title/content/charts/tables/alerts。",
                ),
            ]
        )
        chain = prompt | self.llm | StrOutputParser()

        try:
            result = chain.invoke(
                {
                    "section_title": section_title,
                    "data": json.dumps(data or {}, ensure_ascii=False),
                    "calc_results": json.dumps(calc_results or {}, ensure_ascii=False),
                    "standards": json.dumps(standards or {}, ensure_ascii=False),
                }
            )
            parsed = self._extract_json(result)
            if "title" in parsed:
                return {
                    "title": parsed.get("title", section_title),
                    "content": parsed.get("content", ""),
                    "charts": parsed.get("charts", []),
                    "tables": parsed.get("tables", []),
                    "alerts": parsed.get("alerts", []),
                }
        except Exception as exc:
            logger.warning(f"Report section fallback: {exc}")

        return {
            "title": section_title,
            "content": "暂无自动生成内容，请补充业务数据后重试。",
            "charts": [],
            "tables": [],
            "alerts": [],
        }

    def generate_full_report(self, outline: dict, section_results: List[dict]) -> dict:
        """Assemble final report from outline and section results."""

        title = outline.get("title") or "管道运行分析报告"
        sections = section_results or []

        summary = "；".join(
            [s.get("title", "") for s in sections if s.get("title")]
        )

        return {
            "title": title,
            "generate_time": now_iso(),
            "sections": sections,
            "summary": summary or "报告已生成",
            "recommendations": self._collect_recommendations(sections),
        }

    @staticmethod
    def _extract_json(text: str) -> dict:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("No JSON block found")
        return json.loads(text[start : end + 1])

    @staticmethod
    def _collect_recommendations(sections: List[dict]) -> List[str]:
        recommendations: List[str] = []
        for section in sections:
            for alert in section.get("alerts", []):
                msg = alert.get("message") if isinstance(alert, dict) else None
                if msg:
                    recommendations.append(msg)

        if recommendations:
            return recommendations[:5]

        return [
            "建议结合实时监控数据校准模型参数。",
            "建议按月输出报告并跟踪节能收益。",
        ]


_report_agent: Optional[ReportAgent] = None


def get_report_agent() -> ReportAgent:
    """Return singleton report agent."""

    global _report_agent
    if _report_agent is None:
        _report_agent = ReportAgent()
    return _report_agent

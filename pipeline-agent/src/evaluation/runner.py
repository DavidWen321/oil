"""评测运行器。"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Optional

from src.evaluation.dataset import EVAL_DATASET, EvalCase
from src.utils import generate_trace_id


@dataclass
class EvalResult:
    case_id: str
    passed: bool
    tool_match: bool
    keyword_match: bool
    intent_match: bool
    latency_ms: float
    token_usage: int
    actual_tools: list[str]
    actual_response: str
    error: Optional[str] = None


@dataclass
class EvalReport:
    run_id: str
    timestamp: str
    total_cases: int
    passed_cases: int
    pass_rate: float
    avg_latency_ms: float
    total_tokens: int
    tool_accuracy: float
    keyword_coverage: float
    intent_accuracy: float
    results: list[EvalResult]

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "total_cases": self.total_cases,
            "passed_cases": self.passed_cases,
            "pass_rate": self.pass_rate,
            "avg_latency_ms": self.avg_latency_ms,
            "total_tokens": self.total_tokens,
            "tool_accuracy": self.tool_accuracy,
            "keyword_coverage": self.keyword_coverage,
            "intent_accuracy": self.intent_accuracy,
            "results": [asdict(item) for item in self.results],
        }


async def run_evaluation(workflow, cases: list[EvalCase] | None = None) -> EvalReport:
    if cases is None:
        cases = EVAL_DATASET

    results: list[EvalResult] = []
    total_tokens = 0
    tool_hits = 0
    keyword_hits = 0
    intent_hits = 0

    for case in cases:
        started = time.perf_counter()
        error = None
        response_payload = {}
        try:
            response_payload = await workflow.ainvoke(
                user_input=case.input,
                session_id=f"eval_{case.id}_{int(time.time())}",
                trace_id=f"eval_{generate_trace_id()}",
            )
        except Exception as exc:  # noqa: BLE001
            error = str(exc)
            response_payload = {"response": "", "tool_calls": [], "intent": "", "token_usage": {}}

        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        actual_tools = [item.get("tool") for item in response_payload.get("tool_calls", []) if item.get("tool")]
        actual_response = str(response_payload.get("response", ""))
        actual_intent = str(response_payload.get("intent", ""))
        token_usage = int(response_payload.get("token_usage", {}).get("total_tokens", 0) or 0)

        tool_match = set(case.expected_tools).issubset(set(actual_tools))
        keyword_match = all(keyword in actual_response for keyword in case.expected_keywords)
        intent_match = actual_intent == case.expected_intent
        passed = tool_match and keyword_match and intent_match and error is None

        tool_hits += int(tool_match)
        keyword_hits += int(keyword_match)
        intent_hits += int(intent_match)
        total_tokens += token_usage

        results.append(
            EvalResult(
                case_id=case.id,
                passed=passed,
                tool_match=tool_match,
                keyword_match=keyword_match,
                intent_match=intent_match,
                latency_ms=latency_ms,
                token_usage=token_usage,
                actual_tools=actual_tools,
                actual_response=actual_response,
                error=error,
            )
        )

    total_cases = len(results)
    passed_cases = sum(1 for item in results if item.passed)
    avg_latency_ms = round(sum(item.latency_ms for item in results) / total_cases, 2) if total_cases else 0.0

    return EvalReport(
        run_id=f"eval_run_{int(time.time())}",
        timestamp=datetime.now().isoformat(),
        total_cases=total_cases,
        passed_cases=passed_cases,
        pass_rate=round((passed_cases / total_cases) if total_cases else 0.0, 4),
        avg_latency_ms=avg_latency_ms,
        total_tokens=total_tokens,
        tool_accuracy=round((tool_hits / total_cases) if total_cases else 0.0, 4),
        keyword_coverage=round((keyword_hits / total_cases) if total_cases else 0.0, 4),
        intent_accuracy=round((intent_hits / total_cases) if total_cases else 0.0, 4),
        results=results,
    )

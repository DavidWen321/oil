"""Input guardrails for prompt-injection and oversized input protection."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class GuardResult:
    """Guard check result."""

    passed: bool
    reason: str = ""
    sanitized_input: str = ""


INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"ignore\s+(all\s+)?above",
    r"forget\s+(all\s+)?previous",
    r"system\s*prompt",
    r"developer\s*message",
    r"你(现在)?是\s*(一个|一名)?\s*(黑客|攻击者)",
    r"</?\s*(?:script|iframe|img|svg)\b",
    r"(?:drop|delete|insert|update|alter|create|truncate)\s+(?:table|database|index)",
]
MAX_INPUT_LENGTH = 4096


def check_input(user_input: str) -> GuardResult:
    """Return guard result for user input."""

    if not user_input or not user_input.strip():
        return GuardResult(passed=False, reason="输入不能为空")

    sanitized = user_input.strip()
    if len(sanitized) > MAX_INPUT_LENGTH:
        return GuardResult(
            passed=False,
            reason=f"输入过长（{len(sanitized)} 字符），最大允许 {MAX_INPUT_LENGTH} 字符",
        )

    lowered = sanitized.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, lowered, re.IGNORECASE):
            return GuardResult(
                passed=False,
                reason="检测到潜在恶意输入，请重新表述您的问题",
            )

    return GuardResult(passed=True, sanitized_input=sanitized)

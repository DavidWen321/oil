"""Session/user memory manager built on Redis."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

from src.config import get_redis
from src.utils import logger, now_iso


class MemoryManager:
    """Manage working memory and user-scoped preference memory."""

    WORKING_PREFIX = "memory:working:"
    LONG_TERM_PREFIX = "memory:user:"
    WORKING_TTL_SECONDS = 6 * 60 * 60

    def __init__(self) -> None:
        self.redis = get_redis()

    @staticmethod
    def _pack(value: Any, *, category: str = "context") -> str:
        return json.dumps(
            {
                "value": value,
                "category": category,
                "updated_at": now_iso(),
            },
            ensure_ascii=False,
        )

    @staticmethod
    def _unpack(raw: Optional[str]) -> Optional[dict]:
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    def _working_key(self, session_id: str, key: str) -> str:
        return f"{self.WORKING_PREFIX}{session_id}:{key}"

    def _long_term_key(self, user_id: str, key: str) -> str:
        return f"{self.LONG_TERM_PREFIX}{user_id}:{key}"

    def set_working(self, session_id: str, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        ttl = int(ttl_seconds or self.WORKING_TTL_SECONDS)
        self.redis.setex(self._working_key(session_id, key), ttl, self._pack(value, category="working"))

    def get_working(self, session_id: str, key: str) -> Any:
        entry = self._unpack(self.redis.get(self._working_key(session_id, key)))
        if not entry:
            return None
        return entry.get("value")

    def list_working(self, session_id: str, limit: int = 8) -> Dict[str, Any]:
        pattern = f"{self.WORKING_PREFIX}{session_id}:*"
        rows: list[tuple[str, str, Any]] = []
        for full_key in self.redis.scan_iter(match=pattern):
            entry = self._unpack(self.redis.get(full_key))
            if not entry:
                continue
            key = str(full_key).split(":")[-1]
            rows.append((str(entry.get("updated_at", "")), key, entry.get("value")))

        rows.sort(key=lambda item: item[0])
        return {key: value for _, key, value in rows[-max(1, int(limit)):]}

    def set_long_term(self, user_id: str, key: str, value: Any, category: str = "context") -> None:
        self.redis.set(self._long_term_key(user_id, key), self._pack(value, category=category))

    def get_long_term(self, user_id: str, key: str) -> Any:
        entry = self._unpack(self.redis.get(self._long_term_key(user_id, key)))
        if not entry:
            return None
        return entry.get("value")

    def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        pattern = f"{self.LONG_TERM_PREFIX}{user_id}:*"
        preferences: list[tuple[str, str, Any]] = []
        for full_key in self.redis.scan_iter(match=pattern):
            entry = self._unpack(self.redis.get(full_key))
            if not entry or entry.get("category") != "preference":
                continue
            key = str(full_key).split(":")[-1]
            preferences.append((str(entry.get("updated_at", "")), key, entry.get("value")))

        preferences.sort(key=lambda item: item[0])
        return {key: value for _, key, value in preferences}

    def extract_and_store(self, user_id: str, session_id: str, user_input: str, agent_response: str) -> Dict[str, Any]:
        """Extract stable preferences/facts from conversation using low-cost rules."""
        if not str(user_id or "").strip():
            return {}

        text = str(user_input or "").strip()
        response = str(agent_response or "").strip()
        extracted: Dict[str, Any] = {}

        patterns = {
            "default_project": r"(?:默认)?项目(?:是|为|叫)?[：: ]*([A-Za-z0-9一-龥_-]{2,30})",
            "default_pipeline": r"(?:默认)?管道(?:是|为|叫)?[：: ]*([A-Za-z0-9一-龥_-]{2,30})",
            "default_station": r"(?:默认)?(?:泵站|站点)(?:是|为|叫)?[：: ]*([A-Za-z0-9一-龥_-]{2,30})",
        }
        for key, pattern in patterns.items():
            match = re.search(pattern, text)
            if match:
                extracted[key] = match.group(1)

        numeric_patterns = {
            "preferred_flow_rate": r"流量(?:是|为)?\s*(\d+(?:\.\d+)?)",
            "preferred_temperature": r"温度(?:是|为)?\s*(\d+(?:\.\d+)?)",
        }
        for key, pattern in numeric_patterns.items():
            match = re.search(pattern, text)
            if match:
                try:
                    extracted[key] = float(match.group(1))
                except ValueError:
                    continue

        if any(keyword in text for keyword in ("详细报告", "详细一点", "完整报告", "展开说明")):
            extracted["report_detail_level"] = "detailed"
        elif any(keyword in text for keyword in ("简要", "简洁", "摘要", "简单说")):
            extracted["report_detail_level"] = "concise"

        try:
            for key, value in extracted.items():
                self.set_long_term(user_id, key, value, category="preference")

            if response and any(keyword in response for keyword in ("建议", "推荐", "结论")):
                self.set_long_term(user_id, "last_recommendation", response[:500], category="insight")

            self.set_working(session_id, "last_preference_extract", extracted or {})
        except Exception as exc:  # noqa: BLE001
            logger.debug(f"Memory extraction skipped: {exc}")

        return extracted


_memory_manager: Optional[MemoryManager] = None


def get_memory_manager() -> MemoryManager:
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = MemoryManager()
    return _memory_manager

"""Context ranker for retrieved context chunks.

Ranks context-pack sections with lightweight deterministic heuristics:
- Prefer recency while keeping frequent entities stable.
- Prioritize high-signal hook/alert items.
- Keep output shape backward compatible (same keys, re-ordered lists).
"""

from __future__ import annotations

import json
import math
from typing import Any, Dict, List, Optional

from backend.services.context_weights import context_weights


class ContextRankerConfig:
    """Lightweight config holder for ranker parameters."""

    def __init__(
        self,
        recency_weight: float = 0.5,
        frequency_weight: float = 0.3,
        hook_bonus: float = 0.2,
        length_bonus_cap: float = 0.3,
        alert_critical_keywords: Optional[List[str]] = None,
        debug: bool = False,
    ):
        self.context_ranker_recency_weight = recency_weight
        self.context_ranker_frequency_weight = frequency_weight
        self.context_ranker_hook_bonus = hook_bonus
        self.context_ranker_length_bonus_cap = length_bonus_cap
        self.context_ranker_alert_critical_keywords = alert_critical_keywords or [
            "错误",
            "冲突",
            "矛盾",
            "警告",
            "严重",
            "critical",
            "error",
        ]
        self.context_ranker_debug = debug


class ContextRanker:
    """Rank context-pack sections with lightweight deterministic heuristics."""

    SUMMARY_HOOK_HINTS = ("?", "？", "悬念", "钩子", "反转", "冲突")

    def __init__(self, config: Optional[ContextRankerConfig] = None):
        self.config = config or ContextRankerConfig()

    def rank_pack(self, pack: Dict[str, Any], chapter: int) -> Dict[str, Any]:
        """Rank all sections in a context pack."""
        ranked = dict(pack)

        core = dict(ranked.get("core") or {})
        core["recent_summaries"] = self.rank_recent_summaries(
            core.get("recent_summaries") or [], chapter
        )
        core["recent_meta"] = self.rank_recent_meta(
            core.get("recent_meta") or [], chapter
        )
        ranked["core"] = core

        scene = dict(ranked.get("scene") or {})
        scene["appearing_characters"] = self.rank_appearances(
            scene.get("appearing_characters") or [], chapter
        )
        ranked["scene"] = scene

        ranked["story_skeleton"] = self.rank_story_skeleton(
            ranked.get("story_skeleton") or [], chapter
        )

        alerts = dict(ranked.get("alerts") or {})
        alerts["disambiguation_warnings"] = self.rank_alerts(
            alerts.get("disambiguation_warnings") or [], chapter
        )
        alerts["disambiguation_pending"] = self.rank_alerts(
            alerts.get("disambiguation_pending") or [], chapter
        )
        ranked["alerts"] = alerts

        meta = dict(ranked.get("meta") or {})
        meta.setdefault("context_contract_version", "v2")
        meta["ranker"] = {
            "enabled": True,
            "recency_weight": float(self.config.context_ranker_recency_weight),
            "frequency_weight": float(self.config.context_ranker_frequency_weight),
            "hook_bonus": float(self.config.context_ranker_hook_bonus),
        }
        ranked["meta"] = meta
        return ranked

    def rank_recent_summaries(
        self, items: List[Dict[str, Any]], current_chapter: int
    ) -> List[Dict[str, Any]]:
        """Rank recent chapter summaries by relevance."""
        scored = []
        for raw in items:
            item = dict(raw)
            chapter = self._as_int(item.get("chapter"))
            summary = str(item.get("summary") or "")

            recency = self._recency_score(chapter, current_chapter)
            frequency = self._length_score(summary)
            hook_bonus = (
                float(self.config.context_ranker_hook_bonus)
                if self._has_hook_hint(summary)
                else 0.0
            )
            score = self._combine_score(recency, frequency, hook_bonus)
            scored.append(self._with_debug_score(item, score, recency, frequency, hook_bonus))

        scored.sort(key=lambda row: row[0], reverse=True)
        return [row[1] for row in scored]

    def rank_recent_meta(
        self, items: List[Dict[str, Any]], current_chapter: int
    ) -> List[Dict[str, Any]]:
        """Rank recent meta items (hooks, notes) by relevance."""
        scored = []
        for raw in items:
            item = dict(raw)
            chapter = self._as_int(item.get("chapter"))
            hook = str(item.get("hook") or "")
            hook_bonus = (
                float(self.config.context_ranker_hook_bonus) if hook else 0.0
            )
            recency = self._recency_score(chapter, current_chapter)
            frequency = self._length_score(hook)
            score = self._combine_score(recency, frequency, hook_bonus)
            scored.append(self._with_debug_score(item, score, recency, frequency, hook_bonus))

        scored.sort(key=lambda row: row[0], reverse=True)
        return [row[1] for row in scored]

    def rank_appearances(
        self, items: List[Dict[str, Any]], current_chapter: int
    ) -> List[Dict[str, Any]]:
        """Rank character/item appearances by relevance."""
        scored = []
        for raw in items:
            item = dict(raw)
            last_chapter = self._as_int(
                item.get("last_chapter") or item.get("chapter")
            )
            total = self._as_int(item.get("total")) or 0
            warning_penalty = 0.15 if item.get("warning") else 0.0

            recency = self._recency_score(last_chapter, current_chapter)
            frequency = self._frequency_score(total)
            score = self._combine_score(recency, frequency, 0.0) - warning_penalty
            scored.append(
                self._with_debug_score(item, score, recency, frequency, -warning_penalty)
            )

        scored.sort(key=lambda row: row[0], reverse=True)
        return [row[1] for row in scored]

    def rank_story_skeleton(
        self, items: List[Dict[str, Any]], current_chapter: int
    ) -> List[Dict[str, Any]]:
        """Rank story skeleton/outline items by relevance."""
        scored = []
        for raw in items:
            item = dict(raw)
            chapter = self._as_int(item.get("chapter"))
            summary = str(item.get("summary") or "")
            recency = self._recency_score(chapter, current_chapter)
            frequency = self._length_score(summary)
            score = self._combine_score(recency, frequency, 0.0)
            scored.append(self._with_debug_score(item, score, recency, frequency, 0.0))

        scored.sort(key=lambda row: row[0], reverse=True)
        return [row[1] for row in scored]

    def rank_alerts(
        self, alerts: List[Any], current_chapter: int
    ) -> List[Any]:
        """Rank alerts/warnings by severity and recency."""
        scored = []
        keywords = tuple(self.config.context_ranker_alert_critical_keywords)

        for raw in alerts:
            if isinstance(raw, dict):
                item: Any = dict(raw)
                chapter = self._as_int(item.get("chapter"))
                text = str(
                    item.get("message")
                    or item.get("content")
                    or _json_safe(item)
                )
                severity = str(item.get("severity") or "").lower()
                critical_bonus = 0.3 if severity in {"critical", "high"} else 0.0
            else:
                item = raw
                chapter = None
                text = str(raw)
                critical_bonus = 0.0

            recency = self._recency_score(chapter, current_chapter)
            keyword_bonus = 0.3 if any(word and word in text for word in keywords) else 0.0
            score = recency + critical_bonus + keyword_bonus

            if isinstance(item, dict):
                scored.append(self._with_debug_score(item, score, recency, critical_bonus, keyword_bonus))
            else:
                scored.append((score, item))

        scored.sort(key=lambda row: row[0], reverse=True)
        return [row[1] for row in scored]

    def rank_generic_items(
        self,
        items: List[Dict[str, Any]],
        current_chapter: int,
        chapter_key: str = "chapter",
        text_key: str = "content",
    ) -> List[Dict[str, Any]]:
        """Generic ranking for arbitrary context items.

        Args:
            items: List of dict items to rank.
            current_chapter: Current chapter number for recency.
            chapter_key: Key for chapter number in items.
            text_key: Key for text content in items.
        """
        scored = []
        for raw in items:
            item = dict(raw)
            chapter = self._as_int(item.get(chapter_key))
            text = str(item.get(text_key) or "")
            recency = self._recency_score(chapter, current_chapter)
            frequency = self._length_score(text)
            hook_bonus = (
                float(self.config.context_ranker_hook_bonus)
                if self._has_hook_hint(text)
                else 0.0
            )
            score = self._combine_score(recency, frequency, hook_bonus)
            scored.append(self._with_debug_score(item, score, recency, frequency, hook_bonus))

        scored.sort(key=lambda row: row[0], reverse=True)
        return [row[1] for row in scored]

    def apply_entity_weights(
        self,
        items: List[Dict[str, Any]],
        entity_type_key: str = "type",
    ) -> List[Dict[str, Any]]:
        """Apply entity type weights to scored items.

        Items should already have a '_context_score' field from ranking.
        """
        scored = []
        for item in items:
            if not isinstance(item, dict):
                scored.append((0.0, item))
                continue

            base_score = item.get("_context_score", 0.5)
            entity_type = str(item.get(entity_type_key) or "")
            weight = context_weights.get_entity_weight(entity_type)
            adjusted = base_score * weight

            if self.config.context_ranker_debug:
                item["_context_score"] = round(adjusted, 6)
                detail = item.get("_context_score_detail", {})
                detail["entity_weight"] = round(weight, 6)
                item["_context_score_detail"] = detail

            scored.append((adjusted, item))

        scored.sort(key=lambda row: row[0], reverse=True)
        return [row[1] for row in scored]

    # ------------------------------------------------------------------
    # Scoring helpers
    # ------------------------------------------------------------------

    def _combine_score(self, recency: float, frequency: float, bonus: float) -> float:
        return (
            recency * float(self.config.context_ranker_recency_weight)
            + frequency * float(self.config.context_ranker_frequency_weight)
            + bonus
        )

    def chapter_distance_decay(self, distance: int) -> float:
        """Logarithmic chapter-distance decay.

        Args:
            distance: Chapter distance (0 = current, 1 = previous, etc.)

        Returns:
            Weight multiplier in (0, 1]

        Formula: 1 / log2(distance + 2)
        Examples:
            distance=0 -> 1.0
            distance=1 -> 0.631
            distance=3 -> 0.431
            distance=10 -> 0.278
        """
        return 1.0 / math.log2(max(0, distance) + 2)

    def _recency_score(
        self, source_chapter: Optional[int], current_chapter: int
    ) -> float:
        if source_chapter is None:
            return 0.0
        gap = max(0, int(current_chapter) - int(source_chapter))
        return self.chapter_distance_decay(gap)

    def _frequency_score(self, total: int) -> float:
        if total <= 0:
            return 0.0
        # Log scale to avoid over-favoring very frequent entities
        return min(1.0, math.log(1.0 + float(total)) / math.log(11.0))

    def _length_score(self, text: str) -> float:
        if not text:
            return 0.0
        ratio = min(len(text) / 1200.0, 1.0)
        cap = float(self.config.context_ranker_length_bonus_cap)
        return ratio * cap

    def _has_hook_hint(self, text: str) -> bool:
        return any(token in text for token in self.SUMMARY_HOOK_HINTS)

    def _as_int(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _with_debug_score(
        self,
        item: Dict[str, Any],
        score: float,
        recency: float,
        frequency: float,
        bonus: float,
    ) -> tuple[float, Dict[str, Any]]:
        if getattr(self.config, "context_ranker_debug", False):
            item["_context_score"] = round(score, 6)
            item["_context_score_detail"] = {
                "recency": round(recency, 6),
                "frequency": round(frequency, 6),
                "bonus": round(bonus, 6),
            }
        return score, item


def _json_safe(value: Any) -> str:
    try:
        import json

        return json.dumps(value, ensure_ascii=False)
    except json.JSONDecodeError:
        return str(value)


# Singleton instance
context_ranker = ContextRanker()

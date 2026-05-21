"""Strand classifier service - classify chapter content into Quest/Fire/Constellation.

Strand definitions:
- Quest (主线剧情): ideal 60%
- Fire (感情线): ideal 20%
- Constellation (世界观扩展): ideal 20%

Uses existing tables + JSON fields for storage. No model modifications.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain import Chapter, DraftVersion
from backend.core.services.ai.ai_service import AIService

logger = logging.getLogger(__name__)


@dataclass
class StrandClassification:
    """Result of classifying a chapter into strands."""

    chapter_id: int
    quest: float = 0.0
    fire: float = 0.0
    constellation: float = 0.0
    dominant: str = "quest"
    confidence: float = 0.0
    method: str = "heuristic"
    keywords_found: dict[str, list[str]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Normalize ratios and determine dominant strand."""
        total = self.quest + self.fire + self.constellation
        if total > 0:
            self.quest = round(self.quest / total, 3)
            self.fire = round(self.fire / total, 3)
            self.constellation = round(self.constellation / total, 3)
        # Ensure sum = 1.0
        remainder = 1.0 - (self.quest + self.fire + self.constellation)
        if remainder != 0:
            self.quest = round(self.quest + remainder, 3)

        ratios = {
            "quest": self.quest,
            "fire": self.fire,
            "constellation": self.constellation,
        }
        self.dominant = max(ratios, key=ratios.get)

    def to_dict(self) -> dict:
        """Serialize to dict for JSON storage."""
        return {
            "chapter_id": self.chapter_id,
            "quest": self.quest,
            "fire": self.fire,
            "constellation": self.constellation,
            "dominant": self.dominant,
            "confidence": self.confidence,
            "method": self.method,
            "keywords_found": self.keywords_found,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "StrandClassification":
        """Deserialize from dict."""
        return cls(
            chapter_id=data.get("chapter_id", 0),
            quest=data.get("quest", 0.0),
            fire=data.get("fire", 0.0),
            constellation=data.get("constellation", 0.0),
            dominant=data.get("dominant", "quest"),
            confidence=data.get("confidence", 0.0),
            method=data.get("method", "heuristic"),
            keywords_found=data.get("keywords_found", {}),
        )


class StrandClassifier:
    """Classify chapter content into Quest/Fire/Constellation strands.

    Supports both heuristic (fast, no AI) and AI-powered classification.
    Results are stored in chapter.summary JSON field or returned directly.
    """

    # Heuristic keyword dictionaries
    QUEST_KEYWORDS = [
        "任务", "目标", "主线", "剧情", "推进", "完成", "达成", "使命",
        "quest", "mission", "goal", "objective", "plot", "主线任务",
        "冒险", "探索", "追寻", "寻找", "突破", "晋级", "修炼", "战斗准备",
        "计划", "布局", "谋划", "策略", "行动", "执行", "调查", "追踪",
        "任务线", "主线剧情", "核心冲突", "故事推进",
    ]

    FIRE_KEYWORDS = [
        "感情", "情感", "爱情", "心动", "喜欢", "爱", "思念", "牵挂",
        "fire", "emotion", "love", "romance", "feeling", "heart",
        "表白", "约会", "分离", "重逢", "误会", "和解", "吃醋", "嫉妒",
        "温柔", "拥抱", "亲吻", "守护", "陪伴", "羁绊", "缘分",
        "心动", "情愫", "暧昧", "深情", "痴情", "感情线", "人物关系",
    ]

    CONSTELLATION_KEYWORDS = [
        "世界", "设定", "背景", "势力", "门派", "家族", "规则", "体系",
        "constellation", "world", "setting", "background", "faction",
        "世界观", "世界设定", "背景介绍", "势力分布", "地图", "历史",
        "传说", "神话", "秘闻", "典故", "风俗", "文化", "制度",
        "等级", "境界", "功法", "法宝", "丹药", "灵石", "资源",
        "天地", "宇宙", "星辰", "大道", "法则", "天道", "命运",
    ]

    def __init__(self, ai_service: Optional[AIService] = None) -> None:
        self.ai_service = ai_service

    async def classify_chapter(
        self,
        chapter_id: int,
        db: AsyncSession,
        use_ai: bool = False,
    ) -> StrandClassification:
        """Classify a single chapter into strands.

        Args:
            chapter_id: The chapter ID to classify.
            db: Async database session.
            use_ai: If True, use AI-powered classification; otherwise heuristic.

        Returns:
            StrandClassification with ratios and dominant strand.
        """
        content = await self._get_chapter_content(chapter_id, db)
        if not content:
            return StrandClassification(chapter_id=chapter_id, confidence=0.0)

        if use_ai and self.ai_service:
            return await self._classify_with_ai(chapter_id, content)
        return self._classify_heuristic(chapter_id, content)

    async def classify_chapters(
        self,
        chapter_ids: list[int],
        db: AsyncSession,
        use_ai: bool = False,
    ) -> list[StrandClassification]:
        """Classify multiple chapters.

        Args:
            chapter_ids: List of chapter IDs.
            db: Async database session.
            use_ai: If True, use AI-powered classification.

        Returns:
            List of StrandClassification results.
        """
        results = []
        for cid in chapter_ids:
            result = await self.classify_chapter(cid, db, use_ai=use_ai)
            results.append(result)
        return results

    def _classify_heuristic(self, chapter_id: int, content: str) -> StrandClassification:
        """Fast heuristic classification using keyword matching."""
        text = content.lower()

        quest_matches = self._count_keywords(text, self.QUEST_KEYWORDS)
        fire_matches = self._count_keywords(text, self.FIRE_KEYWORDS)
        constellation_matches = self._count_keywords(text, self.CONSTELLATION_KEYWORDS)

        # Weight by keyword density + base score
        quest_score = quest_matches * 1.5 + 3
        fire_score = fire_matches * 1.5 + 1
        constellation_score = constellation_matches * 1.5 + 1

        # Find matched keywords for transparency
        keywords_found = {
            "quest": self._find_matched_keywords(text, self.QUEST_KEYWORDS)[:5],
            "fire": self._find_matched_keywords(text, self.FIRE_KEYWORDS)[:5],
            "constellation": self._find_matched_keywords(text, self.CONSTELLATION_KEYWORDS)[:5],
        }

        total = quest_score + fire_score + constellation_score
        confidence = min(0.95, 0.4 + (total / 50))

        return StrandClassification(
            chapter_id=chapter_id,
            quest=quest_score,
            fire=fire_score,
            constellation=constellation_score,
            confidence=round(confidence, 3),
            method="heuristic",
            keywords_found=keywords_found,
        )

    async def _classify_with_ai(
        self, chapter_id: int, content: str
    ) -> StrandClassification:
        """AI-powered classification using MiniMax API."""
        if not self.ai_service:
            return self._classify_heuristic(chapter_id, content)

        prompt = f"""分析以下网络小说章节，判断三种故事线的占比：

章节内容：
{content[:3000]}

三种故事线定义：
1. Quest（主线剧情）：主角追求目标、完成任务、推进核心冲突的内容
2. Fire（感情线）：角色情感发展、关系变化、人物羁绊的内容
3. Constellation（世界观扩展）：背景设定、势力介绍、规则体系、世界探索的内容

请以JSON格式返回（不要包含任何其他文字）：
{{
    "quest": 0-1之间的小数,
    "fire": 0-1之间的小数,
    "constellation": 0-1之间的小数,
    "confidence": 0-1之间的小数,
    "reasoning": "简要分析说明"
}}"""

        try:
            response = await self.ai_service.generate(
                prompt=prompt,
                system_prompt="你是一位专业的网络小说分析师，擅长分析章节的故事线构成。",
                temperature=0.3,
            )

            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                return StrandClassification(
                    chapter_id=chapter_id,
                    quest=parsed.get("quest", 0.6),
                    fire=parsed.get("fire", 0.2),
                    constellation=parsed.get("constellation", 0.2),
                    confidence=parsed.get("confidence", 0.8),
                    method="ai",
                )
        except Exception as e:
            logger.warning("AI strand classification failed, falling back to heuristic: %s", e)

        # Fallback to heuristic
        return self._classify_heuristic(chapter_id, content)

    async def _get_chapter_content(
        self, chapter_id: int, db: AsyncSession
    ) -> str:
        """Get chapter content from draft or summary."""
        result = await db.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .order_by(DraftVersion.version_number.desc())
        )
        draft = result.scalar_one_or_none()
        if draft and draft.content:
            return draft.content

        result = await db.execute(
            select(Chapter).where(Chapter.id == chapter_id)
        )
        chapter = result.scalar_one_or_none()
        return chapter.summary or "" if chapter else ""

    @staticmethod
    def _count_keywords(text: str, keywords: list[str]) -> int:
        """Count total occurrences of keywords in text."""
        return sum(text.count(kw.lower()) for kw in keywords)

    @staticmethod
    def _find_matched_keywords(text: str, keywords: list[str]) -> list[str]:
        """Find which keywords matched in the text."""
        matched = []
        for kw in keywords:
            if kw.lower() in text:
                matched.append(kw)
        return matched

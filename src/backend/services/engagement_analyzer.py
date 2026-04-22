# -*- coding: utf-8 -*-
"""
Engagement Analyzer Service

Analyzes chapter content for reader engagement metrics:
- Cool-point detection (爽点检测): satisfying moments, power displays, comeuppance
- Micro-fulfillment detection (微兑现检测): small promises kept, minor rewards
- Retention prediction (留存预测): estimated reader retention based on content features

Uses keyword heuristics + structural analysis. Stores results as JSON.
"""

import re
import json
import math
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum


class CoolPointType(str, Enum):
    """Types of cool/satisfying moments."""
    FACE_SLAP = "face_slap"           # 打脸
    POWER_DISPLAY = "power_display"   # 展现实力
    REVERSAL = "reversal"             # 反转
    REWARD = "reward"                 # 获得奖励/宝物
    RECOGNITION = "recognition"       # 获得认可/震惊他人
    BREAKTHROUGH = "breakthrough"     # 突破/升级
    ROMANCE = "romance"               # 感情线进展
    COMEDY = "comedy"                 # 轻松幽默


class FulfillmentSize(str, Enum):
    """Size of fulfillment moment."""
    MICRO = "micro"       # 微兑现 (small promise kept)
    MINOR = "minor"       # 小兑现
    MAJOR = "major"       # 大兑现
    CLIMAX = "climax"     # 终极兑现


@dataclass
class CoolPoint:
    """A detected cool/satisfying moment."""
    type: CoolPointType
    text: str
    intensity: float  # 0.0 - 1.0
    position: float   # relative position in chapter (0.0 - 1.0)
    context: str = ""


@dataclass
class Fulfillment:
    """A detected fulfillment moment."""
    size: FulfillmentSize
    text: str
    position: float   # relative position in chapter (0.0 - 1.0)
    related_promise: Optional[str] = None
    context: str = ""


@dataclass
class EngagementResult:
    """Complete engagement analysis result."""
    chapter_id: int
    word_count: int

    # Cool points
    cool_points: List[CoolPoint]
    cool_point_count: int
    cool_point_density: float  # per 1000 words
    cool_point_score: float    # 0.0 - 100.0

    # Fulfillments
    fulfillments: List[Fulfillment]
    fulfillment_count: int
    fulfillment_score: float   # 0.0 - 100.0

    # Retention prediction
    predicted_retention: float  # 0.0 - 100.0 (estimated % readers continuing)
    retention_factors: Dict[str, float]

    # Overall
    overall_engagement_score: float  # 0.0 - 100.0
    pacing_analysis: Dict[str, Any]
    suggestions: List[str]


# ============================================================================
# Keyword dictionaries
# ============================================================================

COOL_POINT_KEYWORDS = {
    CoolPointType.FACE_SLAP: {
        "high": ["打脸", "啪啪", "狠狠", "碾压", "秒杀", "镇压", "横扫", "不堪一击"],
        "medium": ["嘲讽", "羞辱", "反击", "回敬", "以其人之道", "自取其辱", "丢人现眼"],
        "low": ["不屑", "轻蔑", "冷笑", "讽刺", "挖苦"],
    },
    CoolPointType.POWER_DISPLAY: {
        "high": ["恐怖", "惊天", "毁天灭地", "排山倒海", "无可匹敌", "无敌"],
        "medium": ["强大", "惊人", "震撼", "恐怖如斯", "深不可测", "高深莫测"],
        "low": ["厉害", "不错", "有两下子", "出人意料"],
    },
    CoolPointType.REVERSAL: {
        "high": ["逆转", "翻盘", "绝境逢生", "柳暗花明", "峰回路转", "惊天逆转"],
        "medium": ["没想到", "竟然", "原来如此", "出乎意料", "出人意料", "意想不到"],
        "low": ["转折", "变化", "不同", "改观"],
    },
    CoolPointType.REWARD: {
        "high": ["神器", "至宝", "绝世", "逆天", "无价之宝", "天大机缘"],
        "medium": ["宝物", "奖励", "收获", "机缘", "奇遇", "传承"],
        "low": ["得到", "获得", "捡到", "发现"],
    },
    CoolPointType.RECOGNITION: {
        "high": ["震惊", "骇然", "不可思议", "难以置信", "目瞪口呆", "全场哗然", "轰动"],
        "medium": ["惊讶", "赞叹", "佩服", "刮目相看", "另眼相看", "认可"],
        "low": ["注意", "关注", "好奇", "感兴趣"],
    },
    CoolPointType.BREAKTHROUGH: {
        "high": ["突破", "晋级", "飞升", "顿悟", "觉醒", "蜕变", "脱胎换骨"],
        "medium": ["精进", "提升", "进步", "增长", "增强", "更上一层楼"],
        "low": ["变化", "改善", "好转"],
    },
    CoolPointType.ROMANCE: {
        "high": ["心动", "深情", "表白", "定情", "私定终身", "非君不嫁", "非卿不娶"],
        "medium": ["暧昧", "情愫", "好感", "喜欢", "思念", "牵挂"],
        "low": ["注意", "在意", "关心", "好感"],
    },
    CoolPointType.COMEDY: {
        "high": ["爆笑", "捧腹", "笑喷", "忍俊不禁", "啼笑皆非", "哭笑不得"],
        "medium": ["好笑", "有趣", "幽默", "风趣", "诙谐", "调侃"],
        "low": ["轻松", "愉快", "开心"],
    },
}

FULFILLMENT_KEYWORDS = {
    FulfillmentSize.MICRO: {
        "patterns": [
            r"果然.{0,20}[如|像].{0,10}所说",
            r"正如.{0,10}[预料|所想|所料]",
            r"[果然|果真].{0,15}[实现|应验|发生]",
        ],
        "weight": 0.2,
    },
    FulfillmentSize.MINOR: {
        "patterns": [
            r"[终于|总算].{0,30}[得到|获得|完成|实现]",
            r"[承诺|答应].{0,20}[兑现|履行|做到]",
            r"[目标|目的].{0,20}[达成|达到|实现]",
        ],
        "weight": 0.5,
    },
    FulfillmentSize.MAJOR: {
        "patterns": [
            r"[多年|长久以来].{0,30}[心愿|梦想|目标].{0,20}[实现|达成]",
            r"[誓言|承诺].{0,30}[终于|最终].{0,20}[兑现|实现]",
            r"[历尽|经过].{0,30}[终于|最终].{0,30}[成功]",
        ],
        "weight": 0.8,
    },
    FulfillmentSize.CLIMAX: {
        "patterns": [
            r"[终极|最终|最后].{0,20}[对决|决战|一战].{0,30}[胜利|获胜]",
            r"[大仇|血仇].{0,20}[得报|已报]",
            r"[宿命|命运].{0,30}[终结|结束|改变]",
        ],
        "weight": 1.0,
    },
}

# Retention factor keywords
RETENTION_FACTORS = {
    "opening_strength": {
        "positive": ["开局", "第一章", "开篇", "序幕", "引子"],
        "weight": 0.15,
    },
    "conflict_density": {
        "positive": ["冲突", "对抗", "对决", "战斗", "争执", "博弈"],
        "weight": 0.20,
    },
    "suspense_density": {
        "positive": ["悬念", "谜团", "未知", "危机", "危险", "杀机"],
        "weight": 0.20,
    },
    "emotional_resonance": {
        "positive": ["感动", "震撼", "心疼", "共鸣", "代入", "沉浸"],
        "weight": 0.15,
    },
    "pacing": {
        "fast_markers": ["突然", "瞬间", "立刻", "马上", "立即", "随即"],
        "slow_markers": ["缓缓", "慢慢", "渐渐", "逐步", "逐渐", "徐徐"],
        "weight": 0.15,
    },
    "ending_hook": {
        "positive": ["未完待续", "且听下回分解", "究竟", "到底", "接下来"],
        "weight": 0.15,
    },
}


class EngagementAnalyzer:
    """Analyzes reader engagement in Chinese web novel chapters."""

    def __init__(self):
        self.cool_point_keywords = COOL_POINT_KEYWORDS
        self.fulfillment_patterns = FULFILLMENT_KEYWORDS
        self.retention_factors = RETENTION_FACTORS

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze(self, chapter_id: int, content: str) -> EngagementResult:
        """
        Perform full engagement analysis on chapter content.

        Args:
            chapter_id: Chapter ID
            content: Chapter text content

        Returns:
            EngagementResult with all metrics
        """
        if not content or not content.strip():
            return self._empty_result(chapter_id)

        clean_content = self._clean_content(content)
        word_count = self._count_chinese_chars(clean_content)

        # Detect cool points
        cool_points = self._detect_cool_points(clean_content)
        cool_point_density = len(cool_points) / max(word_count / 1000, 1)
        cool_point_score = self._calculate_cool_point_score(cool_points, word_count)

        # Detect fulfillments
        fulfillments = self._detect_fulfillments(clean_content)
        fulfillment_score = self._calculate_fulfillment_score(fulfillments)

        # Predict retention
        retention, factors = self._predict_retention(clean_content, cool_points, fulfillments)

        # Pacing analysis
        pacing = self._analyze_pacing(clean_content)

        # Overall score
        overall = self._calculate_overall_score(
            cool_point_score, fulfillment_score, retention, pacing
        )

        suggestions = self._generate_suggestions(
            cool_point_density, fulfillment_score, retention, pacing
        )

        return EngagementResult(
            chapter_id=chapter_id,
            word_count=word_count,
            cool_points=cool_points,
            cool_point_count=len(cool_points),
            cool_point_density=round(cool_point_density, 2),
            cool_point_score=round(cool_point_score, 1),
            fulfillments=fulfillments,
            fulfillment_count=len(fulfillments),
            fulfillment_score=round(fulfillment_score, 1),
            predicted_retention=round(retention, 1),
            retention_factors={k: round(v, 2) for k, v in factors.items()},
            overall_engagement_score=round(overall, 1),
            pacing_analysis=pacing,
            suggestions=suggestions,
        )

    def analyze_quick(self, chapter_id: int, content: str) -> Dict[str, Any]:
        """Quick analysis returning JSON-serializable result."""
        result = self.analyze(chapter_id, content)
        return self._serialize_result(result)

    # ------------------------------------------------------------------
    # Cool Point Detection
    # ------------------------------------------------------------------

    def _detect_cool_points(self, content: str) -> List[CoolPoint]:
        """Detect all cool points in content."""
        cool_points = []
        total_len = len(content)

        for cp_type, levels in self.cool_point_keywords.items():
            for level, keywords in levels.items():
                intensity_base = {"high": 0.9, "medium": 0.6, "low": 0.3}[level]
                for keyword in keywords:
                    for match in re.finditer(re.escape(keyword), content):
                        pos = match.start() / max(total_len, 1)
                        context = self._extract_context(content, match.start())
                        cool_points.append(CoolPoint(
                            type=cp_type,
                            text=keyword,
                            intensity=intensity_base,
                            position=round(pos, 2),
                            context=context,
                        ))

        # Sort by position
        cool_points.sort(key=lambda x: x.position)
        return cool_points

    def _calculate_cool_point_score(self, cool_points: List[CoolPoint], word_count: int) -> float:
        """Calculate cool point score (0.0 - 100.0)."""
        if not cool_points or word_count == 0:
            return 0.0

        # Base score from intensity sum
        total_intensity = sum(cp.intensity for cp in cool_points)
        intensity_score = min(total_intensity * 10, 50)

        # Density bonus
        density = len(cool_points) / (word_count / 1000)
        density_score = min(density * 5, 20)

        # Distribution bonus (evenly distributed is better)
        positions = [cp.position for cp in cool_points]
        distribution_score = self._calculate_distribution_score(positions)

        # Type diversity bonus
        unique_types = len(set(cp.type for cp in cool_points))
        diversity_score = unique_types * 3

        return min(intensity_score + density_score + distribution_score + diversity_score, 100)

    # ------------------------------------------------------------------
    # Fulfillment Detection
    # ------------------------------------------------------------------

    def _detect_fulfillments(self, content: str) -> List[Fulfillment]:
        """Detect fulfillment moments in content."""
        fulfillments = []
        total_len = len(content)

        for size, config in self.fulfillment_patterns.items():
            weight = config["weight"]
            for pattern in config["patterns"]:
                for match in re.finditer(pattern, content):
                    pos = match.start() / max(total_len, 1)
                    context = self._extract_context(content, match.start())
                    fulfillments.append(Fulfillment(
                        size=size,
                        text=match.group()[:50],
                        position=round(pos, 2),
                        context=context,
                    ))

        # Sort by position
        fulfillments.sort(key=lambda x: x.position)
        return fulfillments

    def _calculate_fulfillment_score(self, fulfillments: List[Fulfillment]) -> float:
        """Calculate fulfillment score (0.0 - 100.0)."""
        if not fulfillments:
            return 0.0

        # Weight by size
        size_weights = {
            FulfillmentSize.MICRO: 0.2,
            FulfillmentSize.MINOR: 0.5,
            FulfillmentSize.MAJOR: 0.8,
            FulfillmentSize.CLIMAX: 1.0,
        }

        total_weight = sum(size_weights.get(f.size, 0.2) for f in fulfillments)
        # Scale: 5 minor fulfillments = 50 points, with diminishing returns
        score = min(total_weight * 15, 80)

        # Distribution bonus
        positions = [f.position for f in fulfillments]
        distribution_score = self._calculate_distribution_score(positions) * 0.5

        return min(score + distribution_score, 100)

    # ------------------------------------------------------------------
    # Retention Prediction
    # ------------------------------------------------------------------

    def _predict_retention(
        self,
        content: str,
        cool_points: List[CoolPoint],
        fulfillments: List[Fulfillment],
    ) -> Tuple[float, Dict[str, float]]:
        """
        Predict reader retention percentage.

        Returns:
            Tuple of (retention_pct, factor_scores)
        """
        factors = {}

        # Conflict density factor
        conflict_keywords = self.retention_factors["conflict_density"]["positive"]
        conflict_count = sum(content.count(kw) for kw in conflict_keywords)
        conflict_score = min(conflict_count / 5, 1.0)
        factors["conflict_density"] = conflict_score

        # Suspense density factor
        suspense_keywords = self.retention_factors["suspense_density"]["positive"]
        suspense_count = sum(content.count(kw) for kw in suspense_keywords)
        suspense_score = min(suspense_count / 5, 1.0)
        factors["suspense_density"] = suspense_score

        # Emotional resonance
        emotional_keywords = self.retention_factors["emotional_resonance"]["positive"]
        emotional_count = sum(content.count(kw) for kw in emotional_keywords)
        emotional_score = min(emotional_count / 3, 1.0)
        factors["emotional_resonance"] = emotional_score

        # Pacing factor
        fast_markers = self.retention_factors["pacing"]["fast_markers"]
        slow_markers = self.retention_factors["pacing"]["slow_markers"]
        fast_count = sum(content.count(kw) for kw in fast_markers)
        slow_count = sum(content.count(kw) for kw in slow_markers)
        if fast_count + slow_count > 0:
            pacing_ratio = fast_count / (fast_count + slow_count)
            pacing_score = 0.3 + pacing_ratio * 0.7  # balanced is good
        else:
            pacing_score = 0.5
        factors["pacing"] = pacing_score

        # Ending hook factor
        ending = content[-300:] if len(content) > 300 else content
        ending_keywords = self.retention_factors["ending_hook"]["positive"]
        ending_count = sum(ending.count(kw) for kw in ending_keywords)
        question_count = ending.count('？') + ending.count('?')
        ending_score = min((ending_count + question_count * 0.5) / 3, 1.0)
        factors["ending_hook"] = ending_score

        # Cool point factor
        cool_score = min(len(cool_points) / 5, 1.0)
        factors["cool_points"] = cool_score

        # Fulfillment factor
        fulfillment_score = min(len(fulfillments) / 3, 1.0)
        factors["fulfillment"] = fulfillment_score

        # Calculate weighted retention
        weights = {
            "conflict_density": 0.15,
            "suspense_density": 0.20,
            "emotional_resonance": 0.10,
            "pacing": 0.15,
            "ending_hook": 0.20,
            "cool_points": 0.10,
            "fulfillment": 0.10,
        }

        retention = sum(factors.get(k, 0) * w for k, w in weights.items()) * 100
        return min(retention, 100.0), factors

    # ------------------------------------------------------------------
    # Pacing Analysis
    # ------------------------------------------------------------------

    def _analyze_pacing(self, content: str) -> Dict[str, Any]:
        """Analyze chapter pacing."""
        paragraphs = [p for p in content.split('\n') if p.strip()]
        if not paragraphs:
            return {"pace": "unknown", "paragraph_count": 0}

        # Paragraph length variation
        lengths = [len(p) for p in paragraphs]
        avg_length = sum(lengths) / len(lengths)
        variance = sum((l - avg_length) ** 2 for l in lengths) / len(lengths)
        std_dev = math.sqrt(variance)

        # Short paragraph ratio (action/dialogue indicator)
        short_para_ratio = sum(1 for l in lengths if l < 50) / len(lengths)

        # Dialogue ratio
        dialogue_chars = content.count('"') + content.count('"') + content.count('"')
        dialogue_ratio = dialogue_chars / max(len(content), 1)

        # Action markers
        fast_markers = sum(content.count(kw) for kw in RETENTION_FACTORS["pacing"]["fast_markers"])
        slow_markers = sum(content.count(kw) for kw in RETENTION_FACTORS["pacing"]["slow_markers"])

        # Determine pace
        if short_para_ratio > 0.4 or fast_markers > slow_markers * 2:
            pace = "fast"
        elif slow_markers > fast_markers * 2 or avg_length > 200:
            pace = "slow"
        else:
            pace = "moderate"

        return {
            "pace": pace,
            "paragraph_count": len(paragraphs),
            "avg_paragraph_length": round(avg_length, 1),
            "short_paragraph_ratio": round(short_para_ratio, 2),
            "dialogue_ratio": round(dialogue_ratio, 3),
            "fast_markers": fast_markers,
            "slow_markers": slow_markers,
            "length_variance": round(std_dev, 1),
        }

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def _calculate_overall_score(
        self,
        cool_point_score: float,
        fulfillment_score: float,
        retention: float,
        pacing: Dict[str, Any],
    ) -> float:
        """Calculate overall engagement score."""
        # Weighted combination
        score = (
            cool_point_score * 0.30 +
            fulfillment_score * 0.20 +
            retention * 0.40 +
            (20 if pacing["pace"] == "moderate" else 15 if pacing["pace"] == "fast" else 10)
        )
        return min(score, 100.0)

    def _calculate_distribution_score(self, positions: List[float]) -> float:
        """Calculate score for even distribution of events."""
        if len(positions) < 2:
            return 5.0

        # Ideal: events spread across beginning, middle, end
        has_beginning = any(p < 0.33 for p in positions)
        has_middle = any(0.33 <= p < 0.67 for p in positions)
        has_end = any(p >= 0.67 for p in positions)

        coverage = sum([has_beginning, has_middle, has_end])
        return coverage * 5.0  # up to 15 points

    # ------------------------------------------------------------------
    # Suggestions
    # ------------------------------------------------------------------

    def _generate_suggestions(
        self,
        cool_point_density: float,
        fulfillment_score: float,
        retention: float,
        pacing: Dict[str, Any],
    ) -> List[str]:
        """Generate improvement suggestions."""
        suggestions = []

        if cool_point_density < 1.0:
            suggestions.append(
                f"爽点密度偏低（{cool_point_density:.1f}/千字）：建议增加打脸、展现实力、"
                "获得宝物等爽点场景，提升阅读快感。"
            )
        elif cool_point_density > 8.0:
            suggestions.append(
                f"爽点密度过高（{cool_point_density:.1f}/千字）：可能导致审美疲劳，"
                "建议适当控制，保持爽点的稀缺性和冲击力。"
            )

        if fulfillment_score < 20:
            suggestions.append(
                "微兑现不足：读者需要看到承诺的逐步兑现，建议增加小目标的达成场景。"
            )

        if retention < 50:
            suggestions.append(
                f"预测留存率较低（{retention:.1f}%）：建议加强悬念设置和结尾钩子，"
                "提升读者继续阅读的欲望。"
            )

        if pacing["pace"] == "slow":
            suggestions.append(
                "节奏偏慢：建议增加对话、动作描写，或使用更短的段落来提升节奏感。"
            )
        elif pacing["pace"] == "fast" and retention < 60:
            suggestions.append(
                "节奏过快但留存不高：可能缺乏情感铺垫，建议适当放慢节奏增加代入感。"
            )

        if not suggestions:
            suggestions.append("本章 engagement 表现良好，继续保持当前节奏和爽点布局。")

        return suggestions

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _clean_content(self, content: str) -> str:
        """Clean content for analysis."""
        content = re.sub(r'\s+', ' ', content)
        content = re.sub(r'[#*`_\[\]]', '', content)
        return content.strip()

    def _count_chinese_chars(self, content: str) -> int:
        """Count Chinese characters in content."""
        return len(re.findall(r'[\u4e00-\u9fff]', content))

    def _extract_context(self, content: str, pos: int, radius: int = 40) -> str:
        """Extract surrounding context."""
        start = max(0, pos - radius)
        end = min(len(content), pos + radius)
        return content[start:end]

    def _empty_result(self, chapter_id: int) -> EngagementResult:
        """Return empty result."""
        return EngagementResult(
            chapter_id=chapter_id,
            word_count=0,
            cool_points=[],
            cool_point_count=0,
            cool_point_density=0.0,
            cool_point_score=0.0,
            fulfillments=[],
            fulfillment_count=0,
            fulfillment_score=0.0,
            predicted_retention=0.0,
            retention_factors={},
            overall_engagement_score=0.0,
            pacing_analysis={"pace": "unknown"},
            suggestions=["章节内容为空，无法分析 engagement。"],
        )

    def _serialize_result(self, result: EngagementResult) -> Dict[str, Any]:
        """Serialize to JSON-compatible dict."""
        return {
            "chapter_id": result.chapter_id,
            "word_count": result.word_count,
            "cool_points": [
                {
                    "type": cp.type.value,
                    "text": cp.text,
                    "intensity": round(cp.intensity, 2),
                    "position": cp.position,
                    "context": cp.context,
                }
                for cp in result.cool_points
            ],
            "cool_point_count": result.cool_point_count,
            "cool_point_density": result.cool_point_density,
            "cool_point_score": result.cool_point_score,
            "fulfillments": [
                {
                    "size": f.size.value,
                    "text": f.text,
                    "position": f.position,
                    "context": f.context,
                }
                for f in result.fulfillments
            ],
            "fulfillment_count": result.fulfillment_count,
            "fulfillment_score": result.fulfillment_score,
            "predicted_retention": result.predicted_retention,
            "retention_factors": result.retention_factors,
            "overall_engagement_score": result.overall_engagement_score,
            "pacing_analysis": result.pacing_analysis,
            "suggestions": result.suggestions,
        }


# Module-level singleton
engagement_analyzer = EngagementAnalyzer()

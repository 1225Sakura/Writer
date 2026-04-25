"""StyleAgent — 风格指纹分析与文笔风格调节 Agent.

提供四项核心能力：
1. 风格指纹分析：分析文本的句式长度、词汇偏好、修辞密度、情感倾向等
2. AI 深度分析：利用 AI 进行超越规则的深层风格特征提取
3. 文笔风格调节：支持预设风格（江南/卡夫卡/加缪/默认/自定义）
4. 风格迁移建议：给出如何将文本转换为目标风格的具体建议
5. 风格一致性检查：检测章节间的风格漂移
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

from .base import AgentContext, AgentResult, BaseAgent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 预设文笔风格定义
# ---------------------------------------------------------------------------

PRESET_STYLES: dict[str, dict[str, str]] = {
    "default": {
        "name": "默认",
        "description": "平实流畅，兼顾叙事效率与文学性",
        "traits": "句式中等长度，词汇通用，修辞适度，情感表达自然",
    },
    "江南": {
        "name": "江南",
        "description": "细腻婉约，意象丰富，情感内敛而深沉",
        "traits": "句式偏长且富有层次，多用比喻与通感，词汇精致，情感含蓄克制，画面感强",
    },
    "卡夫卡": {
        "name": "卡夫卡",
        "description": "荒诞疏离，冷静客观，充满隐喻与压迫感",
        "traits": "句式冗长缠绕，词汇冷峻抽象，修辞以隐喻为主，情感压抑淡漠，视角疏离",
    },
    "加缪": {
        "name": "加缪",
        "description": "简洁冷峻，存在主义哲思，白描中见深度",
        "traits": "句式短促有力，词汇精准克制，修辞极简，情感冷静疏离，充满存在主义追问",
    },
    "custom": {
        "name": "自定义",
        "description": "用户自定义风格",
        "traits": "由用户自行定义风格特征",
    },
}


# ---------------------------------------------------------------------------
# 风格分析数据模型
# ---------------------------------------------------------------------------

@dataclass
class SentenceMetrics:
    """句子层面指标."""

    avg_length: float = 0.0
    max_length: int = 0
    min_length: int = 0
    variance: float = 0.0
    long_sentence_ratio: float = 0.0  # 超过 30 字的句子占比
    short_sentence_ratio: float = 0.0  # 少于 10 字的句子占比


@dataclass
class VocabularyMetrics:
    """词汇层面指标."""

    total_words: int = 0
    unique_words: int = 0
    diversity_index: float = 0.0  # unique / total
    four_char_idiom_ratio: float = 0.0
    modifier_ratio: float = 0.0  # 形容词/副词占比


@dataclass
class RhetoricMetrics:
    """修辞层面指标."""

    metaphor_count: int = 0
    simile_count: int = 0
    personification_count: int = 0
    rhetorical_density: float = 0.0  # 修辞句 / 总句数


@dataclass
class EmotionMetrics:
    """情感倾向指标."""

    polarity: float = 0.0  # -1.0 (消极) ~ 1.0 (积极)
    intensity: float = 0.0  # 0.0 ~ 1.0
    dominant_emotion: str = "neutral"


@dataclass
class StyleFingerprint:
    """风格指纹 — 文本风格的结构化量化描述."""

    sentence: SentenceMetrics = field(default_factory=SentenceMetrics)
    vocabulary: VocabularyMetrics = field(default_factory=VocabularyMetrics)
    rhetoric: RhetoricMetrics = field(default_factory=RhetoricMetrics)
    emotion: EmotionMetrics = field(default_factory=EmotionMetrics)
    raw_summary: str = ""
    ai_deep_analysis: dict[str, Any] = field(default_factory=dict)  # AI 深层分析结果
    style_consistency_score: float = 1.0  # 风格一致性评分 0.0-1.0


@dataclass
class StyleMigrationSuggestion:
    """风格迁移建议条目."""

    aspect: str
    current_state: str
    target_state: str
    suggestion: str
    priority: str = "medium"  # high / medium / low


@dataclass
class StyleReport:
    """风格分析报告."""

    fingerprint: StyleFingerprint
    detected_style: str
    confidence: float
    migration_suggestions: list[StyleMigrationSuggestion] = field(default_factory=list)
    preset_comparison: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """序列化为字典."""
        return {
            "fingerprint": {
                "sentence": {
                    "avg_length": self.fingerprint.sentence.avg_length,
                    "max_length": self.fingerprint.sentence.max_length,
                    "min_length": self.fingerprint.sentence.min_length,
                    "variance": self.fingerprint.sentence.variance,
                    "long_sentence_ratio": self.fingerprint.sentence.long_sentence_ratio,
                    "short_sentence_ratio": self.fingerprint.sentence.short_sentence_ratio,
                },
                "vocabulary": {
                    "total_words": self.fingerprint.vocabulary.total_words,
                    "unique_words": self.fingerprint.vocabulary.unique_words,
                    "diversity_index": self.fingerprint.vocabulary.diversity_index,
                    "four_char_idiom_ratio": self.fingerprint.vocabulary.four_char_idiom_ratio,
                    "modifier_ratio": self.fingerprint.vocabulary.modifier_ratio,
                },
                "rhetoric": {
                    "metaphor_count": self.fingerprint.rhetoric.metaphor_count,
                    "simile_count": self.fingerprint.rhetoric.simile_count,
                    "personification_count": self.fingerprint.rhetoric.personification_count,
                    "rhetorical_density": self.fingerprint.rhetoric.rhetorical_density,
                },
                "emotion": {
                    "polarity": self.fingerprint.emotion.polarity,
                    "intensity": self.fingerprint.emotion.intensity,
                    "dominant_emotion": self.fingerprint.emotion.dominant_emotion,
                },
                "raw_summary": self.fingerprint.raw_summary,
            },
            "detected_style": self.detected_style,
            "confidence": self.confidence,
            "migration_suggestions": [
                {
                    "aspect": s.aspect,
                    "current_state": s.current_state,
                    "target_state": s.target_state,
                    "suggestion": s.suggestion,
                    "priority": s.priority,
                }
                for s in self.migration_suggestions
            ],
            "preset_comparison": self.preset_comparison,
        }


# ---------------------------------------------------------------------------
# StyleAgent
# ---------------------------------------------------------------------------

class StyleAgent(BaseAgent):
    """风格分析与调节 Agent.

    功能：
    - 分析文本风格指纹（句式、词汇、修辞、情感）
    - 按预设风格调节文本
    - 提供风格迁移建议
    """

    # 情感关键词映射（简易规则）
    _POSITIVE_WORDS = frozenset(
        "喜悦 欣喜 欢欣 愉快 快乐 幸福 满足 温暖 希望 光明 美好 温柔 爱 笑 赞".split()
    )
    _NEGATIVE_WORDS = frozenset(
        "悲伤 痛苦 绝望 孤独 恐惧 愤怒 怨恨 冷漠 压抑 灰暗 凋零 死 泪 咒".split()
    )

    # 修辞检测模式
    _METAPHOR_PATTERNS = [
        re.compile(r"(?:像|如|仿佛|好似|宛如|犹如)(?!.*(?:一样|似的))"),
        re.compile(r"(?:是|成了|变为)(?=.+(?:的|地))"),
    ]
    _SIMILE_PATTERNS = [
        re.compile(r"(?:像|如|仿佛|好似|宛如|犹如).*(?:一样|似的)"),
    ]
    _PERSONIFICATION_PATTERNS = [
        re.compile(r"(?:风|雨|云|山|水|树|花|月|夜|时光|岁月)(?:叹息|微笑|哭泣|沉默|低语|凝视)"),
    ]

    async def execute(self, context: AgentContext) -> AgentResult:
        """执行风格分析或调节任务.

        Task 指令格式：
        - "analyze:<text>" → 分析风格指纹
        - "adjust:<text>:<target_style>" → 按目标风格调节文本
        - "suggest:<text>:<target_style>" → 提供风格迁移建议
        """
        task = context.task.strip()

        if task.startswith("analyze:"):
            text = task[len("analyze:"):].strip()
            report = await self.analyze_fingerprint(text)
            return AgentResult(
                content=report.to_dict(),
                confidence=report.confidence,
                metadata={"operation": "analyze", "detected_style": report.detected_style},
            )

        if task.startswith("adjust:"):
            parts = task.split(":", 2)
            if len(parts) < 3:
                return AgentResult(
                    content={"error": "adjust 格式应为 adjust:<text>:<target_style>"},
                    confidence=0.0,
                    warnings=["Invalid adjust format"],
                )
            text, target_style = parts[1], parts[2]
            adjusted = await self.adjust_style(text, target_style, context)
            return AgentResult(
                content={"adjusted_text": adjusted, "target_style": target_style},
                confidence=0.85,
                metadata={"operation": "adjust", "target_style": target_style},
            )

        if task.startswith("suggest:"):
            parts = task.split(":", 2)
            if len(parts) < 3:
                return AgentResult(
                    content={"error": "suggest 格式应为 suggest:<text>:<target_style>"},
                    confidence=0.0,
                    warnings=["Invalid suggest format"],
                )
            text, target_style = parts[1], parts[2]
            suggestions = await self.migration_suggestions(text, target_style)
            return AgentResult(
                content={
                    "suggestions": [s.__dict__ for s in suggestions],
                    "target_style": target_style,
                },
                confidence=0.8,
                metadata={"operation": "suggest", "target_style": target_style},
            )

        return AgentResult(
            content={"error": f"Unknown task: {task[:50]}"},
            confidence=0.0,
            warnings=["Unrecognized task prefix. Use analyze:/adjust:/suggest:"],
        )

    # ------------------------------------------------------------------
    # 1. 风格指纹分析
    # ------------------------------------------------------------------

    async def analyze_fingerprint(self, text: str) -> StyleReport:
        """分析文本风格指纹.

        结合规则统计 + AI 深度分析生成结构化报告.
        """
        # 基础规则统计
        sentence_metrics = self._analyze_sentences(text)
        vocab_metrics = self._analyze_vocabulary(text)
        rhetoric_metrics = self._analyze_rhetoric(text)
        emotion_metrics = self._analyze_emotion(text)

        fingerprint = StyleFingerprint(
            sentence=sentence_metrics,
            vocabulary=vocab_metrics,
            rhetoric=rhetoric_metrics,
            emotion=emotion_metrics,
        )

        # AI 摘要
        ai_summary = await self._ai_style_summary(text)
        fingerprint.raw_summary = ai_summary.get("summary", "")

        # AI 深层分析
        try:
            ai_deep = await self._ai_deep_analysis(text)
            fingerprint.ai_deep_analysis = ai_deep
        except Exception as e:
            logger.warning("AI deep analysis failed: %s", e)

        # 风格匹配
        detected, confidence, comparison = self._match_preset_style(fingerprint)

        return StyleReport(
            fingerprint=fingerprint,
            detected_style=detected,
            confidence=confidence,
            preset_comparison=comparison,
        )

    def _analyze_sentences(self, text: str) -> SentenceMetrics:
        """统计句子长度分布."""
        # 按中文句号、问号、感叹号、分号切分
        sentences = [s.strip() for s in re.split(r"[。！？；\n]", text) if s.strip()]
        if not sentences:
            return SentenceMetrics()

        lengths = [len(s) for s in sentences]
        avg_len = sum(lengths) / len(lengths)
        variance = sum((l - avg_len) ** 2 for l in lengths) / len(lengths)
        long_ratio = sum(1 for l in lengths if l > 30) / len(lengths)
        short_ratio = sum(1 for l in lengths if l < 10) / len(lengths)

        return SentenceMetrics(
            avg_length=round(avg_len, 2),
            max_length=max(lengths),
            min_length=min(lengths),
            variance=round(variance, 2),
            long_sentence_ratio=round(long_ratio, 3),
            short_sentence_ratio=round(short_ratio, 3),
        )

    def _analyze_vocabulary(self, text: str) -> VocabularyMetrics:
        """统计词汇特征."""
        # 简单分词：按非中文字符切分
        words = re.findall(r"[\u4e00-\u9fff]+", text)
        all_chars = "".join(words)
        total = len(all_chars)
        if total == 0:
            return VocabularyMetrics()

        unique = len(set(all_chars))

        # 四字成语/短语粗略检测
        four_char = len(re.findall(r"[\u4e00-\u9fff]{4}", text))

        # 修饰词检测（简单规则：常见形容词/副词后缀）
        modifiers = len(re.findall(r"[\u4e00-\u9fff]{1,3}(?:的|地|得)", text))

        return VocabularyMetrics(
            total_words=total,
            unique_words=unique,
            diversity_index=round(unique / total, 3),
            four_char_idiom_ratio=round(four_char / max(len(words), 1), 3),
            modifier_ratio=round(modifiers / max(total, 1), 3),
        )

    def _analyze_rhetoric(self, text: str) -> RhetoricMetrics:
        """统计修辞手法."""
        sentences = [s.strip() for s in re.split(r"[。！？；\n]", text) if s.strip()]
        total = len(sentences) or 1

        metaphor = sum(len(p.findall(text)) for p in self._METAPHOR_PATTERNS)
        simile = sum(len(p.findall(text)) for p in self._SIMILE_PATTERNS)
        person = sum(len(p.findall(text)) for p in self._PERSONIFICATION_PATTERNS)

        return RhetoricMetrics(
            metaphor_count=metaphor,
            simile_count=simile,
            personification_count=person,
            rhetorical_density=round((metaphor + simile + person) / total, 3),
        )

    def _analyze_emotion(self, text: str) -> EmotionMetrics:
        """简易情感倾向分析."""
        pos_count = sum(1 for w in self._POSITIVE_WORDS if w in text)
        neg_count = sum(1 for w in self._NEGATIVE_WORDS if w in text)
        total = pos_count + neg_count
        if total == 0:
            return EmotionMetrics(polarity=0.0, intensity=0.0, dominant_emotion="neutral")

        polarity = (pos_count - neg_count) / total
        intensity = min(total / max(len(text) / 100, 1), 1.0)

        if polarity > 0.3:
            dominant = "positive"
        elif polarity < -0.3:
            dominant = "negative"
        else:
            dominant = "neutral"

        return EmotionMetrics(
            polarity=round(polarity, 3),
            intensity=round(intensity, 3),
            dominant_emotion=dominant,
        )

    async def _ai_style_summary(self, text: str) -> dict[str, Any]:
        """调用 AI 生成风格摘要."""
        prompt = (
            f"请分析以下文本的写作风格，用 JSON 输出：\n"
            f'{{"summary": "一段 100 字内的风格描述", "keywords": ["关键词1", "关键词2"]}}\n\n'
            f"文本：\n{text[:1500]}"
        )
        try:
            raw = await self._provider.generate(prompt, style="default", operation="review")
            # 尝试提取 JSON
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                return json.loads(match.group())
        except Exception:
            pass
        return {"summary": "", "keywords": []}

    async def _ai_deep_analysis(self, text: str) -> dict[str, Any]:
        """使用 AI 进行超越规则的深层风格分析。

        分析内容：
        - 句式模式：平均长度、方差、掉句比例、是否倾向并叙句
        - 词汇特征：文言比例、视觉意象密度、感官描写偏好
        - 修辞偏好：偏好使用的修辞手法列表
        - 情感基调：情感类型（压抑/昂扬/中性/复杂）
        - 叙事视角：人称和视角类型
        """
        prompt = f"""分析以下文本的深层写作风格特征，返回 JSON：

{{
    "sentence_patterns": {{
        "avg_length": 平均句子长度(数字),
        "variance": "high/medium/low 句子长度波动",
        "parataxis_ratio": 0.0-1.0 并叙句(短句并列)比例,
        "complex_sentence_ratio": 0.0-1.0 复合句(从句/修饰)比例,
        "fragment_ratio": 0.0-1.0 句子片段比例
    }},
    "vocabulary_features": {{
        "classical_ratio": 0.0-1.0 文言词汇比例,
        "visual_imagery": "high/medium/low 视觉意象密度",
        "sensory_detail": "high/medium/low 感官描写密度",
        "abstract_concrete_ratio": 0.0-1.0 抽象/具体词汇比例
    }},
    "rhetoric_preferences": ["metaphor", "simile", "personification", "synaesthesia", "alliteration", "oxymoron"],
    "emotion_tone": "restrained_melancholy/expansive_joy/cold_detachment/intense_conflict/neutral",
    "narrative_voice": "omniscient_third_person/first_person_limited/first_person_observer/second_person",
    "notable_traits": ["trait1", "trait2"]
}}

文本：{text[:2000]}

只返回 JSON，不要包含其他文字。"""
        try:
            raw = await self._provider.generate(prompt, style="default", operation="review")
            match = re.search(r"\{[\s\S]*\}", raw)
            if match:
                return json.loads(match.group())
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse AI deep analysis: %s", e)
        except Exception as e:
            logger.warning("AI deep analysis failed: %s", e)
        return {}

    def _match_preset_style(self, fingerprint: StyleFingerprint) -> tuple[str, float, dict[str, float]]:
        """将指纹与预设风格匹配，返回 (最匹配风格, 置信度, 所有匹配度)."""
        scores: dict[str, float] = {}

        for key, preset in PRESET_STYLES.items():
            if key == "custom":
                continue
            score = 0.5

            # 句式匹配
            if key == "江南":
                score += fingerprint.sentence.long_sentence_ratio * 0.3
                score += fingerprint.rhetoric.rhetorical_density * 0.2
            elif key == "卡夫卡":
                score += fingerprint.sentence.long_sentence_ratio * 0.2
                score += (1 - fingerprint.emotion.intensity) * 0.15
            elif key == "加缪":
                score += fingerprint.sentence.short_sentence_ratio * 0.3
                score += (1 - fingerprint.rhetoric.rhetorical_density) * 0.2
            elif key == "default":
                # 默认风格取中间值
                mid = 1.0 - abs(fingerprint.sentence.long_sentence_ratio - 0.3)
                score += mid * 0.15

            # 词汇多样性微调
            score += fingerprint.vocabulary.diversity_index * 0.1

            # AI 深层分析增强匹配
            if fingerprint.ai_deep_analysis:
                ai = fingerprint.ai_deep_analysis
                if key == "江南":
                    if ai.get("emotion_tone") == "restrained_melancholy":
                        score += 0.15
                    if ai.get("vocabulary_features", {}).get("visual_imagery") == "high":
                        score += 0.1
                elif key == "卡夫卡":
                    if ai.get("narrative_voice") in ("first_person_limited", "first_person_observer"):
                        score += 0.1
                    if ai.get("emotion_tone") == "cold_detachment":
                        score += 0.15
                elif key == "加缪":
                    if ai.get("sentence_patterns", {}).get("fragment_ratio", 0) > 0.2:
                        score += 0.15
                    if ai.get("rhetoric_preferences") and len(ai.get("rhetoric_preferences", [])) < 3:
                        score += 0.1

            scores[key] = round(min(score, 1.0), 3)

        if not scores:
            return "default", 0.5, {}

        best = max(scores, key=scores.get)  # type: ignore[arg-type]
        return best, scores[best], scores

    # ------------------------------------------------------------------
    # 2. 文笔风格调节
    # ------------------------------------------------------------------

    async def adjust_style(
        self, text: str, target_style: str, context: AgentContext | None = None
    ) -> str:
        """将文本调节为目标风格.

        Args:
            text: 原始文本
            target_style: 目标风格键名（江南/卡夫卡/加缪/default/custom）
            context: 可选执行上下文
        """
        preset = PRESET_STYLES.get(target_style, PRESET_STYLES["default"])

        # 构建 prompt
        prompt_parts = [
            f"请将以下文本改写为「{preset['name']}」风格。",
            f"风格特征：{preset['traits']}",
            "",
            "要求：",
            "1. 保持原文的情节和核心信息不变",
            "2. 仅调整文笔风格，不改变内容",
            "3. 直接输出改写后的文本，不要添加解释",
            "",
            f"原文：\n{text}",
        ]

        if context and context.constraints:
            prompt_parts.insert(3, "额外约束：" + "; ".join(context.constraints))

        prompt = "\n".join(prompt_parts)
        result = await self._provider.generate(prompt, style=target_style, operation="rewrite")
        return result.strip()

    # ------------------------------------------------------------------
    # 3. 风格迁移建议
    # ------------------------------------------------------------------

    async def migration_suggestions(
        self, text: str, target_style: str
    ) -> list[StyleMigrationSuggestion]:
        """生成从当前文本到目标风格的迁移建议.

        结合规则分析与 AI 建议.
        """
        report = await self.analyze_fingerprint(text)
        preset = PRESET_STYLES.get(target_style, PRESET_STYLES["default"])
        suggestions: list[StyleMigrationSuggestion] = []

        fp = report.fingerprint

        # 句式建议
        if target_style == "江南" and fp.sentence.long_sentence_ratio < 0.3:
            suggestions.append(
                StyleMigrationSuggestion(
                    aspect="句式长度",
                    current_state=f"长句占比 {fp.sentence.long_sentence_ratio:.1%}",
                    target_state="长句占比 40% 以上，句式层次丰富",
                    suggestion="适当合并短句，增加从句与修饰成分，营造绵延婉转的语感",
                    priority="high",
                )
            )
        elif target_style == "加缪" and fp.sentence.short_sentence_ratio < 0.2:
            suggestions.append(
                StyleMigrationSuggestion(
                    aspect="句式长度",
                    current_state=f"短句占比 {fp.sentence.short_sentence_ratio:.1%}",
                    target_state="短句占比 30% 以上，节奏干脆",
                    suggestion="拆分冗长句子，使用短促有力的陈述句，减少从句嵌套",
                    priority="high",
                )
            )

        # 修辞建议
        if target_style == "江南" and fp.rhetoric.rhetorical_density < 0.1:
            suggestions.append(
                StyleMigrationSuggestion(
                    aspect="修辞密度",
                    current_state=f"修辞密度 {fp.rhetoric.rhetorical_density:.2f}",
                    target_state="修辞密度 0.15 以上，意象丰富",
                    suggestion="增加比喻、通感等修辞手法，强化画面与感官描写",
                    priority="medium",
                )
            )
        elif target_style == "加缪" and fp.rhetoric.rhetorical_density > 0.15:
            suggestions.append(
                StyleMigrationSuggestion(
                    aspect="修辞密度",
                    current_state=f"修辞密度 {fp.rhetoric.rhetorical_density:.2f}",
                    target_state="修辞密度 0.05 以下，极简白描",
                    suggestion="去除多余修饰，用精准的名词和动词直接呈现，避免隐喻堆砌",
                    priority="medium",
                )
            )

        # 情感建议
        if target_style == "卡夫卡" and fp.emotion.intensity > 0.5:
            suggestions.append(
                StyleMigrationSuggestion(
                    aspect="情感表达",
                    current_state=f"情感强度 {fp.emotion.intensity:.2f}，倾向 {fp.emotion.dominant_emotion}",
                    target_state="情感压抑淡漠，冷峻客观",
                    suggestion="弱化主观情感词，用客观叙述替代心理描写，营造疏离感",
                    priority="high",
                )
            )

        # AI 补充建议
        ai_suggestions = await self._ai_migration_suggestions(text, target_style, preset)
        suggestions.extend(ai_suggestions)

        return suggestions

    async def _ai_migration_suggestions(
        self, text: str, target_style: str, preset: dict[str, str]
    ) -> list[StyleMigrationSuggestion]:
        """调用 AI 获取补充迁移建议."""
        prompt = (
            f"请分析以下文本与「{preset['name']}」风格的差距，"
            f"给出 2-3 条具体的改写建议。用 JSON 数组输出：\n"
            f'[{{"aspect": "方面", "current_state": "现状", "target_state": "目标", '
            f'"suggestion": "具体建议", "priority": "high/medium/low"}}]\n\n'
            f"文本：\n{text[:1200]}"
        )
        try:
            raw = await self._provider.generate(prompt, style="default", operation="review")
            match = re.search(r"\[.*\]", raw, re.DOTALL)
            if match:
                data = json.loads(match.group())
                return [StyleMigrationSuggestion(**item) for item in data if isinstance(item, dict)]
        except Exception:
            pass
        return []

    # ------------------------------------------------------------------
    # 工具方法
    # ------------------------------------------------------------------

    @classmethod
    def get_preset_styles(cls) -> dict[str, dict[str, str]]:
        """获取所有预设风格定义."""
        return dict(PRESET_STYLES)

    @classmethod
    def register_custom_style(cls, key: str, name: str, description: str, traits: str) -> None:
        """注册自定义风格."""
        PRESET_STYLES[key] = {
            "name": name,
            "description": description,
            "traits": traits,
        }

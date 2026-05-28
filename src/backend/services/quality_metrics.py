"""Quality Metrics - Multi-dimensional chapter quality analysis.

Provides automatic (no LLM cost) and on-demand (LLM-deep) quality scoring
across 8 dimensions for chapter content.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class QualityMetrics:
    """8-dimension quality scoring for chapters.

    Automatic metrics (computed locally, no API cost):
        pacing_score: Sentence-length variance — lower variance = smoother pacing.
        semantic_domain_score: Embedding variance across paragraphs (placeholder).
        tension_score: Paragraph-length variation as a tension proxy.
        vocabulary_diversity: Type-token ratio of Chinese characters.

    LLM-deep metrics (computed on-demand via AI):
        character_consistency: How well characters stay in-character.
        emotional_coherence: Emotional flow consistency across the chapter.
        plot_thread_tracking: How well plot threads are maintained.
        style_consistency: Uniformity of writing style throughout.
    """

    # Automatic metrics (no LLM cost)
    pacing_score: float = 0.0
    semantic_domain_score: float = 0.0
    tension_score: float = 0.0
    vocabulary_diversity: float = 0.0

    # LLM-deep metrics (on-demand)
    character_consistency: float = 0.0
    emotional_coherence: float = 0.0
    plot_thread_tracking: float = 0.0
    style_consistency: float = 0.0

    def to_radar_chart(self) -> Dict[str, float]:
        """Return 8-dimension scores for radar chart rendering.

        Returns:
            Dict mapping dimension names to scores (0.0-1.0).
        """
        return {
            "pacing": self.pacing_score,
            "semantic_domain": self.semantic_domain_score,
            "tension": self.tension_score,
            "vocabulary": self.vocabulary_diversity,
            "character_consistency": self.character_consistency,
            "emotional_coherence": self.emotional_coherence,
            "plot_threads": self.plot_thread_tracking,
            "style_consistency": self.style_consistency,
        }

    @property
    def automatic_average(self) -> float:
        """Average of the four automatic metrics."""
        scores = [
            self.pacing_score,
            self.semantic_domain_score,
            self.tension_score,
            self.vocabulary_diversity,
        ]
        return sum(scores) / len(scores) if scores else 0.0

    @property
    def llm_average(self) -> float:
        """Average of the four LLM-deep metrics."""
        scores = [
            self.character_consistency,
            self.emotional_coherence,
            self.plot_thread_tracking,
            self.style_consistency,
        ]
        return sum(scores) / len(scores) if scores else 0.0

    @property
    def overall(self) -> float:
        """Weighted overall score: 60% automatic + 40% LLM-deep."""
        return self.automatic_average * 0.6 + self.llm_average * 0.4


class QualityAnalyzer:
    """Compute quality metrics for chapter text.

    Usage::

        analyzer = QualityAnalyzer()
        metrics = analyzer.compute_automatic(chapter_text)
        print(metrics.to_radar_chart())
    """

    # Chinese character range for tokenization
    _CJK_PATTERN = re.compile(r"[一-鿿]")

    def compute_automatic(self, text: str) -> QualityMetrics:
        """Compute automatic metrics (no LLM cost).

        Args:
            text: The chapter text to analyze.

        Returns:
            QualityMetrics with automatic scores populated.
        """
        metrics = QualityMetrics()

        if not text or not text.strip():
            return metrics

        metrics.pacing_score = self._compute_pacing(text)
        metrics.vocabulary_diversity = self._compute_vocabulary_diversity(text)
        metrics.tension_score = self._compute_tension(text)
        # semantic_domain_score requires embeddings — placeholder for now
        metrics.semantic_domain_score = 0.0

        return metrics

    @staticmethod
    def _compute_pacing(text: str) -> float:
        """Compute pacing score from sentence-length variance.

        Lower variance means smoother, more consistent pacing.

        Returns:
            Score between 0.0 and 1.0 (higher = better pacing).
        """
        sentences = re.split(r"[。！？!?]", text)
        lengths = [len(s.strip()) for s in sentences if s.strip()]

        if len(lengths) < 2:
            return 1.0

        mean_len = sum(lengths) / len(lengths)
        variance = sum((length - mean_len) ** 2 for length in lengths) / len(lengths)
        # Normalize: variance/1000 maps typical Chinese prose variance to [0, ~1]
        return min(1.0, 1.0 / (1.0 + variance / 1000))

    @staticmethod
    def _compute_vocabulary_diversity(text: str) -> float:
        """Compute vocabulary diversity as type-token ratio of CJK characters.

        Returns:
            Ratio of unique CJK characters to total CJK characters (0.0-1.0).
        """
        chars = QualityAnalyzer._CJK_PATTERN.findall(text)
        if not chars:
            return 0.0
        unique_chars = len(set(chars))
        return unique_chars / len(chars)

    @staticmethod
    def _compute_tension(text: str) -> float:
        """Compute tension score from paragraph-length variation.

        Higher variation suggests more dynamic pacing (tension/release cycles).

        Returns:
            Score between 0.0 and 1.0 (higher = more tension variation).
        """
        paragraphs = [p for p in text.split("\n\n") if p.strip()]

        if len(paragraphs) < 2:
            return 0.0

        para_lengths = [len(p) for p in paragraphs]
        mean_para = sum(para_lengths) / len(para_lengths)
        para_variance = sum((length - mean_para) ** 2 for length in para_lengths) / len(
            para_lengths
        )
        # Normalize against typical paragraph variance
        return min(1.0, para_variance / 10000)

    def compute_llm_scores(
        self,
        metrics: QualityMetrics,
        character_consistency: float = 0.0,
        emotional_coherence: float = 0.0,
        plot_thread_tracking: float = 0.0,
        style_consistency: float = 0.0,
    ) -> QualityMetrics:
        """Populate LLM-deep scores on an existing QualityMetrics object.

        Args:
            metrics: Existing QualityMetrics to update.
            character_consistency: Score from LLM analysis.
            emotional_coherence: Score from LLM analysis.
            plot_thread_tracking: Score from LLM analysis.
            style_consistency: Score from LLM analysis.

        Returns:
            The same QualityMetrics instance with LLM scores populated.
        """
        metrics.character_consistency = max(0.0, min(1.0, character_consistency))
        metrics.emotional_coherence = max(0.0, min(1.0, emotional_coherence))
        metrics.plot_thread_tracking = max(0.0, min(1.0, plot_thread_tracking))
        metrics.style_consistency = max(0.0, min(1.0, style_consistency))
        return metrics

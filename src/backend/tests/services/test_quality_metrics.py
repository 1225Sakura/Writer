"""Tests for QualityMetrics and QualityAnalyzer — automatic chapter quality analysis."""

import pytest

from backend.services.quality_metrics import QualityAnalyzer, QualityMetrics


class TestQualityMetricsDefaults:
    """Test default state of QualityMetrics."""

    def test_all_scores_default_to_zero(self):
        """All 8 dimension scores default to 0.0."""
        m = QualityMetrics()
        assert m.pacing_score == 0.0
        assert m.semantic_domain_score == 0.0
        assert m.tension_score == 0.0
        assert m.vocabulary_diversity == 0.0
        assert m.character_consistency == 0.0
        assert m.emotional_coherence == 0.0
        assert m.plot_thread_tracking == 0.0
        assert m.style_consistency == 0.0

    def test_radar_chart_keys(self):
        """to_radar_chart returns all 8 dimension names."""
        m = QualityMetrics()
        chart = m.to_radar_chart()
        assert set(chart.keys()) == {
            "pacing",
            "semantic_domain",
            "tension",
            "vocabulary",
            "character_consistency",
            "emotional_coherence",
            "plot_threads",
            "style_consistency",
        }

    def test_radar_chart_reflects_scores(self):
        """to_radar_chart values match the metric fields."""
        m = QualityMetrics(pacing_score=0.8, character_consistency=0.6)
        chart = m.to_radar_chart()
        assert chart["pacing"] == 0.8
        assert chart["character_consistency"] == 0.6

    def test_automatic_average(self):
        """automatic_average is mean of the 4 automatic metrics."""
        m = QualityMetrics(
            pacing_score=0.8,
            semantic_domain_score=0.6,
            tension_score=0.4,
            vocabulary_diversity=0.2,
        )
        assert m.automatic_average == pytest.approx(0.5)

    def test_llm_average(self):
        """llm_average is mean of the 4 LLM-deep metrics."""
        m = QualityMetrics(
            character_consistency=0.9,
            emotional_coherence=0.7,
            plot_thread_tracking=0.5,
            style_consistency=0.3,
        )
        assert m.llm_average == pytest.approx(0.6)

    def test_overall_weighted(self):
        """overall is 60% automatic + 40% LLM-deep."""
        m = QualityMetrics(
            pacing_score=1.0,
            semantic_domain_score=1.0,
            tension_score=1.0,
            vocabulary_diversity=1.0,
            character_consistency=0.5,
            emotional_coherence=0.5,
            plot_thread_tracking=0.5,
            style_consistency=0.5,
        )
        # automatic_avg = 1.0, llm_avg = 0.5
        # overall = 1.0 * 0.6 + 0.5 * 0.4 = 0.8
        assert m.overall == pytest.approx(0.8)


class TestQualityAnalyzerPacing:
    """Test pacing score computation."""

    def test_uniform_sentences_high_score(self):
        """Uniform sentence lengths produce high pacing score."""
        analyzer = QualityAnalyzer()
        # Create text with very similar sentence lengths
        text = "他走进了房间。他看到了桌子。他坐了下来。"
        m = analyzer.compute_automatic(text)
        assert m.pacing_score > 0.5

    def test_varied_sentences_lower_score(self):
        """Highly varied sentence lengths produce lower pacing score."""
        analyzer = QualityAnalyzer()
        # Mix very short and very long sentences
        text = "好。" * 10 + "他走进了一个非常非常非常非常非常非常非常非常非常非常大的房间，看到了一张巨大的桌子。" * 10
        m = analyzer.compute_automatic(text)
        assert m.pacing_score < 1.0

    def test_single_sentence_returns_one(self):
        """A single sentence has perfect pacing (no variance)."""
        analyzer = QualityAnalyzer()
        m = analyzer.compute_automatic("这是一个句子。")
        assert m.pacing_score == 1.0


class TestQualityAnalyzerVocabulary:
    """Test vocabulary diversity computation."""

    def test_repeated_chars_low_diversity(self):
        """Repeated characters produce low type-token ratio."""
        analyzer = QualityAnalyzer()
        text = "人人人人人人人人人"
        m = analyzer.compute_automatic(text)
        assert m.vocabulary_diversity == pytest.approx(1 / 9, rel=0.01)

    def test_unique_chars_high_diversity(self):
        """All unique characters produce ratio of 1.0."""
        analyzer = QualityAnalyzer()
        text = "天地玄黄宇宙洪荒"
        m = analyzer.compute_automatic(text)
        assert m.vocabulary_diversity == 1.0

    def test_no_cjk_chars_returns_zero(self):
        """Text with no CJK characters returns 0.0."""
        analyzer = QualityAnalyzer()
        m = analyzer.compute_automatic("Hello world 123 !@#")
        assert m.vocabulary_diversity == 0.0


class TestQualityAnalyzerTension:
    """Test tension score computation."""

    def test_uniform_paragraphs_low_tension(self):
        """Uniform paragraph lengths produce low tension score."""
        analyzer = QualityAnalyzer()
        para = "这是一个段落内容。"
        text = "\n\n".join([para] * 5)
        m = analyzer.compute_automatic(text)
        assert m.tension_score < 0.1

    def test_varied_paragraphs_higher_tension(self):
        """Varied paragraph lengths produce higher tension score."""
        analyzer = QualityAnalyzer()
        paragraphs = ["短。" * 2, "长" * 200, "中等长度的段落。" * 5]
        text = "\n\n".join(paragraphs)
        m = analyzer.compute_automatic(text)
        assert m.tension_score > 0.0

    def test_single_paragraph_zero_tension(self):
        """Single paragraph returns 0.0 tension (need 2+ for variance)."""
        analyzer = QualityAnalyzer()
        m = analyzer.compute_automatic("只有一个段落。")
        assert m.tension_score == 0.0


class TestQualityAnalyzerEdgeCases:
    """Test edge cases for QualityAnalyzer."""

    def test_empty_text(self):
        """Empty text returns all zeros."""
        analyzer = QualityAnalyzer()
        m = analyzer.compute_automatic("")
        assert m.pacing_score == 0.0
        assert m.vocabulary_diversity == 0.0
        assert m.tension_score == 0.0

    def test_whitespace_only(self):
        """Whitespace-only text returns all zeros."""
        analyzer = QualityAnalyzer()
        m = analyzer.compute_automatic("   \n\n   ")
        assert m.pacing_score == 0.0

    def test_compute_llm_scores_clamps_values(self):
        """LLM scores are clamped to [0.0, 1.0]."""
        analyzer = QualityAnalyzer()
        m = QualityMetrics()
        analyzer.compute_llm_scores(
            m,
            character_consistency=1.5,
            emotional_coherence=-0.1,
            plot_thread_tracking=0.8,
            style_consistency=0.0,
        )
        assert m.character_consistency == 1.0
        assert m.emotional_coherence == 0.0
        assert m.plot_thread_tracking == 0.8
        assert m.style_consistency == 0.0

    def test_compute_automatic_returns_quality_metrics(self):
        """compute_automatic always returns a QualityMetrics instance."""
        analyzer = QualityAnalyzer()
        m = analyzer.compute_automatic("测试文本。")
        assert isinstance(m, QualityMetrics)


class TestQualityAnalyzerRealisticText:
    """Test with realistic Chinese prose."""

    def test_realistic_chapter_text(self):
        """Realistic chapter text produces bounded scores."""
        analyzer = QualityAnalyzer()
        text = (
            "清晨的阳光透过窗帘的缝隙，洒在了陈旧的木地板上。\n\n"
            "李明从床上坐起来，揉了揉惺忪的睡眼。今天是一个特别的日子，"
            "他即将踏上一段未知的旅程。\n\n"
            "窗外传来鸟儿的鸣叫声，伴随着远处寺庙的钟声。"
            "他深吸一口气，感受着空气中弥漫的桂花香气。\n\n"
            "「该走了。」他自言自语道，开始收拾行囊。"
        )
        m = analyzer.compute_automatic(text)

        # All automatic scores should be in [0, 1]
        assert 0.0 <= m.pacing_score <= 1.0
        assert 0.0 <= m.vocabulary_diversity <= 1.0
        assert 0.0 <= m.tension_score <= 1.0
        assert m.semantic_domain_score == 0.0  # placeholder

        # Vocabulary diversity should be reasonable for varied prose
        assert m.vocabulary_diversity > 0.3

"""Tests for Strand Classifier - heuristic classification, keyword matching, normalization."""

import pytest
from backend.services.strand_classifier import (
    StrandClassifier,
    StrandClassification,
)


@pytest.fixture
def classifier():
    return StrandClassifier(ai_service=None)


# =============================================================================
# StrandClassification dataclass
# =============================================================================


class TestStrandClassification:
    """Test StrandClassification normalization and serialization."""

    def test_normalization_sums_to_one(self):
        sc = StrandClassification(chapter_id=1, quest=3, fire=1, constellation=1)
        total = sc.quest + sc.fire + sc.constellation
        assert abs(total - 1.0) < 0.01

    def test_dominant_is_max(self):
        sc = StrandClassification(chapter_id=1, quest=10, fire=1, constellation=1)
        assert sc.dominant == "quest"

    def test_fire_dominant(self):
        sc = StrandClassification(chapter_id=1, quest=1, fire=10, constellation=1)
        assert sc.dominant == "fire"

    def test_constellation_dominant(self):
        sc = StrandClassification(chapter_id=1, quest=1, fire=1, constellation=10)
        assert sc.dominant == "constellation"

    def test_to_dict(self):
        sc = StrandClassification(chapter_id=1, quest=3, fire=1, constellation=1)
        d = sc.to_dict()
        assert d["chapter_id"] == 1
        assert "quest" in d
        assert "fire" in d
        assert "constellation" in d
        assert "dominant" in d
        assert "confidence" in d
        assert "method" in d

    def test_from_dict(self):
        data = {
            "chapter_id": 5,
            "quest": 0.6,
            "fire": 0.2,
            "constellation": 0.2,
            "dominant": "quest",
            "confidence": 0.8,
            "method": "heuristic",
            "keywords_found": {"quest": ["任务"]},
        }
        sc = StrandClassification.from_dict(data)
        assert sc.chapter_id == 5
        assert sc.confidence == 0.8
        assert sc.keywords_found == {"quest": ["任务"]}

    def test_from_dict_defaults(self):
        sc = StrandClassification.from_dict({})
        assert sc.chapter_id == 0
        assert sc.method == "heuristic"

    def test_zero_scores_get_remainder(self):
        # When all scores are 0, remainder (1.0) is added to quest
        sc = StrandClassification(chapter_id=1, quest=0, fire=0, constellation=0)
        assert sc.quest == 1.0
        assert sc.fire == 0.0
        assert sc.constellation == 0.0


# =============================================================================
# _count_keywords
# =============================================================================


class TestCountKeywords:
    """Test keyword counting."""

    def test_count_single_keyword(self):
        count = StrandClassifier._count_keywords("这里有任务需要完成", ["任务"])
        assert count == 1

    def test_count_multiple_occurrences(self):
        count = StrandClassifier._count_keywords("任务和任务", ["任务"])
        assert count == 2

    def test_count_case_insensitive(self):
        # _count_keywords expects already-lowered text (caller does content.lower())
        count = StrandClassifier._count_keywords("quest and quest", ["Quest"])
        assert count == 2

    def test_count_no_match(self):
        count = StrandClassifier._count_keywords("没有匹配", ["任务"])
        assert count == 0

    def test_count_empty_text(self):
        count = StrandClassifier._count_keywords("", ["任务"])
        assert count == 0


# =============================================================================
# _find_matched_keywords
# =============================================================================


class TestFindMatchedKeywords:
    """Test matched keyword detection."""

    def test_finds_matching_keywords(self):
        matched = StrandClassifier._find_matched_keywords(
            "主角开始修炼突破", ["修炼", "突破", "战斗"]
        )
        assert "修炼" in matched
        assert "突破" in matched
        assert "战斗" not in matched

    def test_case_insensitive(self):
        # _find_matched_keywords expects already-lowered text (caller does content.lower())
        matched = StrandClassifier._find_matched_keywords("quest", ["Quest"])
        assert "Quest" in matched

    def test_no_matches(self):
        matched = StrandClassifier._find_matched_keywords("普通文本", ["修炼"])
        assert matched == []


# =============================================================================
# _classify_heuristic
# =============================================================================


class TestClassifyHeuristic:
    """Test heuristic classification."""

    def test_quest_heavy_content(self, classifier):
        content = "主角接到任务目标，开始追寻主线剧情，完成使命突破晋级修炼战斗准备"
        result = classifier._classify_heuristic(1, content)
        assert result.dominant == "quest"
        assert result.method == "heuristic"
        assert result.confidence > 0

    def test_fire_heavy_content(self, classifier):
        content = "感情心动喜欢爱情思念牵挂表白约会温柔拥抱亲吻守护陪伴"
        result = classifier._classify_heuristic(2, content)
        assert result.dominant == "fire"

    def test_constellation_heavy_content(self, classifier):
        content = "世界观设定背景势力门派家族规则体系等级境界功法法宝丹药灵石"
        result = classifier._classify_heuristic(3, content)
        assert result.dominant == "constellation"

    def test_empty_content(self, classifier):
        result = classifier._classify_heuristic(1, "")
        # Even empty content gets base scores (quest=3, fire=1, constellation=1)
        assert result.dominant == "quest"
        assert result.confidence > 0

    def test_keywords_found_populated(self, classifier):
        content = "主角接受任务目标，推进主线"
        result = classifier._classify_heuristic(1, content)
        assert "quest" in result.keywords_found
        assert isinstance(result.keywords_found["quest"], list)

    def test_confidence_increases_with_content(self, classifier):
        short = classifier._classify_heuristic(1, "任务")
        long = classifier._classify_heuristic(2, "任务目标主线剧情推进完成使命突破晋级修炼战斗计划布局谋划策略行动执行调查追踪任务线主线剧情核心冲突故事推进冒险探索追寻寻找")
        assert long.confidence >= short.confidence


# =============================================================================
# classify_chapter (mocked DB)
# =============================================================================


class TestClassifyChapter:
    """Test chapter classification with mocked DB."""

    @pytest.mark.asyncio
    async def test_classify_with_content(self, classifier):
        mock_db = AsyncMock()
        mock_draft = MagicMock()
        mock_draft.content = "主角接到任务，开始修炼突破晋级"
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_draft
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await classifier.classify_chapter(1, mock_db)
        assert result.chapter_id == 1
        assert result.dominant in ("quest", "fire", "constellation")

    @pytest.mark.asyncio
    async def test_classify_empty_content(self, classifier):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await classifier.classify_chapter(1, mock_db)
        assert result.chapter_id == 1
        assert result.confidence == 0.0


# =============================================================================
# classify_chapters
# =============================================================================


class TestClassifyChapters:
    """Test batch classification."""

    @pytest.mark.asyncio
    async def test_classify_multiple(self, classifier):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        results = await classifier.classify_chapters([1, 2, 3], mock_db)
        assert len(results) == 3
        assert all(r.chapter_id in (1, 2, 3) for r in results)


# =============================================================================
# Keyword dictionaries
# =============================================================================


class TestKeywordDictionaries:
    """Test that keyword dictionaries are populated."""

    def test_quest_keywords_not_empty(self, classifier):
        assert len(classifier.QUEST_KEYWORDS) > 0

    def test_fire_keywords_not_empty(self, classifier):
        assert len(classifier.FIRE_KEYWORDS) > 0

    def test_constellation_keywords_not_empty(self, classifier):
        assert len(classifier.CONSTELLATION_KEYWORDS) > 0

    def test_keywords_are_strings(self, classifier):
        for kw in classifier.QUEST_KEYWORDS:
            assert isinstance(kw, str)
        for kw in classifier.FIRE_KEYWORDS:
            assert isinstance(kw, str)
        for kw in classifier.CONSTELLATION_KEYWORDS:
            assert isinstance(kw, str)


# Import for async tests
from unittest.mock import AsyncMock, MagicMock

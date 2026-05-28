import pytest
from unittest.mock import MagicMock

from src.backend.services.semantic_cache import (
    AdaptiveThreshold,
    CacheEntry,
    SemanticCache,
)


class TestCacheEntry:
    def test_default_values(self):
        entry = CacheEntry(prompt_hash="abc123")
        assert entry.prompt_hash == "abc123"
        assert entry.prompt_embedding is None
        assert entry.prompt_text == ""
        assert entry.response == ""
        assert entry.model == ""
        assert entry.hit_count == 0
        assert entry.quality_score == 1.0


class TestSemanticCacheExact:
    def test_exact_cache_hit(self):
        cache = SemanticCache()
        cache.store("什么是金手指？", "金手指是主角的特殊能力", model="minimax")
        result = cache.get_exact("什么是金手指？", model="minimax")
        assert result == "金手指是主角的特殊能力"

    def test_exact_cache_miss(self):
        cache = SemanticCache()
        cache.store("什么是金手指？", "金手指是主角的特殊能力")
        result = cache.get_exact("什么是反派？")
        assert result is None

    def test_store_and_retrieve(self):
        cache = SemanticCache()
        cache.store("写一个场景", "月光洒在湖面上...")
        cache.store("角色性格", "主角性格坚毅")
        assert cache.get_exact("写一个场景") == "月光洒在湖面上..."
        assert cache.get_exact("角色性格") == "主角性格坚毅"

    def test_exact_hit_increments_count(self):
        cache = SemanticCache()
        cache.store("test prompt", "test response")
        cache.get_exact("test prompt")
        cache.get_exact("test prompt")
        hash_key = cache._hash_prompt("test prompt")
        assert cache._exact_cache[hash_key].hit_count == 2

    def test_different_model_different_entry(self):
        cache = SemanticCache()
        cache.store("prompt", "response_a", model="model_a")
        cache.store("prompt", "response_b", model="model_b")
        assert cache.get_exact("prompt", model="model_a") == "response_a"
        assert cache.get_exact("prompt", model="model_b") == "response_b"

    def test_different_temperature_different_entry(self):
        cache = SemanticCache()
        cache.store("prompt", "response_low", temperature=0.1)
        cache.store("prompt", "response_high", temperature=0.9)
        assert cache.get_exact("prompt", temperature=0.1) == "response_low"
        assert cache.get_exact("prompt", temperature=0.9) == "response_high"


class TestPromptClassification:
    def test_classify_prompt_factual(self):
        cache = SemanticCache()
        assert cache._classify_prompt("什么是金手指") == "factual_query"
        assert cache._classify_prompt("谁是主角") == "factual_query"
        assert cache._classify_prompt("年龄多大") == "factual_query"
        assert cache._classify_prompt("名字叫什么") == "factual_query"

    def test_classify_prompt_creative(self):
        cache = SemanticCache()
        assert cache._classify_prompt("写一个场景") == "creative_generation"
        assert cache._classify_prompt("创作一段对话") == "creative_generation"
        assert cache._classify_prompt("生成角色描述") == "creative_generation"
        assert cache._classify_prompt("续写下一章") == "creative_generation"
        assert cache._classify_prompt("扩写这段文字") == "creative_generation"

    def test_classify_prompt_style(self):
        cache = SemanticCache()
        assert cache._classify_prompt("调整风格") == "style_analysis"
        assert cache._classify_prompt("修改文笔") == "style_analysis"
        assert cache._classify_prompt("改变语气") == "style_analysis"

    def test_classify_prompt_consistency(self):
        cache = SemanticCache()
        assert cache._classify_prompt("检查矛盾") == "consistency_check"
        assert cache._classify_prompt("一致性检查") == "consistency_check"

    def test_classify_prompt_character(self):
        cache = SemanticCache()
        assert cache._classify_prompt("角色设定") == "character_profile"
        assert cache._classify_prompt("人物关系") == "character_profile"
        assert cache._classify_prompt("性格分析") == "character_profile"

    def test_classify_prompt_general(self):
        cache = SemanticCache()
        assert cache._classify_prompt("hello world") == "general"
        assert cache._classify_prompt("random text") == "general"


class TestAdaptiveThreshold:
    def test_adaptive_threshold_initial(self):
        threshold = AdaptiveThreshold()
        assert threshold.get_threshold("any_type") == 0.92

    def test_adaptive_threshold_custom_initial(self):
        threshold = AdaptiveThreshold(initial=0.85)
        assert threshold.get_threshold("any_type") == 0.85

    def test_adaptive_threshold_update_good(self):
        threshold = AdaptiveThreshold(initial=0.92)
        threshold.update("factual_query", hit_was_good=True)
        assert threshold.get_threshold("factual_query") == pytest.approx(0.91)

    def test_adaptive_threshold_update_bad(self):
        threshold = AdaptiveThreshold(initial=0.92)
        threshold.update("factual_query", hit_was_good=False)
        assert threshold.get_threshold("factual_query") == pytest.approx(0.94)

    def test_adaptive_threshold_bounds(self):
        threshold = AdaptiveThreshold(initial=0.92)
        # Lower bound: many good hits should not go below 0.80
        for _ in range(100):
            threshold.update("test", hit_was_good=True)
        assert threshold.get_threshold("test") == 0.80

        # Upper bound: many bad hits should not go above 0.98
        threshold2 = AdaptiveThreshold(initial=0.92)
        for _ in range(100):
            threshold2.update("test", hit_was_good=False)
        assert threshold2.get_threshold("test") == 0.98

    def test_adaptive_threshold_per_type(self):
        threshold = AdaptiveThreshold(initial=0.92)
        threshold.update("factual_query", hit_was_good=True)
        threshold.update("creative_generation", hit_was_good=False)
        assert threshold.get_threshold("factual_query") == pytest.approx(0.91)
        assert threshold.get_threshold("creative_generation") == pytest.approx(0.94)
        assert threshold.get_threshold("general") == 0.92  # unchanged

    def test_get_all_thresholds(self):
        threshold = AdaptiveThreshold()
        threshold.update("type_a", hit_was_good=True)
        threshold.update("type_b", hit_was_good=False)
        all_t = threshold.get_all_thresholds()
        assert "type_a" in all_t
        assert "type_b" in all_t
        assert len(all_t) == 2


class TestSemanticCacheStats:
    def test_cache_stats(self):
        cache = SemanticCache()
        cache.store("prompt1", "response1")
        cache.store("prompt2", "response2")
        cache.get_exact("prompt1")
        cache.get_exact("prompt2")
        cache.get_exact("nonexistent")

        stats = cache.get_stats()
        assert stats["hits"] == 2
        assert stats["misses"] == 1
        assert stats["exact_hits"] == 2
        assert stats["vector_hits"] == 0
        assert stats["total"] == 3
        assert stats["entries"] == 2
        assert stats["hit_rate"] == pytest.approx(2 / 3)
        assert isinstance(stats["thresholds"], dict)

    def test_cache_stats_empty(self):
        cache = SemanticCache()
        stats = cache.get_stats()
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        assert stats["total"] == 0
        assert stats["hit_rate"] == 0.0
        assert stats["entries"] == 0


class TestSemanticCacheClear:
    def test_cache_clear(self):
        cache = SemanticCache()
        cache.store("prompt1", "response1")
        cache.store("prompt2", "response2")
        cache.get_exact("prompt1")

        cache.clear()
        assert cache.get_exact("prompt1") is None
        stats = cache.get_stats()
        assert stats["hits"] == 0
        assert stats["misses"] == 1  # the get_exact after clear
        assert stats["entries"] == 0


class TestVectorTier:
    def test_get_vector_no_service(self):
        cache = SemanticCache()
        result = cache.get_vector(b"embedding")
        assert result is None

    def test_get_vector_no_results(self):
        mock_vec = MagicMock()
        mock_vec.search_similar.return_value = []
        cache = SemanticCache(sqlite_vec_service=mock_vec)
        result = cache.get_vector(b"embedding")
        assert result is None

    def test_get_vector_below_threshold(self):
        mock_vec = MagicMock()
        # distance 0.2 -> similarity 0.8, below default threshold 0.92
        mock_vec.search_similar.return_value = [("hash1", 0.2)]
        cache = SemanticCache(sqlite_vec_service=mock_vec)
        result = cache.get_vector(b"embedding", prompt_type="general")
        assert result is None

    def test_get_vector_above_threshold(self):
        mock_vec = MagicMock()
        # distance 0.02 -> similarity 0.98, above default threshold 0.92
        mock_vec.search_similar.return_value = [("hash1", 0.02)]
        cache = SemanticCache(sqlite_vec_service=mock_vec)
        # Pre-populate the exact cache with the entry
        cache._exact_cache["hash1"] = CacheEntry(
            prompt_hash="hash1", response="cached response"
        )
        result = cache.get_vector(b"embedding", prompt_type="general")
        assert result is not None
        response, similarity = result
        assert response == "cached response"
        assert similarity == pytest.approx(0.98)

    def test_store_with_embedding(self):
        mock_vec = MagicMock()
        cache = SemanticCache(sqlite_vec_service=mock_vec)
        cache.store("prompt", "response", embedding=b"embedding_data")
        mock_vec.insert_embedding.assert_called_once()

    def test_store_without_embedding(self):
        mock_vec = MagicMock()
        cache = SemanticCache(sqlite_vec_service=mock_vec)
        cache.store("prompt", "response")
        mock_vec.insert_embedding.assert_not_called()

    def test_vector_feedback_updates_threshold(self):
        cache = SemanticCache()
        cache.feedback("factual_query", hit_was_good=True)
        stats = cache.get_stats()
        assert "factual_query" in stats["thresholds"]
        assert stats["thresholds"]["factual_query"] == pytest.approx(0.91)

"""Tests for Guidance Builder - strategy cards, guidance items, checklists."""

import pytest
from unittest.mock import patch

from backend.services.guidance_builder import (
    GENRE_GUIDANCE_TEXT,
    GENRE_METHOD_ANCHORS,
    build_methodology_strategy_card,
    build_methodology_guidance_items,
    build_guidance_items,
    build_writing_checklist,
    is_checklist_item_completed,
    GuidanceBuilder,
)


# =============================================================================
# build_methodology_strategy_card
# =============================================================================


class TestBuildMethodologyStrategyCard:
    """Test strategy card generation."""

    def test_basic_card_structure(self):
        card = build_methodology_strategy_card(
            chapter=1,
            reader_signal={},
            genre_profile={"genre": "xianxia"},
        )
        assert card["enabled"] is True
        assert card["chapter_stage"] == "build_up"
        assert card["genre_profile_key"] == "xianxia"
        assert "observability" in card
        assert "signals" in card

    def test_chapter_stage_mapping(self):
        # stage_mod 1,2 -> build_up; 3,4 -> confront; 0 -> release
        assert build_methodology_strategy_card(chapter=1, reader_signal={}, genre_profile={})["chapter_stage"] == "build_up"
        assert build_methodology_strategy_card(chapter=3, reader_signal={}, genre_profile={})["chapter_stage"] == "confront"
        assert build_methodology_strategy_card(chapter=5, reader_signal={}, genre_profile={})["chapter_stage"] == "release"

    def test_dominant_hook_from_usage(self):
        signal = {"hook_type_usage": {"cliffhanger": 5, "suspense": 2}}
        card = build_methodology_strategy_card(chapter=1, reader_signal=signal, genre_profile={})
        assert card["signals"]["dominant_hook"] == "cliffhanger"

    def test_dominant_pattern_from_usage(self):
        signal = {"pattern_usage": {"power_up": 10, "reversal": 3}}
        card = build_methodology_strategy_card(chapter=1, reader_signal=signal, genre_profile={})
        assert card["signals"]["dominant_pattern"] == "power_up"

    def test_risk_flags_low_score(self):
        signal = {"low_score_ranges": [{"start": 1, "end": 5, "overall_score": 60}]}
        card = build_methodology_strategy_card(chapter=1, reader_signal=signal, genre_profile={})
        assert "low_score_recency" in card["signals"]["risk_flags"]

    def test_risk_flags_pattern_overuse(self):
        signal = {"pattern_usage": {"power_up": 10}}
        card = build_methodology_strategy_card(chapter=1, reader_signal=signal, genre_profile={})
        assert "pattern_overuse_watch" in card["signals"]["risk_flags"]

    def test_unknown_genre_uses_general(self):
        card = build_methodology_strategy_card(
            chapter=1, reader_signal={}, genre_profile={"genre": "unknown_genre"}
        )
        assert "pilot" in card

    def test_known_genre_uses_profile_key(self):
        card = build_methodology_strategy_card(
            chapter=1, reader_signal={}, genre_profile={"genre": "xianxia"}
        )
        assert card["pilot"] == "xianxia"
        assert card["emotion_anchor"]["pressure_source"] == "资源争夺/境界压制"


# =============================================================================
# build_methodology_guidance_items
# =============================================================================


class TestBuildMethodologyGuidanceItems:
    """Test methodology guidance item generation."""

    def test_disabled_card_returns_empty(self):
        items = build_methodology_guidance_items({"enabled": False})
        assert items == []

    def test_non_dict_returns_empty(self):
        items = build_methodology_guidance_items({})
        assert items == []

    def test_build_up_stage(self):
        card = build_methodology_strategy_card(chapter=1, reader_signal={}, genre_profile={})
        items = build_methodology_guidance_items(card)
        assert len(items) >= 4
        assert any("铺压" in item for item in items)

    def test_confront_stage(self):
        card = build_methodology_strategy_card(chapter=3, reader_signal={}, genre_profile={})
        items = build_methodology_guidance_items(card)
        assert any("对抗" in item for item in items)

    def test_pattern_overuse_adds_risk_item(self):
        signal = {"pattern_usage": {"power_up": 10}}
        card = build_methodology_strategy_card(chapter=1, reader_signal=signal, genre_profile={})
        items = build_methodology_guidance_items(card)
        assert any("风险修正" in item and "power_up" in item for item in items)

    def test_readability_guard_adds_risk_item(self):
        signal = {"review_trend": {"overall_avg": 60}}
        card = build_methodology_strategy_card(chapter=1, reader_signal=signal, genre_profile={})
        items = build_methodology_guidance_items(card)
        assert any("风险修正" in item and "均分" in item for item in items)


# =============================================================================
# build_guidance_items
# =============================================================================


class TestBuildGuidanceItems:
    """Test guidance item building."""

    def test_minimal_input(self):
        result = build_guidance_items(chapter=1, reader_signal={}, genre_profile={})
        assert "guidance" in result
        assert len(result["guidance"]) >= 2  # baseline items

    def test_low_score_range_adds_item(self):
        signal = {"low_score_ranges": [{"start_chapter": 1, "end_chapter": 5, "overall_score": 60}]}
        result = build_guidance_items(chapter=10, reader_signal=signal, genre_profile={})
        assert any("低分段" in g for g in result["guidance"])

    def test_hook_diversify(self):
        signal = {"hook_type_usage": {"cliffhanger": 10, "suspense": 1}}
        result = build_guidance_items(chapter=1, reader_signal=signal, genre_profile={})
        assert any("钩子差异化" in g for g in result["guidance"])

    def test_hook_diversify_disabled(self):
        signal = {"hook_type_usage": {"cliffhanger": 10}}
        result = build_guidance_items(
            chapter=1, reader_signal=signal, genre_profile={}, hook_diversify_enabled=False
        )
        assert not any("钩子差异化" in g for g in result["guidance"])

    def test_pattern_usage(self):
        signal = {"pattern_usage": {"power_up": 5}}
        result = build_guidance_items(chapter=1, reader_signal=signal, genre_profile={})
        assert any("爽点模式" in g for g in result["guidance"])

    def test_low_review_trend(self):
        signal = {"review_trend": {"overall_avg": 65}}
        result = build_guidance_items(chapter=1, reader_signal=signal, genre_profile={}, low_score_threshold=75.0)
        assert any("65.0" in g for g in result["guidance"])

    def test_genre_hint_added(self):
        result = build_guidance_items(chapter=1, reader_signal={}, genre_profile={"genre": "xianxia"})
        assert any("题材锚定" in g for g in result["guidance"])

    def test_composite_hints(self):
        profile = {"genre": "xianxia", "composite_hints": ["混合题材提示"]}
        result = build_guidance_items(chapter=1, reader_signal={}, genre_profile=profile)
        assert any("复合题材" in g for g in result["guidance"])

    def test_reference_hints(self):
        profile = {"genre": "xianxia", "reference_hints": ["参考提示1"]}
        result = build_guidance_items(chapter=1, reader_signal={}, genre_profile=profile)
        assert any("可执行提示" in g for g in result["guidance"])


# =============================================================================
# build_writing_checklist
# =============================================================================


class TestBuildWritingChecklist:
    """Test checklist generation."""

    def test_minimum_items(self):
        checklist = build_writing_checklist(
            guidance_items=[], reader_signal={}, genre_profile={}
        )
        assert len(checklist) >= 3  # fallback items

    def test_max_items_respected(self):
        checklist = build_writing_checklist(
            guidance_items=[f"item{i}" for i in range(50)],
            reader_signal={},
            genre_profile={},
            max_items=5,
        )
        assert len(checklist) <= 5

    def test_no_duplicate_ids(self):
        checklist = build_writing_checklist(
            guidance_items=["same", "same"],
            reader_signal={},
            genre_profile={},
        )
        ids = [item["id"] for item in checklist]
        assert len(ids) == len(set(ids))

    def test_low_range_adds_required_item(self):
        signal = {"low_score_ranges": [{"start_chapter": 1, "end_chapter": 5, "overall_score": 60}]}
        checklist = build_writing_checklist(
            guidance_items=[], reader_signal=signal, genre_profile={}
        )
        fix_items = [i for i in checklist if i["id"] == "fix_low_score_range"]
        assert len(fix_items) == 1
        assert fix_items[0]["required"] is True

    def test_strategy_card_adds_methodology_items(self):
        strategy_card = {"enabled": True}
        checklist = build_writing_checklist(
            guidance_items=[],
            reader_signal={},
            genre_profile={},
            strategy_card=strategy_card,
        )
        methodology_ids = [i["id"] for i in checklist if i["id"].startswith("methodology_")]
        assert len(methodology_ids) >= 2

    def test_weight_clamped_positive(self):
        checklist = build_writing_checklist(
            guidance_items=["test"],
            reader_signal={},
            genre_profile={},
            default_weight=-1.0,
        )
        for item in checklist:
            assert isinstance(item["weight"], (int, float))


# =============================================================================
# is_checklist_item_completed
# =============================================================================


class TestIsChecklistItemCompleted:
    """Test checklist completion detection."""

    def test_fix_low_score_completed_when_avg_high(self):
        item = {"id": "fix_low_score_range"}
        signal = {"review_trend": {"overall_avg": 80.0}}
        assert is_checklist_item_completed(item, signal) is True

    def test_fix_low_score_not_completed_when_avg_low(self):
        item = {"id": "fix_low_score_range"}
        signal = {"review_trend": {"overall_avg": 60.0}}
        assert is_checklist_item_completed(item, signal) is False

    def test_hook_diversification_completed_with_variety(self):
        item = {"id": "hook_diversification"}
        signal = {"hook_type_usage": {"cliffhanger": 3, "suspense": 2}}
        assert is_checklist_item_completed(item, signal) is True

    def test_hook_diversification_not_completed_single_type(self):
        item = {"id": "hook_diversification"}
        signal = {"hook_type_usage": {"cliffhanger": 5}}
        assert is_checklist_item_completed(item, signal) is False

    def test_genre_anchor_always_completed(self):
        item = {"id": "genre_anchor_consistency"}
        assert is_checklist_item_completed(item, {}) is True

    def test_fallback_always_completed(self):
        item = {"id": "opening_conflict", "source": "fallback"}
        assert is_checklist_item_completed(item, {}) is True

    def test_methodology_always_completed(self):
        item = {"id": "methodology_next_reason", "source": "methodology.next_reason"}
        assert is_checklist_item_completed(item, {}) is True

    def test_unknown_item_not_completed(self):
        item = {"id": "unknown_item", "source": "unknown"}
        assert is_checklist_item_completed(item, {}) is False

    def test_readability_loop_completed_when_avg_high(self):
        item = {"id": "readability_loop"}
        signal = {"review_trend": {"overall_avg": 80.0}}
        assert is_checklist_item_completed(item, signal) is True

    def test_coolpoint_combo_completed_with_patterns(self):
        item = {"id": "coolpoint_combo"}
        signal = {"pattern_usage": {"power_up": 3, "reversal": 2}}
        assert is_checklist_item_completed(item, signal) is True


# =============================================================================
# GuidanceBuilder class
# =============================================================================


class TestGuidanceBuilder:
    """Test the GuidanceBuilder class."""

    def test_full_guidance_structure(self):
        builder = GuidanceBuilder(
            genre_profile={"genre": "xianxia"},
            reader_signal={"hook_type_usage": {"cliffhanger": 5}},
        )
        result = builder.build_full_guidance(chapter=3)
        assert "strategy_card" in result
        assert "guidance" in result
        assert "methodology" in result
        assert "checklist" in result
        assert "checklist_completion" in result
        assert "risk_flags" in result
        assert result["chapter"] == 3

    def test_empty_reader_signal(self):
        builder = GuidanceBuilder(genre_profile={})
        result = builder.build_full_guidance(chapter=1)
        assert result["chapter"] == 1
        assert isinstance(result["checklist"], list)

    def test_checklist_completion_calculated(self):
        builder = GuidanceBuilder(
            genre_profile={},
            reader_signal={"review_trend": {"overall_avg": 80.0}},
        )
        result = builder.build_full_guidance(chapter=1)
        assert result["checklist_completion"]["total"] >= 0
        assert result["checklist_completion"]["percentage"] >= 0

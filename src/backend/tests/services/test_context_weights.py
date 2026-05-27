"""Tests for ContextWeights - entity type weights, template weights, and dynamic weights."""

import pytest
import json
from backend.services.context_weights import (
    ContextWeights,
    ENTITY_TYPE_WEIGHTS,
    TEMPLATE_WEIGHTS,
    context_weights,
)


@pytest.fixture
def weights():
    """Create a fresh ContextWeights instance."""
    return ContextWeights()


# =============================================================================
# Entity type weights
# =============================================================================

class TestEntityWeights:
    """Test entity type weight management."""

    def test_default_character_weight(self, weights):
        """Character has the highest default weight."""
        assert weights.get_entity_weight("character") == 1.0

    def test_default_item_weight(self, weights):
        """Item has a lower default weight than character."""
        assert weights.get_entity_weight("item") < weights.get_entity_weight("character")

    def test_unknown_entity_returns_one(self, weights):
        """Unknown entity type returns 1.0."""
        assert weights.get_entity_weight("unknown_type") == 1.0

    def test_set_entity_weight(self, weights):
        """Setting a weight updates the value."""
        weights.set_entity_weight("custom_type", 1.5)
        assert weights.get_entity_weight("custom_type") == 1.5

    def test_set_entity_weight_clamps_to_range(self, weights):
        """Weights are clamped to [0.0, 2.0]."""
        weights.set_entity_weight("test", 3.0)
        assert weights.get_entity_weight("test") == 2.0

        weights.set_entity_weight("test2", -1.0)
        assert weights.get_entity_weight("test2") == 0.0

    def test_get_all_entity_weights(self, weights):
        """get_all_entity_weights returns a copy."""
        all_w = weights.get_all_entity_weights()
        assert "character" in all_w
        assert "item" in all_w
        # Modifying the copy doesn't affect original
        all_w["character"] = 999
        assert weights.get_entity_weight("character") == 1.0

    def test_reset_entity_weights(self, weights):
        """reset_entity_weights restores defaults."""
        weights.set_entity_weight("character", 0.5)
        weights.reset_entity_weights()
        assert weights.get_entity_weight("character") == 1.0


# =============================================================================
# Template weights
# =============================================================================

class TestTemplateWeights:
    """Test template weight management."""

    def test_default_plot_template(self, weights):
        """Default plot template has expected values."""
        tpl = weights.get_template_weight("plot")
        assert "core" in tpl
        assert "scene" in tpl
        assert "global" in tpl
        assert abs(sum(tpl.values()) - 1.0) < 0.01

    def test_unknown_template_returns_plot(self, weights):
        """Unknown template returns plot defaults."""
        tpl = weights.get_template_weight("nonexistent")
        default = weights.get_template_weight("plot")
        assert tpl == default

    def test_set_template_weight_normalizes(self, weights):
        """Setting template weights normalizes to sum to 1.0."""
        weights.set_template_weight("custom", {"core": 0.6, "scene": 0.3, "global": 0.1})
        tpl = weights.get_template_weight("custom")
        assert abs(sum(tpl.values()) - 1.0) < 0.01

    def test_get_all_template_weights(self, weights):
        """get_all_template_weights returns all templates."""
        all_tpl = weights.get_all_template_weights()
        assert "plot" in all_tpl
        assert "battle" in all_tpl

    def test_reset_template_weights(self, weights):
        """reset_template_weights restores defaults."""
        weights.set_template_weight("plot", {"core": 0.9, "scene": 0.05, "global": 0.05})
        weights.reset_template_weights()
        tpl = weights.get_template_weight("plot")
        assert tpl == TEMPLATE_WEIGHTS["plot"]


# =============================================================================
# Dynamic stage-based weights
# =============================================================================

class TestDynamicWeights:
    """Test dynamic stage-based weight management."""

    def test_early_stage_weights(self, weights):
        """Early stage has different weights than mid."""
        early = weights.get_dynamic_weights("early", "plot")
        mid = weights.get_dynamic_weights("mid", "plot")
        assert early != mid

    def test_unknown_stage_returns_mid(self, weights):
        """Unknown stage falls back to mid."""
        result = weights.get_dynamic_weights("unknown", "plot")
        mid = weights.get_dynamic_weights("mid", "plot")
        assert result == mid

    def test_set_dynamic_weights(self, weights):
        """Setting dynamic weights updates the value."""
        weights.set_dynamic_weights("custom_stage", "plot", {"core": 0.5, "scene": 0.3, "global": 0.2})
        result = weights.get_dynamic_weights("custom_stage", "plot")
        assert abs(sum(result.values()) - 1.0) < 0.01

    def test_get_all_dynamic_weights(self, weights):
        """get_all_dynamic_weights returns all stages."""
        all_dw = weights.get_all_dynamic_weights()
        assert "early" in all_dw
        assert "mid" in all_dw
        assert "late" in all_dw

    def test_reset_dynamic_weights_returns_new_dict(self, weights):
        """reset_dynamic_weights creates a fresh dict reference."""
        old_ref = weights._dynamic_weights
        weights.reset_dynamic_weights()
        # reset replaces the top-level dict
        assert weights._dynamic_weights is not old_ref


# =============================================================================
# Composite weight resolution
# =============================================================================

class TestResolveWeights:
    """Test composite weight resolution."""

    def test_resolve_with_defaults(self, weights):
        """resolve_weights with no args uses defaults."""
        result = weights.resolve_weights()
        assert result["template"] == "plot"
        assert result["stage"] == "mid"
        assert "template_weights" in result

    def test_resolve_with_entity_type(self, weights):
        """resolve_weights includes entity weight when type provided."""
        result = weights.resolve_weights(entity_type="character")
        assert "entity_weight" in result
        assert result["entity_weight"] == 1.0

    def test_resolve_with_stage(self, weights):
        """resolve_weights uses specified stage."""
        result = weights.resolve_weights(stage="early")
        assert result["stage"] == "early"


# =============================================================================
# Serialization
# =============================================================================

class TestSerialization:
    """Test JSON serialization/deserialization."""

    def test_to_dict_contains_all_sections(self, weights):
        """to_dict includes all weight sections."""
        d = weights.to_dict()
        assert "entity_weights" in d
        assert "template_weights" in d
        assert "dynamic_weights" in d

    def test_from_dict_restores_weights(self, weights):
        """from_dict restores weights from dict."""
        data = {
            "entity_weights": {"character": 1.5, "item": 0.8},
            "template_weights": {"custom": {"core": 0.5, "scene": 0.3, "global": 0.2}},
            "dynamic_weights": {},
        }
        weights.from_dict(data)
        assert weights.get_entity_weight("character") == 1.5

    def test_to_json_produces_valid_json(self, weights):
        """to_json produces valid JSON string."""
        j = weights.to_json()
        parsed = json.loads(j)
        assert "entity_weights" in parsed

    def test_from_json_restores_weights(self, weights):
        """from_json restores weights from JSON string."""
        data = {"entity_weights": {"test_type": 1.2}}
        weights.from_json(json.dumps(data))
        assert weights.get_entity_weight("test_type") == 1.2


# =============================================================================
# Module singleton
# =============================================================================

class TestSingleton:
    """Test module-level singleton."""

    def test_singleton_is_context_weights_instance(self):
        assert isinstance(context_weights, ContextWeights)

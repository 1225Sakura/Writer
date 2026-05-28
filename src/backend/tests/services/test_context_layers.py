"""Tests for ContextLayer dataclass and LayerAssembler 4-layer assembly."""

import math

import pytest

from backend.services.context_layers import (
    ContextLayer,
    LayerAssembler,
    LayeredContextPack,
    LayerType,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def assembler():
    """Default assembler with standard 4-layer configuration."""
    return LayerAssembler()


@pytest.fixture
def sample_pack():
    """A flat context pack mimicking real data for chapter 5."""
    return {
        "core": {"summary": "Protagonist enters the cave."},
        "scene": {"setting": "Dark cave entrance", "mood": "tense"},
        "global": {"world": "Xianxia universe"},
        "reader_signal": {"engagement": "high"},
        "genre_profile": {"genre": "xianxia", "subgenre": "cultivation"},
        "writing_guidance": {"style": "descriptive", "pov": "third-limited"},
        "story_skeleton": {"arc": "Cave of Trials", "act": 2},
        "memory": {"arc_memories": ["Met elder"], "chapter_memories": ["Entered cave"]},
        "preferences": {"length": "medium"},
        "alerts": {"consistency": ["Check timeline"]},
        "meta": {"chapter_order": 5},
    }


# =============================================================================
# LayerType enum
# =============================================================================


class TestLayerType:
    def test_four_values(self):
        assert len(LayerType) == 4

    def test_string_values(self):
        assert LayerType.GLOBAL.value == "global"
        assert LayerType.ARC.value == "arc"
        assert LayerType.CHAPTER.value == "chapter"
        assert LayerType.SCENE.value == "scene"


# =============================================================================
# ContextLayer dataclass
# =============================================================================


class TestContextLayer:
    def test_frozen(self):
        layer = ContextLayer(
            layer_type=LayerType.GLOBAL,
            sections=["a"],
            base_weight=0.5,
            decay_lambda=0.0,
        )
        with pytest.raises(AttributeError):
            layer.base_weight = 0.9  # type: ignore[misc]

    def test_default_max_chars_is_none(self):
        layer = ContextLayer(
            layer_type=LayerType.SCENE,
            sections=["scene"],
            base_weight=0.2,
            decay_lambda=0.46,
        )
        assert layer.max_chars is None


# =============================================================================
# Default layer coverage
# =============================================================================


class TestDefaultLayers:
    def test_default_layers_cover_all_sections(self, assembler):
        """All 10 sections from ContextManager.SECTION_ORDER must be mapped."""
        expected_sections = {
            "core",
            "scene",
            "global",
            "reader_signal",
            "genre_profile",
            "writing_guidance",
            "story_skeleton",
            "memory",
            "preferences",
            "alerts",
        }
        mapped = set(assembler.section_map.keys())
        assert mapped == expected_sections, (
            f"Missing: {expected_sections - mapped}, "
            f"Extra: {mapped - expected_sections}"
        )

    def test_four_layers_defined(self, assembler):
        assert len(assembler.layers) == 4

    def test_weights_sum_to_one(self):
        """Base weights of all default layers should sum to 1.0."""
        total = sum(l.base_weight for l in LayerAssembler.DEFAULT_LAYERS)
        assert abs(total - 1.0) < 1e-9

    def test_global_lambda_is_zero(self, assembler):
        """L1 Global must not decay."""
        global_layer = assembler.layers[0]
        assert global_layer.layer_type == LayerType.GLOBAL
        assert global_layer.decay_lambda == 0.0


# =============================================================================
# Decay math
# =============================================================================


class TestDecay:
    def test_apply_decay_at_distance_zero(self, assembler):
        """At distance 0 the weight equals base_weight (1/log2(2)=1.0)."""
        layer = ContextLayer(LayerType.ARC, [], 0.25, 0.46)
        result = assembler.apply_decay(layer, chapter_distance=0)
        assert result == pytest.approx(0.25)

    def test_apply_decay_at_distance_one(self, assembler):
        """At distance 1 the weight is ~0.63 * base_weight (1/log2(3))."""
        layer = ContextLayer(LayerType.ARC, [], 0.25, 0.46)
        result = assembler.apply_decay(layer, chapter_distance=1)
        expected = 0.25 * (1.0 / math.log2(3))
        assert result == pytest.approx(expected, rel=1e-6)
        assert result == pytest.approx(0.25 * 0.631, rel=0.01)

    def test_apply_decay_at_distance_three(self, assembler):
        """At distance 3 the weight is ~0.43 * base_weight (1/log2(5))."""
        layer = ContextLayer(LayerType.ARC, [], 0.25, 0.46)
        result = assembler.apply_decay(layer, chapter_distance=3)
        expected = 0.25 * (1.0 / math.log2(5))
        assert result == pytest.approx(expected, rel=1e-6)
        assert result == pytest.approx(0.25 * 0.431, rel=0.01)

    def test_global_layer_no_decay(self, assembler):
        """L1 (Global) has lambda=0.0 — weight is constant at any distance."""
        global_layer = assembler.layers[0]
        assert global_layer.decay_lambda == 0.0
        for dist in (0, 1, 5, 100):
            assert assembler.apply_decay(global_layer, dist) == pytest.approx(
                global_layer.base_weight
            )

    def test_negative_distance_clamped_to_zero(self, assembler):
        """Negative chapter distance should be treated as 0."""
        layer = ContextLayer(LayerType.SCENE, [], 0.20, 0.46)
        result = assembler.apply_decay(layer, chapter_distance=-5)
        assert result == pytest.approx(0.20)

    def test_custom_lambda_enables_decay(self):
        """Assembler with custom layer config applies decay when lambda > 0."""
        custom = ContextLayer(LayerType.ARC, ["x"], 0.50, 1.0)
        asm = LayerAssembler(layers=[custom])
        result = asm.apply_decay(custom, chapter_distance=1)
        # decay_lambda > 0 means decay is applied: base * 1/log2(3)
        assert result == pytest.approx(0.50 * (1.0 / math.log2(3)), rel=1e-6)


# =============================================================================
# Section mapping
# =============================================================================


class TestSectionMapping:
    def test_get_section_layer_mapping(self, assembler):
        """Each section must map to its expected layer."""
        expected = {
            "reader_signal": LayerType.GLOBAL,
            "genre_profile": LayerType.GLOBAL,
            "writing_guidance": LayerType.GLOBAL,
            "preferences": LayerType.GLOBAL,
            "global": LayerType.GLOBAL,
            "story_skeleton": LayerType.ARC,
            "core": LayerType.CHAPTER,
            "scene": LayerType.SCENE,
            "alerts": LayerType.SCENE,
        }
        for section, expected_layer in expected.items():
            actual = assembler.get_section_layer(section)
            assert actual == expected_layer, (
                f"Section '{section}' mapped to {actual}, expected {expected_layer}"
            )

    def test_memory_maps_to_last_registered_layer(self, assembler):
        """'memory' appears in both ARC and CHAPTER; last-write wins in the map."""
        layer = assembler.get_section_layer("memory")
        # CHAPTER is defined after ARC, so it overwrites
        assert layer == LayerType.CHAPTER

    def test_unknown_section_returns_none(self, assembler):
        assert assembler.get_section_layer("nonexistent") is None


# =============================================================================
# Assemble
# =============================================================================


class TestAssemble:
    def test_assemble_produces_layered_pack(self, assembler, sample_pack):
        """Full assembly should produce all four layers with correct content."""
        result = assembler.assemble(sample_pack, current_chapter_order=5)

        assert isinstance(result, LayeredContextPack)
        assert set(result.layers.keys()) == set(LayerType)

        # L1 Global should contain global-scope sections
        l1 = result.layers[LayerType.GLOBAL]
        assert "reader_signal" in l1
        assert "genre_profile" in l1
        assert "writing_guidance" in l1
        assert "preferences" in l1
        assert "global" in l1

        # L2 Arc
        l2 = result.layers[LayerType.ARC]
        assert "story_skeleton" in l2
        assert "memory" in l2

        # L3 Chapter
        l3 = result.layers[LayerType.CHAPTER]
        assert "core" in l3
        assert "memory" in l3

        # L4 Scene
        l4 = result.layers[LayerType.SCENE]
        assert "scene" in l4
        assert "alerts" in l4

    def test_assemble_weights_normalised(self, assembler, sample_pack):
        """Weights must sum to 1.0 after normalisation."""
        result = assembler.assemble(sample_pack, current_chapter_order=5)
        total = sum(result.weights_applied.values())
        assert total == pytest.approx(1.0, abs=1e-9)

    def test_assemble_meta_passthrough(self, assembler, sample_pack):
        """Metadata from the pack should be passed through."""
        result = assembler.assemble(sample_pack, current_chapter_order=5)
        assert result.meta == {"chapter_order": 5}

    def test_assemble_same_chapter_no_decay_for_non_global(self, assembler, sample_pack):
        """When assembling for the same chapter, non-global layers have distance=0."""
        # current_chapter_order == pack's chapter_order => distance=0
        result = assembler.assemble(sample_pack, current_chapter_order=5)
        # All weights should reflect base_weight (no decay), normalised
        base_weights = {l.layer_type: l.base_weight for l in assembler.layers}
        total = sum(base_weights.values())
        for lt, w in result.weights_applied.items():
            assert w == pytest.approx(base_weights[lt] / total, rel=1e-9)

    def test_assemble_with_chapter_distance(self, assembler, sample_pack):
        """Older pack should see L2-L4 decayed while L1 stays constant."""
        # Assemble an old pack (chapter 2) for current chapter 5 => distance=3
        old_pack = {**sample_pack, "meta": {"chapter_order": 2}}
        result = assembler.assemble(old_pack, current_chapter_order=5)

        # L1 weight should be higher than its base proportion (because others decayed)
        l1_weight = result.weights_applied[LayerType.GLOBAL]
        l4_weight = result.weights_applied[LayerType.SCENE]
        assert l1_weight > l4_weight  # L1 undecayed, L4 decays

    def test_assemble_backward_compat_flat_pack(self, assembler):
        """A flat pack without 'meta' key should still assemble (distance=0)."""
        flat_pack = {
            "core": {"text": "Hello"},
            "scene": {"place": "Room"},
        }
        result = assembler.assemble(flat_pack, current_chapter_order=1)
        assert isinstance(result, LayeredContextPack)
        assert result.layers[LayerType.CHAPTER]["core"] == {"text": "Hello"}
        assert result.layers[LayerType.SCENE]["scene"] == {"place": "Room"}
        assert result.meta == {}

    def test_assemble_missing_sections_produce_empty_layers(self):
        """If a pack has no matching sections, those layers are empty dicts."""
        asm = LayerAssembler()
        minimal = {"core": {"x": 1}}
        result = asm.assemble(minimal, current_chapter_order=0)
        assert result.layers[LayerType.GLOBAL] == {}
        assert result.layers[LayerType.ARC] == {}
        assert result.layers[LayerType.SCENE] == {}
        assert result.layers[LayerType.CHAPTER] == {"core": {"x": 1}}

    def test_assemble_empty_pack(self, assembler):
        """An empty pack should produce empty layers, weights normalised to base proportions."""
        result = assembler.assemble({}, current_chapter_order=0)
        # All layers are empty content
        assert all(lc == {} for lc in result.layers.values())
        # Weights are still normalised to base_weight proportions (sum to 1.0)
        total = sum(result.weights_applied.values())
        assert total == pytest.approx(1.0, abs=1e-9)

"""Context Layer Assembly — 4-layer structure with exponential decay.

Organizes context sections into 4 hierarchical layers (Global / Arc / Chapter / Scene)
and applies chapter-distance decay so older context fades gracefully.

L1 (Global):  reader_signal, genre_profile, writing_guidance, preferences, global
              decay_lambda=0.0 — global settings never decay.
L2 (Arc):     story_skeleton, memory (arc-level)
L3 (Chapter): core, memory (chapter-level)
L4 (Scene):   scene, alerts
L2-L4:        decay_lambda=0.46 — weight(0)=1.0, weight(1)~0.63, weight(3)~0.43
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class LayerType(Enum):
    """The four context layers, ordered by scope (broadest → most local)."""

    GLOBAL = "global"      # L1: reader_signal, genre_profile, writing_guidance, preferences
    ARC = "arc"            # L2: story_skeleton, memory (arc-level)
    CHAPTER = "chapter"    # L3: core, memory (chapter-level)
    SCENE = "scene"        # L4: scene, alerts


@dataclass(frozen=True)
class ContextLayer:
    """Configuration for a single context layer.

    Attributes:
        layer_type:     Which layer this config belongs to.
        sections:       Section names (keys in the flat context pack) assigned here.
        base_weight:    Default budget allocation fraction (0.0-1.0) before decay.
        decay_lambda:   Exponential decay rate per chapter-distance unit.
                        0.0 means no decay (used for L1 Global).
        max_chars:      Optional hard cap on characters for this layer.
                        ``None`` means proportional allocation from the global budget.
    """

    layer_type: LayerType
    sections: List[str]
    base_weight: float
    decay_lambda: float
    max_chars: Optional[int] = None


@dataclass
class LayeredContextPack:
    """Result of assembling a flat context pack into the 4-layer structure.

    Attributes:
        layers:          Layer type -> {section_name: content} mapping.
        meta:            Passthrough metadata from the source pack.
        weights_applied: Final normalised weight per layer after decay.
    """

    layers: Dict[LayerType, Dict[str, Any]]
    meta: Dict[str, Any]
    weights_applied: Dict[LayerType, float]


class LayerAssembler:
    """Assembles a flat context pack into a 4-layer hierarchy with decay.

    Default layer configuration maps all 10 sections from
    ``ContextManager.SECTION_ORDER``:

        L1 GLOBAL  (0.20, lambda=0.0): reader_signal, genre_profile,
                                        writing_guidance, preferences, global
        L2 ARC     (0.25, lambda=0.46): story_skeleton, memory
        L3 CHAPTER (0.35, lambda=0.46): core, memory
        L4 SCENE   (0.20, lambda=0.46): scene, alerts

    Sections that appear in multiple layers (e.g. ``"memory"``) are expected
    to carry different scopes — the caller is responsible for providing the
    correct scope under each key if both are present.
    """

    DEFAULT_LAYERS: List[ContextLayer] = [
        ContextLayer(
            layer_type=LayerType.GLOBAL,
            sections=["reader_signal", "genre_profile", "writing_guidance", "preferences", "global"],
            base_weight=0.20,
            decay_lambda=0.0,
        ),
        ContextLayer(
            layer_type=LayerType.ARC,
            sections=["story_skeleton", "memory"],
            base_weight=0.25,
            decay_lambda=0.46,
        ),
        ContextLayer(
            layer_type=LayerType.CHAPTER,
            sections=["core", "memory"],
            base_weight=0.35,
            decay_lambda=0.46,
        ),
        ContextLayer(
            layer_type=LayerType.SCENE,
            sections=["scene", "alerts"],
            base_weight=0.20,
            decay_lambda=0.46,
        ),
    ]

    def __init__(self, layers: Optional[List[ContextLayer]] = None) -> None:
        self._layers: List[ContextLayer] = layers or list(self.DEFAULT_LAYERS)
        # Build reverse map: section_name -> layer_type
        self._section_map: Dict[str, LayerType] = {}
        for layer in self._layers:
            for section in layer.sections:
                self._section_map[section] = layer.layer_type

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def apply_decay(self, layer: ContextLayer, chapter_distance: int) -> float:
        """Calculate the decaying weight for *layer* at *chapter_distance* chapters away.

        Uses ``base_weight * 1/log2(distance + 2)`` for layers with decay.
        Returns ``base_weight`` unchanged when ``decay_lambda <= 0``.
        """
        if layer.decay_lambda <= 0:
            return layer.base_weight
        return layer.base_weight * (1.0 / math.log2(max(0, chapter_distance) + 2))

    def get_section_layer(self, section_name: str) -> Optional[LayerType]:
        """Return which layer a section name belongs to, or ``None``."""
        return self._section_map.get(section_name)

    def assemble(
        self,
        pack: Dict[str, Any],
        current_chapter_order: int,
        max_chars: int = 8000,
    ) -> LayeredContextPack:
        """Assemble a flat context pack into a layered structure with decay.

        Parameters:
            pack:                  Flat dict whose keys are section names
                                   (and optionally ``"meta"`` for metadata).
            current_chapter_order: The chapter order number of the chapter being
                                   generated — used to compute distance-based decay.
            max_chars:             Total character budget (informational; actual
                                   truncation is performed downstream).

        Returns:
            A ``LayeredContextPack`` with per-layer content and normalised weights.
        """
        layers: Dict[LayerType, Dict[str, Any]] = {}
        weights: Dict[LayerType, float] = {}

        for layer in self._layers:
            layer_content: Dict[str, Any] = {}
            for section in layer.sections:
                if section in pack:
                    layer_content[section] = pack[section]

            # Determine chapter distance for decay
            # Use the pack's own meta.chapter_order if present, else assume
            # the pack is about the current chapter (distance = 0).
            pack_chapter_order = pack.get("meta", {}).get("chapter_order")
            if pack_chapter_order is not None:
                distance = max(0, current_chapter_order - pack_chapter_order)
            else:
                distance = 0

            decayed_weight = self.apply_decay(layer, distance)
            weights[layer.layer_type] = decayed_weight
            layers[layer.layer_type] = layer_content

        # Normalise so weights sum to 1.0
        total = sum(weights.values())
        if total > 0:
            weights = {k: v / total for k, v in weights.items()}

        return LayeredContextPack(
            layers=layers,
            meta=pack.get("meta", {}),
            weights_applied=weights,
        )

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    @property
    def section_map(self) -> Dict[str, LayerType]:
        """Read-only view of section -> layer mapping."""
        return dict(self._section_map)

    @property
    def layers(self) -> List[ContextLayer]:
        """Read-only view of configured layers."""
        return list(self._layers)

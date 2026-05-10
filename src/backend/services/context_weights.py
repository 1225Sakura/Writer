"""Context weights management for intelligent context ranking.

Manages dynamic weights for different context types (character, location,
prior plot, settings, etc.) and supports template-based weight presets.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from backend.infrastructure.cache.cache_service import get_cache_service


DEFAULT_TEMPLATE = "plot"

TEMPLATE_WEIGHTS: dict[str, dict[str, float]] = {
    "plot": {"core": 0.40, "scene": 0.35, "global": 0.25},
    "battle": {"core": 0.35, "scene": 0.45, "global": 0.20},
    "emotion": {"core": 0.45, "scene": 0.35, "global": 0.20},
    "transition": {"core": 0.50, "scene": 0.25, "global": 0.25},
}

TEMPLATE_WEIGHTS_DYNAMIC_DEFAULT: dict[str, dict[str, dict[str, float]]] = {
    "early": {
        "plot": {"core": 0.48, "scene": 0.39, "global": 0.13},
        "battle": {"core": 0.42, "scene": 0.50, "global": 0.08},
        "emotion": {"core": 0.52, "scene": 0.38, "global": 0.10},
        "transition": {"core": 0.56, "scene": 0.28, "global": 0.16},
    },
    "mid": {
        "plot": {"core": 0.40, "scene": 0.35, "global": 0.25},
        "battle": {"core": 0.35, "scene": 0.45, "global": 0.20},
        "emotion": {"core": 0.45, "scene": 0.35, "global": 0.20},
        "transition": {"core": 0.50, "scene": 0.25, "global": 0.25},
    },
    "late": {
        "plot": {"core": 0.36, "scene": 0.29, "global": 0.35},
        "battle": {"core": 0.31, "scene": 0.39, "global": 0.30},
        "emotion": {"core": 0.41, "scene": 0.29, "global": 0.30},
        "transition": {"core": 0.46, "scene": 0.21, "global": 0.33},
    },
}

ENTITY_TYPE_WEIGHTS: dict[str, float] = {
    "character": 1.0,
    "location": 0.9,
    "item": 0.7,
    "faction": 0.8,
    "rule": 0.75,
    "world_setting": 0.85,
    "plot_thread": 0.95,
    "outline": 0.9,
    "chapter": 0.8,
    "if_line": 0.7,
}


class ContextWeights:
    """Manages dynamic weights for context ranking."""

    _CACHE_KEY = "context_weights"
    _CACHE_TTL = 300  # 5 minutes

    def __init__(self):
        self._weights: Dict[str, float] = dict(ENTITY_TYPE_WEIGHTS)
        self._template_weights: Dict[str, Dict[str, float]] = dict(TEMPLATE_WEIGHTS)
        self._dynamic_weights: Dict[str, Dict[str, Dict[str, float]]] = dict(
            TEMPLATE_WEIGHTS_DYNAMIC_DEFAULT
        )

    # ------------------------------------------------------------------
    # Entity type weights
    # ------------------------------------------------------------------

    def get_entity_weight(self, entity_type: str) -> float:
        """Get weight for a specific entity type."""
        return self._weights.get(entity_type, 1.0)

    def set_entity_weight(self, entity_type: str, weight: float) -> None:
        """Set weight for a specific entity type."""
        self._weights[entity_type] = max(0.0, min(2.0, float(weight)))
        self._invalidate_cache()

    def get_all_entity_weights(self) -> Dict[str, float]:
        """Get all entity type weights."""
        return dict(self._weights)

    def reset_entity_weights(self) -> None:
        """Reset entity weights to defaults."""
        self._weights = dict(ENTITY_TYPE_WEIGHTS)
        self._invalidate_cache()

    # ------------------------------------------------------------------
    # Template weights (core / scene / global)
    # ------------------------------------------------------------------

    def get_template_weight(self, template: str) -> Dict[str, float]:
        """Get template weights for a named template."""
        return dict(self._template_weights.get(template, TEMPLATE_WEIGHTS[DEFAULT_TEMPLATE]))

    def set_template_weight(self, template: str, weights: Dict[str, float]) -> None:
        """Set template weights for a named template."""
        normalized = {
            "core": max(0.0, min(1.0, float(weights.get("core", 0.4)))),
            "scene": max(0.0, min(1.0, float(weights.get("scene", 0.35)))),
            "global": max(0.0, min(1.0, float(weights.get("global", 0.25)))),
        }
        # Normalize to sum to 1.0
        total = sum(normalized.values())
        if total > 0:
            normalized = {k: v / total for k, v in normalized.items()}
        self._template_weights[template] = normalized
        self._invalidate_cache()

    def get_all_template_weights(self) -> Dict[str, Dict[str, float]]:
        """Get all template weights."""
        return {k: dict(v) for k, v in self._template_weights.items()}

    def reset_template_weights(self) -> None:
        """Reset template weights to defaults."""
        self._template_weights = dict(TEMPLATE_WEIGHTS)
        self._invalidate_cache()

    # ------------------------------------------------------------------
    # Dynamic stage-based weights
    # ------------------------------------------------------------------

    def get_dynamic_weights(
        self, stage: str, template: Optional[str] = None
    ) -> Dict[str, float]:
        """Get dynamic weights for a story stage and optional template.

        Args:
            stage: One of "early", "mid", "late".
            template: Template name (defaults to DEFAULT_TEMPLATE).
        """
        stage_data = self._dynamic_weights.get(stage, self._dynamic_weights["mid"])
        tpl = template or DEFAULT_TEMPLATE
        return dict(stage_data.get(tpl, TEMPLATE_WEIGHTS[DEFAULT_TEMPLATE]))

    def set_dynamic_weights(
        self, stage: str, template: str, weights: Dict[str, float]
    ) -> None:
        """Set dynamic weights for a story stage + template."""
        normalized = {
            "core": max(0.0, min(1.0, float(weights.get("core", 0.4)))),
            "scene": max(0.0, min(1.0, float(weights.get("scene", 0.35)))),
            "global": max(0.0, min(1.0, float(weights.get("global", 0.25)))),
        }
        total = sum(normalized.values())
        if total > 0:
            normalized = {k: v / total for k, v in normalized.items()}

        if stage not in self._dynamic_weights:
            self._dynamic_weights[stage] = {}
        self._dynamic_weights[stage][template] = normalized
        self._invalidate_cache()

    def get_all_dynamic_weights(self) -> Dict[str, Dict[str, Dict[str, float]]]:
        """Get all dynamic stage-based weights."""
        return {k: {tk: dict(tv) for tk, tv in v.items()} for k, v in self._dynamic_weights.items()}

    def reset_dynamic_weights(self) -> None:
        """Reset dynamic weights to defaults."""
        self._dynamic_weights = dict(TEMPLATE_WEIGHTS_DYNAMIC_DEFAULT)
        self._invalidate_cache()

    # ------------------------------------------------------------------
    # Composite weight resolution
    # ------------------------------------------------------------------

    def resolve_weights(
        self,
        template: Optional[str] = None,
        stage: Optional[str] = None,
        entity_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Resolve full weight configuration for a query context.

        Returns a dict with:
        - template_weights: core/scene/global weights
        - entity_weight: multiplier for entity type
        - stage: resolved stage
        - template: resolved template
        """
        tpl = template or DEFAULT_TEMPLATE
        stg = stage or "mid"

        if stg in self._dynamic_weights and tpl in self._dynamic_weights[stg]:
            tpl_weights = dict(self._dynamic_weights[stg][tpl])
        else:
            tpl_weights = self.get_template_weight(tpl)

        result: Dict[str, Any] = {
            "template_weights": tpl_weights,
            "stage": stg,
            "template": tpl,
        }

        if entity_type:
            result["entity_weight"] = self.get_entity_weight(entity_type)

        return result

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def to_dict(self) -> Dict[str, Any]:
        """Serialize all weights to a dict."""
        return {
            "entity_weights": dict(self._weights),
            "template_weights": {k: dict(v) for k, v in self._template_weights.items()},
            "dynamic_weights": {
                k: {tk: dict(tv) for tk, tv in v.items()}
                for k, v in self._dynamic_weights.items()
            },
        }

    def from_dict(self, data: Dict[str, Any]) -> None:
        """Load weights from a dict."""
        if "entity_weights" in data:
            self._weights = {
                k: max(0.0, min(2.0, float(v)))
                for k, v in data["entity_weights"].items()
            }
        if "template_weights" in data:
            self._template_weights = {
                k: {sk: float(sv) for sk, sv in v.items()}
                for k, v in data["template_weights"].items()
            }
        if "dynamic_weights" in data:
            self._dynamic_weights = {
                k: {
                    tk: {sk: float(sv) for sk, sv in tv.items()}
                    for tk, tv in v.items()
                }
                for k, v in data["dynamic_weights"].items()
            }
        self._invalidate_cache()

    def to_json(self) -> str:
        """Serialize all weights to JSON."""
        return json.dumps(self.to_dict(), ensure_ascii=False)

    def from_json(self, json_str: str) -> None:
        """Load weights from JSON string."""
        data = json.loads(json_str)
        self.from_dict(data)

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------

    def _invalidate_cache(self) -> None:
        get_cache_service().delete("context_weights", self._CACHE_KEY)

    def save_to_cache(self) -> None:
        """Save current weights to cache."""
        get_cache_service().set(
            "context_weights",
            self._CACHE_KEY,
            self.to_dict(),
            ttl=self._CACHE_TTL,
        )

    def load_from_cache(self) -> bool:
        cached = get_cache_service().get("context_weights", self._CACHE_KEY)
        if cached is not None:
            self.from_dict(cached)
            return True
        return False


# Singleton instance
context_weights = ContextWeights()

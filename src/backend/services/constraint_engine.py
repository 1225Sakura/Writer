"""Backward-compatible re-export. Use backend.services.constraints instead."""

from backend.services.constraints import (
    Severity,
    LawType,
    RuleStatus,
    ConstraintRule,
    ConstraintViolation,
    ConstraintCheckResult,
    InventionRegistry,
    ConflictDetector,
    ConstraintEngine,
)

__all__ = [
    "Severity",
    "LawType",
    "RuleStatus",
    "ConstraintRule",
    "ConstraintViolation",
    "ConstraintCheckResult",
    "InventionRegistry",
    "ConflictDetector",
    "ConstraintEngine",
]

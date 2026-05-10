"""Constraint engine subpackage.

Re-exports all public symbols for backward compatibility.
Import from this package or from individual submodules as needed.
"""

from backend.services.constraints.core import (
    Severity,
    LawType,
    RuleStatus,
    ConstraintRule,
    ConstraintViolation,
    ConstraintCheckResult,
)
from backend.services.constraints.invention_registry import InventionRegistry
from backend.services.constraints.conflict_detector import ConflictDetector
from backend.services.constraints.engine import ConstraintEngine

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

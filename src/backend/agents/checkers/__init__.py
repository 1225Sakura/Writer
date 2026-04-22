"""AI Checkers for novel writing quality assurance.

This package provides quality checkers for various dimensions of
novel writing, plus a pipeline for orchestrating them.
"""

from .base import BaseChecker, CheckerResult
from .pipeline import CheckerPipeline
from .outline_law_enforcer import OutlineLawEnforcer
from .setting_physics_enforcer import SettingPhysicsEnforcer
from .consistency_checker import ConsistencyChecker
from .continuity_checker import ContinuityChecker
from .pacing_checker import PacingChecker
from .ooc_checker import OOCChecker
from .high_point_checker import HighPointChecker
from .reader_pull_checker import ReaderPullChecker

# Checker type constants
CONSISTENCY = "consistency"
CONTINUITY = "continuity"
PACING = "pacing"
OOC = "ooc"
HIGH_POINT = "high_point"
READER_PULL = "reader_pull"
OUTLINE_LAW = "outline_law"
SETTING_PHYSICS = "setting_physics"

__all__ = [
    "BaseChecker",
    "CheckerResult",
    "CheckerPipeline",
    "OutlineLawEnforcer",
    "SettingPhysicsEnforcer",
    "ConsistencyChecker",
    "ContinuityChecker",
    "PacingChecker",
    "OOCChecker",
    "HighPointChecker",
    "ReaderPullChecker",
    "CONSISTENCY",
    "CONTINUITY",
    "PACING",
    "OOC",
    "HIGH_POINT",
    "READER_PULL",
    "OUTLINE_LAW",
    "SETTING_PHYSICS",
]

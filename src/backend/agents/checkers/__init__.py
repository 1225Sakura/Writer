"""AI Checkers for novel writing quality assurance.

This package provides quality checkers for various dimensions of
novel writing, plus a pipeline for orchestrating them.
"""

from .base import BaseChecker, CheckerResult
from .pipeline import CheckerPipeline

# Checker type constants
CONSISTENCY = "consistency"
CONTINUITY = "continuity"
PACING = "pacing"
OOC = "ooc"
HIGH_POINT = "high_point"
READER_PULL = "reader_pull"

__all__ = [
    "BaseChecker",
    "CheckerResult",
    "CheckerPipeline",
    "CONSISTENCY",
    "CONTINUITY",
    "PACING",
    "OOC",
    "HIGH_POINT",
    "READER_PULL",
]

"""Export all models for Alembic and imports.

Phase 1 (US-001): Base / BaseModel / TimestampMixin inlined here from
former app/models/base.py (now deleted). Abstract classes are defined
before concrete model imports to avoid circular import issues.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now()
    )


class BaseModel(Base, TimestampMixin):
    __abstract__ = True
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)


__all__ = ["Base", "BaseModel", "TimestampMixin"]

# Concrete models — their files do `from app.models import BaseModel`,
# which resolves to BaseModel defined above (partial module state).
from app.models.ai_provider import AIProvider, WritingSettings, AIInspectionResult  # noqa: E402
from app.models.character import Character, CharacterRelationship, CharacterStoryline  # noqa: E402
from app.models.item import Item  # noqa: E402
from app.models.location import Location  # noqa: E402
from app.models.outline import Outline, Chapter  # noqa: E402
from app.models.draft import Draft  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.models.if_line import IFLine  # noqa: E402
from app.models.chat import ChatSession, ChatMessage  # noqa: E402
from app.models.faction import Faction  # noqa: E402
from app.models.world_setting import WorldSetting  # noqa: E402
from app.models.rule import Rule  # noqa: E402
from app.models.context import ContextChunk, ContextStats, ContextWeights  # noqa: E402
from app.models.engagement import EngagementScore, CoolPoint, Fulfillment  # noqa: E402
from app.models.pacing import PacingCurve, Recommendation  # noqa: E402
from app.models.observability import MetricEvent, ErrorEvent, AuditEvent, UsageEvent  # noqa: E402

__all__ += [
    "AIProvider", "WritingSettings", "AIInspectionResult",
    "Character", "CharacterRelationship", "CharacterStoryline",
    "Item", "Location", "Outline", "Chapter", "Draft", "Project", "IFLine",
    "ChatSession", "ChatMessage", "Faction", "WorldSetting", "Rule",
    "ContextChunk", "ContextStats", "ContextWeights",
    "EngagementScore", "CoolPoint", "Fulfillment",
    "PacingCurve", "Recommendation",
    "MetricEvent", "ErrorEvent", "AuditEvent", "UsageEvent",
]

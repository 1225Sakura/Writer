"""Application constants."""
from __future__ import annotations

from enum import Enum


class ChapterStatus(str, Enum):
    PLANNING = "planning"
    PENDING = "pending"
    WRITING = "writing"
    REVIEW = "review"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class PlotThreadStatus(str, Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"
    ABANDONED = "abandoned"
    HIDDEN = "hidden"
    OPEN = "open"
    REVEALED = "revealed"


class IFLineSyncMode(str, Enum):
    AUTO = "auto"
    MANUAL = "manual"
    PAUSED = "paused"


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class EntityType(str, Enum):
    CHARACTER = "character"
    ITEM = "item"
    LOCATION = "location"
    FACTION = "faction"
    WORLD = "world"
    RULE = "rule"
    OUTLINE = "outline"
    CHAPTER = "chapter"
    PLOT_THREAD = "plot_thread"
    IFLINE = "ifline"


class AIOperationType(str, Enum):
    CONTINUE = "continue"
    EXPAND = "expand"
    CONDENSE = "condense"
    REWRITE = "rewrite"
    POLISH = "polish"
    OPTIMIZE = "optimize"

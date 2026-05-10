"""Backend services for AI and database operations.

Lazy imports to avoid circular dependencies:
services/__init__ → core/services/chat → agents/base → services/__init__

Import backend-prefixed services directly when needed:
    from backend.infrastructure.cache.cache_service import get_cache_service
    from backend.core.services.ai.ai_service import AIService
"""

from .content_storage import ContentStorage
from .workflow_service import WorkflowExecutionService

__all__ = [
    "CharacterService",
    "ChapterService",
    "ChatSessionService",
    "ChatMessageService",
    "ContentStorage",
    "OutlineService",
    "WorkflowExecutionService",
]


def __getattr__(name: str):
    if name == "CharacterService":
        from backend.core.services.character.character_service import CharacterService
        return CharacterService
    if name == "ChapterService":
        from backend.core.services.chapter.chapter_service import ChapterService
        return ChapterService
    if name in ("ChatSessionService", "ChatMessageService"):
        from backend.core.services.chat.chat_service import ChatSessionService, ChatMessageService
        return ChatSessionService if name == "ChatSessionService" else ChatMessageService
    if name == "OutlineService":
        from backend.core.services.outline.outline_service import OutlineService
        return OutlineService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

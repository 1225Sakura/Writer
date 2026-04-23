"""Backend services for AI and database operations.

Services that use absolute 'backend.*' imports are NOT re-exported here to avoid
import shadowing issues where the same module gets loaded under different names
(e.g. 'models.entities' vs 'backend.models.entities'), causing SQLAlchemy table
redefinition errors.

Import backend-prefixed services directly when needed:
    from backend.services.cache_service import get_cache_service
    from backend.core.services.ai.ai_service import AIService
"""

# Domain services moved to core/services - import from there
from backend.core.services.character.character_service import CharacterService
from backend.core.services.chapter.chapter_service import ChapterService
from backend.core.services.chat.chat_service import ChatSessionService, ChatMessageService
from backend.core.services.outline.outline_service import OutlineService

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

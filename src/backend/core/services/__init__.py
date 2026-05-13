# Lazy imports to avoid circular dependency:
# core/services/__init__ → chat_service → agents/base → services/__init__ → core/services/__init__
# Individual services are imported directly by consumers.

__all__ = [
    "ChatSessionService",
    "ChatMessageService",
    "ChapterService",
    "CharacterService",
    "OutlineService",
    "StyleConstraintEnforcer",
    "StyleConstraint",
    "AIService",
    "RAGAdapter",
]


def __getattr__(name: str):
    if name in ("ChatSessionService", "ChatMessageService"):
        from .chat.chat_service import ChatSessionService, ChatMessageService
        return ChatSessionService if name == "ChatSessionService" else ChatMessageService
    if name == "ChapterService":
        from .chapter.chapter_service import ChapterService
        return ChapterService
    if name == "CharacterService":
        from .character.character_service import CharacterService
        return CharacterService
    if name == "OutlineService":
        from .outline.outline_service import OutlineService
        return OutlineService
    if name in ("StyleConstraintEnforcer", "StyleConstraint"):
        from .style.style_constraint import StyleConstraintEnforcer, StyleConstraint
        return StyleConstraintEnforcer if name == "StyleConstraintEnforcer" else StyleConstraint
    if name == "AIService":
        from .ai.ai_service import AIService
        return AIService
    if name == "RAGAdapter":
        from .ai.rag_adapter import RAGAdapter
        return RAGAdapter
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

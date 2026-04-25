# Auto Novel Writer - Repository Layer
# Exports all repositories and provides a factory for runtime lookup.

from typing import Dict, Type
from sqlalchemy.ext.asyncio import AsyncSession

from repositories.base import BaseRepository
from repositories.character_repository import CharacterRepository
from repositories.chapter_repository import ChapterRepository
from repositories.outline_repository import OutlineRepository
from repositories.workflow_repository import WorkflowExecutionRepository, AgentExecutionLogRepository
from repositories.item_repository import ItemRepository
from repositories.location_repository import LocationRepository
from repositories.faction_repository import FactionRepository
from repositories.world_setting_repository import WorldSettingRepository
from repositories.rule_repository import RuleRepository
from repositories.writing_settings_repository import WritingSettingsRepository

from core.domain.entities import (
    Character,
    Chapter,
    Outline,
    IFLine,
    DraftVersion,
    PlotThread,
    Item,
    Location,
    Faction,
    WorldSetting,
    Rule,
    WritingSettings,
    ChatSession,
    ChatMessage,
    ExtractedEntity,
    AIInspectionResult,
    CharacterRelationship,
    CharacterStoryline,
    WorkflowExecution,
    AgentExecutionLog,
)

__all__ = [
    "BaseRepository",
    "CharacterRepository",
    "ChapterRepository",
    "OutlineRepository",
    "WorkflowExecutionRepository",
    "AgentExecutionLogRepository",
    "ItemRepository",
    "LocationRepository",
    "FactionRepository",
    "WorldSettingRepository",
    "RuleRepository",
    "WritingSettingsRepository",
    "get_repository",
]

# Mapping from a simple model name to its repository class.
# Models without a dedicated repository fall back to BaseRepository.
_REPOSITORY_REGISTRY: Dict[str, Type[BaseRepository]] = {
    "character": CharacterRepository,
    "chapter": ChapterRepository,
    "outline": OutlineRepository,
    "workflow_execution": WorkflowExecutionRepository,
    "agent_execution_log": AgentExecutionLogRepository,
    "item": ItemRepository,
    "location": LocationRepository,
    "faction": FactionRepository,
    "world_setting": WorldSettingRepository,
    "rule": RuleRepository,
    "writing_settings": WritingSettingsRepository,
}

# Mapping from model class to its repository class.
_MODEL_REGISTRY: Dict[Type, Type[BaseRepository]] = {
    Character: CharacterRepository,
    Chapter: ChapterRepository,
    Outline: OutlineRepository,
    WorkflowExecution: WorkflowExecutionRepository,
    AgentExecutionLog: AgentExecutionLogRepository,
    Item: ItemRepository,
    Location: LocationRepository,
    Faction: FactionRepository,
    WorldSetting: WorldSettingRepository,
    Rule: RuleRepository,
    WritingSettings: WritingSettingsRepository,
}


def get_repository(db: AsyncSession, model_name: str) -> BaseRepository:
    """Factory: obtain a repository instance by lowercase model name.

    Supported dedicated names:
        'character' -> CharacterRepository
        'chapter'   -> ChapterRepository
        'outline'   -> OutlineRepository
        'item'      -> ItemRepository
        'location'  -> LocationRepository
        'faction'   -> FactionRepository
        'world_setting' -> WorldSettingRepository
        'rule'      -> RuleRepository
        'writing_settings' -> WritingSettingsRepository

    Any other name falls back to BaseRepository using the matching entity class.
    """
    model_name = model_name.lower()
    if model_name in _REPOSITORY_REGISTRY:
        return _REPOSITORY_REGISTRY[model_name](db)

    # Fallback: map name to model class and return BaseRepository
    model_class = globals().get(model_name.capitalize())
    if model_class is None:
        # Try exact match for multi-word names (e.g., ChatSession)
        for key, val in globals().items():
            if isinstance(val, type) and key.lower() == model_name:
                model_class = val
                break
    if model_class is None:
        raise ValueError(f"No model class found for '{model_name}'")

    return BaseRepository(db, model_class)

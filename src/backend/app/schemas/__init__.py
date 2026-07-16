"""Export all schemas."""
from app.schemas.base import BaseSchema, ApiResponse, PaginatedResponse, ErrorResponse
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut
from app.schemas.character import (
    CharacterCreate, CharacterUpdate, CharacterOut,
    CharacterRelationshipOut, CharacterStorylineOut,
)
from app.schemas.chapter import OutlineCreate, OutlineUpdate, OutlineOut, ChapterCreate, ChapterUpdate, ChapterOut
from app.schemas.chapter_content import ChapterContentOut
from app.schemas.ai import (
    AIProviderCreate, AIProviderUpdate, AIProviderOut,
    AIGenerateRequest, WritingSettingsUpdate, WritingSettingsOut,
)
from app.schemas.ai_provider_test import AIProviderTestRequest, AIProviderTestResponse
from app.schemas.ai_generate_entity import GenerateEntityRequest
from app.schemas.ai_review import (
    ReviewConsistencyRequest,
    ConsistencyIssue,
    ReviewConsistencyResponse,
)
from app.schemas.ai_fill_fields import FillFieldsRequest, FillFieldsResponse
from app.schemas.ai_rewrite_description import (
    RewriteDescriptionRequest,
    RewriteDescriptionResponse,
)
from app.schemas.outline_generator import (
    GenerateOutlineChapter,
    GenerateOutlineRequest,
    GenerateOutlineResponse,
)
from app.schemas.settings_entities import (
    ItemCreate, ItemUpdate, ItemOut,
    LocationCreate, LocationUpdate, LocationOut,
    FactionCreate, FactionUpdate, FactionOut,
    WorldSettingCreate, WorldSettingUpdate, WorldSettingOut,
    RuleCreate, RuleUpdate, RuleOut,
)

__all__ = [
    "BaseSchema", "ApiResponse", "PaginatedResponse", "ErrorResponse",
    "ProjectCreate", "ProjectUpdate", "ProjectOut",
    "CharacterCreate", "CharacterUpdate", "CharacterOut",
    "CharacterRelationshipOut", "CharacterStorylineOut",
    "OutlineCreate", "OutlineUpdate", "OutlineOut",
    "ChapterCreate", "ChapterUpdate", "ChapterOut",
    "ChapterContentOut",
    "AIProviderCreate", "AIProviderUpdate", "AIProviderOut",
    "AIGenerateRequest", "WritingSettingsUpdate", "WritingSettingsOut",
    "AIProviderTestRequest", "AIProviderTestResponse",
    "GenerateEntityRequest",
    "ReviewConsistencyRequest", "ConsistencyIssue", "ReviewConsistencyResponse",
    "FillFieldsRequest", "FillFieldsResponse",
    "RewriteDescriptionRequest", "RewriteDescriptionResponse",
    "GenerateOutlineChapter", "GenerateOutlineRequest", "GenerateOutlineResponse",
    "ItemCreate", "ItemUpdate", "ItemOut",
    "LocationCreate", "LocationUpdate", "LocationOut",
    "FactionCreate", "FactionUpdate", "FactionOut",
    "WorldSettingCreate", "WorldSettingUpdate", "WorldSettingOut",
    "RuleCreate", "RuleUpdate", "RuleOut",
]

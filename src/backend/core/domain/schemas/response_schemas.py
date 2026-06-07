# Auto Novel Writer - Response Schemas
# All response models for consistent API output

from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict


# ============================================
# Character Response Schemas
# ============================================

class CharacterResponse(BaseModel):
    """Character data response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    gender: Optional[str]
    personality: Optional[str]
    desires: Optional[str]
    flaws: Optional[str]
    description: Optional[str]
    tier: Optional[str]
    cultivation_realm: Optional[str]
    created_at: datetime
    updated_at: datetime


class CharacterRelationshipResponse(BaseModel):
    """Character relationship response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    character_id: int
    target_id: int
    type: str
    description: Optional[str]


class CharacterStorylineResponse(BaseModel):
    """Character storyline response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    character_id: int
    title: str
    arc: Optional[str]
    progress: int


# ============================================
# World Entity Response Schemas
# ============================================

class ItemResponse(BaseModel):
    """Item response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    owner: Optional[str]
    location: Optional[str]
    tags: Optional[List[str]] = None


class LocationResponse(BaseModel):
    """Location response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    importance: Optional[str]
    tags: Optional[List[str]] = None


class FactionResponse(BaseModel):
    """Faction response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    type: Optional[str]
    tags: Optional[List[str]] = None


class WorldSettingResponse(BaseModel):
    """World setting response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    details_json: Optional[str]
    tags: Optional[List[str]] = None


class RuleResponse(BaseModel):
    """Rule response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    type: Optional[str]
    tags: Optional[List[str]] = None


# ============================================
# Chapter Response Schemas
# ============================================

class OutlineResponse(BaseModel):
    """Story outline response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str]


class ChapterResponse(BaseModel):
    """Chapter response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    outline_id: Optional[int]
    title: Optional[str]
    summary: Optional[str]
    status: str
    word_count: int
    chapter_order: int
    notes: Optional[str] = None
    note_category: Optional[str] = None
    note_pinned: bool = False
    battle_station_data: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class IFLineResponse(BaseModel):
    """IF line response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    linked_character_id: Optional[int]
    description: Optional[str]
    sync_mode: str
    progress: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class DraftVersionResponse(BaseModel):
    """Draft version response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    chapter_id: int
    content: str
    version_number: int
    created_at: Optional[datetime] = None


class SnapshotResponse(BaseModel):
    """Chapter snapshot response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    chapter_id: int
    content: str
    version_number: int
    is_marked: bool
    created_at: datetime


class SnapshotDiffResponse(BaseModel):
    """Diff result between two snapshots."""
    model_config = ConfigDict(from_attributes=True)

    snapshot_a: SnapshotResponse
    snapshot_b: SnapshotResponse
    diff_lines: List[str]


class PlotThreadResponse(BaseModel):
    """Plot thread response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str]
    status: str
    created_chapter_id: Optional[int]
    reveal_chapter_id: Optional[int]
    created_at: datetime


class AIInspectionResultResponse(BaseModel):
    """AI inspection result response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    chapter_id: int
    inspection_type: str
    issues_json: Optional[str]
    suggestions_json: Optional[str]
    auto_fixed: Optional[bool] = None
    created_at: datetime


# ============================================
# Chat Response Schemas
# ============================================

class ChatMessageResponse(BaseModel):
    """Chat message response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    role: str
    content: str
    rating: Optional[str] = None
    created_at: datetime


class ChatSessionResponse(BaseModel):
    """Chat session response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: Optional[str] = None
    status: Optional[str] = None
    archived: bool = False
    pinned: bool = False
    created_at: datetime
    updated_at: datetime


class ExtractedEntityResponse(BaseModel):
    """Extracted entity response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    type: str
    name: str
    description: Optional[str]
    confirmed: bool
    created_at: datetime


# ============================================
# AI Response Schemas
# ============================================

class ReviewResponse(BaseModel):
    """AI review response."""
    model_config = ConfigDict(populate_by_name=True)

    review_content: str
    raw_response: dict


class AIStreamMeta(BaseModel):
    """Metadata for AI streaming responses (returned in headers)."""
    model_config = ConfigDict(populate_by_name=True)

    operation: str
    human_ai_ratio: int
    style: str


# ============================================
# Agent Response Schemas
# ============================================

class ContextResponse(BaseModel):
    """Writing execution context response."""
    model_config = ConfigDict(populate_by_name=True)

    chapter_id: int
    chapter_title: Optional[str] = None
    core_task: dict
    承接上文: dict
    active_characters: list
    scene_constraints: dict
    time_constraints: str
    style_guidance: str
    continuity: dict
    engagement_strategy: str
    raw_ai_response: Optional[str] = None


class ExtractResponse(BaseModel):
    """Entity extraction response."""
    model_config = ConfigDict(populate_by_name=True)

    chapter_id: Optional[int] = None
    entities: list
    relationships: list
    state_changes: list
    scenes: list
    summary: str


# ============================================
# Settings Response Schemas
# ============================================

class WritingSettingsResponse(BaseModel):
    """Writing settings response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    human_ai_ratio: float
    writing_style: str
    target_word_count: int
    sprint_data_json: Optional[str] = None


class WritingStyleResponse(BaseModel):
    """Writing style response."""
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    description: str


# ============================================
# Import/Export Response Schemas
# ============================================

class ExportDataResponse(BaseModel):
    """Project export data response."""
    model_config = ConfigDict(populate_by_name=True)

    version: str
    exported_at: str
    characters: list
    character_relationships: list
    character_storylines: list
    items: list
    locations: list
    factions: list
    world_settings: list
    rules: list
    writing_settings: Optional[dict] = None


class ImportSummaryResponse(BaseModel):
    """Import result summary response."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool = True
    message: str = "Import successful"
    imported: dict


class HealthCheckResponse(BaseModel):
    """Health check response."""
    model_config = ConfigDict(populate_by_name=True)

    status: str
    app: dict
    dependencies: dict
    database: dict
    system: dict


# ============================================
# AI Provider Config Response Schemas
# ============================================

class AIProviderConfigResponse(BaseModel):
    """AI provider configuration response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: Optional[int]
    name: str
    api_key: str
    base_url: str
    model_name: str
    max_tokens: int
    temperature: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ConnectionTestResponse(BaseModel):
    """Connection test result response."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    latency_ms: float
    message: str
    error_detail: Optional[str] = None


# ============================================
# Entity Relation Response Schema
# ============================================

class EntityRelationResponse(BaseModel):
    """Cross-entity relation response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: Optional[int]
    source_type: str
    source_id: int
    target_type: str
    target_id: int
    relation_type: str
    label: Optional[str]
    description: Optional[str]
    properties_json: Optional[str]
    directed: Optional[int]
    weight: Optional[float]
    created_at: datetime
    updated_at: datetime

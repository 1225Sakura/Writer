# Auto Novel Writer - Request Schemas
# All request models with comprehensive validation

from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict

from .common_schemas import (
    MAX_NAME_LENGTH,
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_TEXT_FIELD_LENGTH,
    MAX_CONTENT_LENGTH,
    MAX_PROMPT_LENGTH,
    MAX_MESSAGE_LENGTH,
    MAX_JSON_LENGTH,
    sanitize_text,
    validate_chinese_name,
    validate_no_special_chars,
    validate_positive_id,
    validate_non_empty,
    validate_chinese_text_length,
)


# ============================================
# Character Request Schemas
# ============================================

class CharacterCreateRequest(BaseModel):
    """Request to create a new character."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=MAX_NAME_LENGTH)
    gender: Optional[str] = Field(default=None, max_length=50)
    personality: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    desires: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    flaws: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    tier: Optional[str] = Field(default=None, max_length=100)
    cultivation_realm: Optional[str] = Field(default=None, max_length=100)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_chinese_name(v)

    @field_validator('gender')
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = sanitize_text(v, max_length=50)
        return v

    @field_validator('personality', 'desires', 'flaws', 'description')
    @classmethod
    def validate_text_fields(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_chinese_text_length(v, min_chars=0, max_chars=MAX_TEXT_FIELD_LENGTH)
        return v

    @field_validator('tier', 'cultivation_realm')
    @classmethod
    def validate_tier_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=100)


class CharacterUpdateRequest(BaseModel):
    """Request to update an existing character."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=MAX_NAME_LENGTH)
    gender: Optional[str] = Field(default=None, max_length=50)
    personality: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    desires: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    flaws: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    tier: Optional[str] = Field(default=None, max_length=100)
    cultivation_realm: Optional[str] = Field(default=None, max_length=100)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_chinese_name(v)
        return v

    @field_validator('personality', 'desires', 'flaws', 'description')
    @classmethod
    def validate_text_fields(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_chinese_text_length(v, min_chars=0, max_chars=MAX_TEXT_FIELD_LENGTH)
        return v

    @field_validator('tier', 'cultivation_realm', 'gender')
    @classmethod
    def sanitize_optional_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=100) if v is not None else None


class CharacterRelationshipCreateRequest(BaseModel):
    """Request to create a character relationship."""
    model_config = ConfigDict(str_strip_whitespace=True)

    character_id: int = Field(..., gt=0)
    target_id: int = Field(..., gt=0)
    type: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=MAX_DESCRIPTION_LENGTH)

    @field_validator('character_id', 'target_id')
    @classmethod
    def validate_ids(cls, v: int) -> int:
        return validate_positive_id(v)

    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Relationship type', max_length=100)

    @field_validator('description')
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_chinese_text_length(v, min_chars=0, max_chars=MAX_DESCRIPTION_LENGTH)
        return v

    @field_validator('target_id')
    @classmethod
    def validate_not_self_relation(cls, v: int, info) -> int:
        # Access character_id from validated data
        data = info.data
        if 'character_id' in data and data['character_id'] == v:
            raise ValueError('A character cannot have a relationship with itself')
        return v


class CharacterStorylineCreateRequest(BaseModel):
    """Request to create a character storyline."""
    model_config = ConfigDict(str_strip_whitespace=True)

    character_id: int = Field(..., gt=0)
    title: str = Field(..., min_length=1, max_length=MAX_TITLE_LENGTH)
    arc: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    progress: int = Field(default=0, ge=0, le=100)


class CharacterStorylineUpdateRequest(BaseModel):
    """Request to update a character storyline (all fields optional)."""
    model_config = ConfigDict(str_strip_whitespace=True)

    title: Optional[str] = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    arc: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    progress: Optional[int] = Field(default=None, ge=0, le=100)

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Title', max_length=MAX_TITLE_LENGTH)

    @field_validator('arc')
    @classmethod
    def validate_arc(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_chinese_text_length(v, min_chars=0, max_chars=MAX_TEXT_FIELD_LENGTH)
        return v


# ============================================
# World Entity Request Schemas
# ============================================

class ItemCreateRequest(BaseModel):
    """Request to create an item."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=MAX_NAME_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    owner: Optional[str] = Field(default=None, max_length=MAX_NAME_LENGTH)
    location: Optional[str] = Field(default=None, max_length=MAX_NAME_LENGTH)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_chinese_name(v)

    @field_validator('description', 'owner', 'location')
    @classmethod
    def validate_optional_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)


class ItemUpdateRequest(BaseModel):
    """Request to update an item."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=MAX_NAME_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    owner: Optional[str] = Field(default=None, max_length=MAX_NAME_LENGTH)
    location: Optional[str] = Field(default=None, max_length=MAX_NAME_LENGTH)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_chinese_name(v)
        return v

    @field_validator('description', 'owner', 'location')
    @classmethod
    def validate_optional_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)


class LocationCreateRequest(BaseModel):
    """Request to create a location."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=MAX_NAME_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    importance: Optional[str] = Field(default=None, max_length=100)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_chinese_name(v)

    @field_validator('description', 'importance')
    @classmethod
    def validate_optional_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)


class LocationUpdateRequest(BaseModel):
    """Request to update a location."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=MAX_NAME_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    importance: Optional[str] = Field(default=None, max_length=100)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_chinese_name(v)
        return v

    @field_validator('description', 'importance')
    @classmethod
    def validate_optional_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)


class FactionCreateRequest(BaseModel):
    """Request to create a faction."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=MAX_NAME_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    type: Optional[str] = Field(default=None, max_length=100)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_chinese_name(v)

    @field_validator('description', 'type')
    @classmethod
    def validate_optional_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)


class FactionUpdateRequest(BaseModel):
    """Request to update a faction."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=MAX_NAME_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    type: Optional[str] = Field(default=None, max_length=100)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_chinese_name(v)
        return v

    @field_validator('description', 'type')
    @classmethod
    def validate_optional_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)


class WorldSettingCreateRequest(BaseModel):
    """Request to create a world setting."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=MAX_NAME_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    details_json: Optional[str] = Field(default=None, max_length=MAX_JSON_LENGTH)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_chinese_name(v)

    @field_validator('description')
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)

    @field_validator('details_json')
    @classmethod
    def validate_details_json(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = sanitize_text(v, max_length=MAX_JSON_LENGTH)
            if v:
                import json
                try:
                    json.loads(v)
                except json.JSONDecodeError:
                    raise ValueError('details_json must be valid JSON')
        return v


class WorldSettingUpdateRequest(BaseModel):
    """Request to update a world setting."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=MAX_NAME_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    details_json: Optional[str] = Field(default=None, max_length=MAX_JSON_LENGTH)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_chinese_name(v)
        return v

    @field_validator('details_json')
    @classmethod
    def validate_details_json(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = sanitize_text(v, max_length=MAX_JSON_LENGTH)
            if v:
                import json
                try:
                    json.loads(v)
                except json.JSONDecodeError:
                    raise ValueError('details_json must be valid JSON')
        return v


class RuleCreateRequest(BaseModel):
    """Request to create a rule."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=MAX_NAME_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    type: Optional[str] = Field(default=None, max_length=100)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_chinese_name(v)

    @field_validator('description', 'type')
    @classmethod
    def validate_optional_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)


class RuleUpdateRequest(BaseModel):
    """Request to update a rule."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=MAX_NAME_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    type: Optional[str] = Field(default=None, max_length=100)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_chinese_name(v)
        return v

    @field_validator('description', 'type')
    @classmethod
    def validate_optional_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)


# ============================================
# Chapter Request Schemas
# ============================================

class OutlineCreateRequest(BaseModel):
    """Request to create a story outline."""
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=1, max_length=MAX_TITLE_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Title', max_length=MAX_TITLE_LENGTH)

    @field_validator('description')
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)


class OutlineUpdateRequest(BaseModel):
    """Request to update a story outline."""
    model_config = ConfigDict(str_strip_whitespace=True)

    title: Optional[str] = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_non_empty(v, field_name='Title', max_length=MAX_TITLE_LENGTH)
        return v

    @field_validator('description')
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)


class ChapterCreateRequest(BaseModel):
    """Request to create a chapter."""
    model_config = ConfigDict(str_strip_whitespace=True)

    outline_id: Optional[int] = Field(default=None, gt=0)
    title: Optional[str] = Field(default=None, max_length=MAX_TITLE_LENGTH)
    summary: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    status: str = Field(default="pending", max_length=50)
    word_count: int = Field(default=0, ge=0)
    chapter_order: int = Field(default=0, ge=0)

    @field_validator('outline_id')
    @classmethod
    def validate_outline_id(cls, v: Optional[int]) -> Optional[int]:
        return validate_positive_id(v) if v is not None else None

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TITLE_LENGTH)

    @field_validator('summary')
    @classmethod
    def validate_summary(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = {'pending', 'writing', 'review', 'completed', 'archived'}
        v = sanitize_text(v, max_length=50) or 'pending'
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(sorted(valid_statuses))}')
        return v


class ChapterUpdateRequest(BaseModel):
    """Request to update a chapter."""
    model_config = ConfigDict(str_strip_whitespace=True)

    outline_id: Optional[int] = Field(default=None, gt=0)
    title: Optional[str] = Field(default=None, max_length=MAX_TITLE_LENGTH)
    summary: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    status: Optional[str] = Field(default=None, max_length=50)
    word_count: Optional[int] = Field(default=None, ge=0)
    chapter_order: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    note_category: Optional[str] = Field(default=None, max_length=50)
    note_pinned: Optional[bool] = Field(default=None)
    battle_station_data: Optional[str] = Field(default=None, max_length=MAX_JSON_LENGTH)

    @field_validator('outline_id')
    @classmethod
    def validate_outline_id(cls, v: Optional[int]) -> Optional[int]:
        return validate_positive_id(v) if v is not None else None

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TITLE_LENGTH)

    @field_validator('summary')
    @classmethod
    def validate_summary(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_statuses = {'pending', 'writing', 'review', 'completed', 'archived'}
            v = sanitize_text(v, max_length=50) or 'pending'
            if v not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(sorted(valid_statuses))}')
            return v
        return v


class ChapterOrderEntry(BaseModel):
    """A single chapter order entry for reordering."""
    id: int = Field(gt=0)
    chapter_order: int = Field(ge=0)


class ChapterReorderRequest(BaseModel):
    """Request to reorder chapters within an outline."""
    model_config = ConfigDict(str_strip_whitespace=True)

    outline_id: int = Field(gt=0)
    chapter_orders: List[ChapterOrderEntry] = Field(min_length=1)


class IFLineCreateRequest(BaseModel):
    """Request to create an IF line."""
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=1, max_length=MAX_TITLE_LENGTH)
    linked_character_id: Optional[int] = Field(default=None, gt=0)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    sync_mode: str = Field(default="auto", max_length=50)

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Title', max_length=MAX_TITLE_LENGTH)

    @field_validator('linked_character_id')
    @classmethod
    def validate_character_id(cls, v: Optional[int]) -> Optional[int]:
        return validate_positive_id(v) if v is not None else None

    @field_validator('description')
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH)

    @field_validator('sync_mode')
    @classmethod
    def validate_sync_mode(cls, v: str) -> str:
        valid_modes = {'auto', 'manual', 'disabled'}
        v = sanitize_text(v, max_length=50) or 'auto'
        if v not in valid_modes:
            raise ValueError(f'Sync mode must be one of: {", ".join(sorted(valid_modes))}')
        return v


class IFLineUpdateRequest(BaseModel):
    """Request to update an IF line."""
    model_config = ConfigDict(str_strip_whitespace=True)

    title: Optional[str] = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    linked_character_id: Optional[int] = Field(default=None, gt=0)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    sync_mode: Optional[str] = Field(default=None, max_length=50)

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_non_empty(v, field_name='Title', max_length=MAX_TITLE_LENGTH)
        return v

    @field_validator('linked_character_id')
    @classmethod
    def validate_character_id(cls, v: Optional[int]) -> Optional[int]:
        return validate_positive_id(v) if v is not None else None

    @field_validator('sync_mode')
    @classmethod
    def validate_sync_mode(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_modes = {'auto', 'manual', 'disabled'}
            v = sanitize_text(v, max_length=50) or 'auto'
            if v not in valid_modes:
                raise ValueError(f'Sync mode must be one of: {", ".join(sorted(valid_modes))}')
            return v
        return v


class DraftVersionCreateRequest(BaseModel):
    """Request to create a draft version."""
    model_config = ConfigDict(str_strip_whitespace=True)

    chapter_id: int = Field(..., gt=0)
    content: str = Field(..., min_length=1, max_length=MAX_CONTENT_LENGTH)
    version_number: int = Field(..., gt=0)

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Content', max_length=MAX_CONTENT_LENGTH)


# ============================================
# Snapshot Request Schemas
# ============================================

class SnapshotCreateRequest(BaseModel):
    """Request to create a chapter snapshot."""
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(..., min_length=1, max_length=MAX_CONTENT_LENGTH)
    is_marked: bool = Field(default=False)

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Content', max_length=MAX_CONTENT_LENGTH)


class SnapshotMarkRequest(BaseModel):
    """Request to mark/unmark a snapshot."""
    model_config = ConfigDict(str_strip_whitespace=True)

    is_marked: bool


class SnapshotDiffRequest(BaseModel):
    """Request to diff two snapshots."""
    model_config = ConfigDict(str_strip_whitespace=True)

    snapshot_id_a: int = Field(..., gt=0, description="Base snapshot ID")
    snapshot_id_b: int = Field(..., gt=0, description="Comparison snapshot ID")


class PlotThreadCreateRequest(BaseModel):
    """Request to create a plot thread."""
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=1, max_length=MAX_TITLE_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    status: str = Field(default="active", max_length=50)
    created_chapter_id: Optional[int] = Field(default=None, gt=0)
    reveal_chapter_id: Optional[int] = Field(default=None, gt=0)

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Title', max_length=MAX_TITLE_LENGTH)

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = {'active', 'resolved', 'abandoned', 'hidden'}
        v = sanitize_text(v, max_length=50) or 'active'
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(sorted(valid_statuses))}')
        return v

    @field_validator('created_chapter_id', 'reveal_chapter_id')
    @classmethod
    def validate_chapter_ids(cls, v: Optional[int]) -> Optional[int]:
        return validate_positive_id(v) if v is not None else None


class PlotThreadUpdateRequest(BaseModel):
    """Request to update a plot thread."""
    model_config = ConfigDict(str_strip_whitespace=True)

    title: Optional[str] = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT_FIELD_LENGTH)
    status: Optional[str] = Field(default=None, max_length=50)
    created_chapter_id: Optional[int] = Field(default=None, gt=0)
    reveal_chapter_id: Optional[int] = Field(default=None, gt=0)

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_non_empty(v, field_name='Title', max_length=MAX_TITLE_LENGTH)
        return v

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_statuses = {'active', 'resolved', 'abandoned', 'hidden'}
            v = sanitize_text(v, max_length=50) or 'active'
            if v not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(sorted(valid_statuses))}')
            return v
        return v

    @field_validator('created_chapter_id', 'reveal_chapter_id')
    @classmethod
    def validate_chapter_ids(cls, v: Optional[int]) -> Optional[int]:
        return validate_positive_id(v) if v is not None else None


# ============================================
# Chat Request Schemas
# ============================================

class ChatMessageCreateRequest(BaseModel):
    """Request to create a chat message."""
    model_config = ConfigDict(str_strip_whitespace=True)

    role: str = Field(..., max_length=20)
    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LENGTH)

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        valid_roles = {'user', 'assistant', 'system'}
        v = sanitize_text(v, max_length=20)
        if v not in valid_roles:
            raise ValueError(f'Role must be one of: {", ".join(sorted(valid_roles))}')
        return v

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Content', max_length=MAX_MESSAGE_LENGTH)


class ChatMessageUpdateRequest(BaseModel):
    """Request to update a chat message's content."""
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LENGTH)

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Content', max_length=MAX_MESSAGE_LENGTH)


class ChatSessionCreateRequest(BaseModel):
    """Request to create a chat session (no fields required)."""
    model_config = ConfigDict(str_strip_whitespace=True)

    pass


class ChatSessionUpdateRequest(BaseModel):
    """Request to update a chat session."""
    model_config = ConfigDict(str_strip_whitespace=True)

    title: Optional[str] = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    status: Optional[str] = Field(default=None, max_length=50)
    archived: Optional[bool] = Field(default=None)
    pinned: Optional[bool] = Field(default=None)

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_non_empty(v, field_name='Title', max_length=MAX_TITLE_LENGTH)
        return v

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_statuses = {'active', 'archived', 'closed'}
            v = sanitize_text(v, max_length=50)
            if v not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(sorted(valid_statuses))}')
            return v
        return v


class ChatMessageRatingRequest(BaseModel):
    """Request to update a chat message's rating."""
    model_config = ConfigDict(str_strip_whitespace=True)

    rating: Optional[str] = Field(default=None, max_length=10)

    @field_validator('rating')
    @classmethod
    def validate_rating(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ('up', 'down'):
            raise ValueError('Rating must be "up" or "down"')
        return v


# ============================================
# AI Request Schemas
# ============================================

VALID_OPERATIONS = {"continue", "expand", "condense", "rewrite", "polish", "optimize"}


class GenerateRequest(BaseModel):
    """Request for AI content generation."""
    model_config = ConfigDict(str_strip_whitespace=True)

    prompt: str = Field(..., min_length=1, max_length=MAX_PROMPT_LENGTH)
    operation: str = Field(..., max_length=50)
    chapter_id: Optional[int] = Field(default=None, gt=0)
    human_ai_ratio: Optional[int] = Field(default=None, ge=0, le=100)
    style: Optional[str] = Field(default=None, max_length=50)

    @field_validator('prompt')
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Prompt', max_length=MAX_PROMPT_LENGTH)

    @field_validator('operation')
    @classmethod
    def validate_operation(cls, v: str) -> str:
        v = sanitize_text(v, max_length=50)
        if v is None or v not in VALID_OPERATIONS:
            raise ValueError(f'Operation must be one of: {", ".join(sorted(VALID_OPERATIONS))}')
        return v

    @field_validator('style')
    @classmethod
    def validate_style(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return sanitize_text(v, max_length=50)
        return v


class ReviewRequest(BaseModel):
    """Request for AI review of settings."""
    model_config = ConfigDict(str_strip_whitespace=True)

    settings_data: dict

    @field_validator('settings_data')
    @classmethod
    def validate_settings_data(cls, v: dict) -> dict:
        if not v:
            raise ValueError('settings_data cannot be empty')
        return v


class ExtractEntitiesRequest(BaseModel):
    """Request to extract entities from chat messages."""
    model_config = ConfigDict(str_strip_whitespace=True)

    chat_messages: list

    @field_validator('chat_messages')
    @classmethod
    def validate_chat_messages(cls, v: list) -> list:
        if not v:
            raise ValueError('chat_messages cannot be empty')
        return v


# ============================================
# Agent Request Schemas
# ============================================

class ContextRequest(BaseModel):
    """Request to build execution context for a chapter."""
    model_config = ConfigDict(str_strip_whitespace=True)

    chapter_id: int = Field(..., gt=0)


class ExtractRequest(BaseModel):
    """Request to extract entities from chapter content."""
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(..., min_length=1, max_length=MAX_CONTENT_LENGTH)
    chapter_id: Optional[int] = Field(default=None, gt=0)

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        return validate_non_empty(v, field_name='Content', max_length=MAX_CONTENT_LENGTH)

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: Optional[int]) -> Optional[int]:
        return validate_positive_id(v) if v is not None else None


# ============================================
# Settings Request Schemas
# ============================================

class WritingSettingsUpdateRequest(BaseModel):
    """Request to update writing settings."""
    model_config = ConfigDict(str_strip_whitespace=True)

    human_ai_ratio: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    writing_style: Optional[str] = Field(default=None, max_length=50)
    target_word_count: Optional[int] = Field(default=None, gt=0)
    sprint_data_json: Optional[str] = Field(default=None, max_length=MAX_JSON_LENGTH)

    @field_validator('writing_style')
    @classmethod
    def validate_writing_style(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=50)


# ============================================
# Import/Export Request Schemas
# ============================================

class ImportRequest(BaseModel):
    """Validated import request."""
    model_config = ConfigDict(str_strip_whitespace=True)

    data: dict
    mode: str = Field(default="merge", max_length=20)

    @field_validator('mode')
    @classmethod
    def validate_mode(cls, v: str) -> str:
        valid_modes = {"merge", "replace"}
        v = sanitize_text(v, max_length=20) or 'merge'
        if v not in valid_modes:
            raise ValueError(f"Mode must be one of: {', '.join(sorted(valid_modes))}")
        return v


class ImportZipRequest(BaseModel):
    """Validated ZIP import request."""
    model_config = ConfigDict(str_strip_whitespace=True)

    mode: str = Field(default="merge", max_length=20)

    @field_validator('mode')
    @classmethod
    def validate_mode(cls, v: str) -> str:
        valid_modes = {"merge", "replace"}
        v = sanitize_text(v, max_length=20) or 'merge'
        if v not in valid_modes:
            raise ValueError(f"Mode must be one of: {', '.join(sorted(valid_modes))}")
        return v


class ExportDataRequest(BaseModel):
    """Complete project data for export."""
    model_config = ConfigDict(str_strip_whitespace=True)

    version: str = Field(default="1.0", max_length=10)
    exported_at: str = Field(..., max_length=50)
    characters: list
    character_relationships: list
    character_storylines: list
    items: list
    locations: list
    factions: list
    world_settings: list
    rules: list
    writing_settings: Optional[dict] = None

    @field_validator('version')
    @classmethod
    def validate_version(cls, v: str) -> str:
        v = sanitize_text(v, max_length=10) or '1.0'
        if v != "1.0":
            raise ValueError("Unsupported export version. Only '1.0' is supported")
        return v


# ============================================
# AI Provider Config Request Schemas
# ============================================

class AIProviderConfigCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=100)
    api_key: str = Field(..., min_length=1, max_length=500)
    base_url: str = Field(..., min_length=1, max_length=500)
    model_name: str = Field(..., min_length=1, max_length=100)
    max_tokens: int = Field(default=4096, ge=1, le=1000000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    project_id: Optional[int] = None

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("Base URL must start with http:// or https://")
        return v.rstrip("/")


class AIProviderConfigUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    api_key: Optional[str] = Field(None, min_length=1, max_length=500)
    base_url: Optional[str] = Field(None, min_length=1, max_length=500)
    model_name: Optional[str] = Field(None, min_length=1, max_length=100)
    max_tokens: Optional[int] = Field(None, ge=1, le=1000000)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith(("http://", "https://")):
            raise ValueError("Base URL must start with http:// or https://")
        return v.rstrip("/") if v else v


class AIProviderConfigTestRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    api_key: str = Field(..., min_length=1)
    base_url: str = Field(..., min_length=1)
    model_name: str = Field(..., min_length=1)
    max_tokens: int = Field(default=4096, ge=1, le=1000000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


# ============================================
# Entity Relation Request Schemas
# ============================================

class EntityRelationCreateRequest(BaseModel):
    """Request to create a cross-entity relation."""
    model_config = ConfigDict(str_strip_whitespace=True)

    source_type: str = Field(..., min_length=1, max_length=32)
    source_id: int = Field(..., gt=0)
    target_type: str = Field(..., min_length=1, max_length=32)
    target_id: int = Field(..., gt=0)
    relation_type: str = Field(..., min_length=1, max_length=64)
    label: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = Field(default=None, max_length=MAX_DESCRIPTION_LENGTH)
    properties_json: Optional[str] = Field(default=None, max_length=MAX_JSON_LENGTH)
    directed: Optional[int] = Field(default=1)
    weight: Optional[float] = Field(default=1.0)

    @field_validator('source_type', 'target_type', 'relation_type')
    @classmethod
    def sanitize_relation_fields(cls, v: str) -> str:
        return sanitize_text(v, max_length=100) if v else v

    @field_validator('label', 'description')
    @classmethod
    def sanitize_optional_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH) if v else v


class EntityRelationUpdateRequest(BaseModel):
    """Request to update a cross-entity relation."""
    model_config = ConfigDict(str_strip_whitespace=True)

    source_type: Optional[str] = Field(default=None, min_length=1, max_length=32)
    source_id: Optional[int] = Field(default=None, gt=0)
    target_type: Optional[str] = Field(default=None, min_length=1, max_length=32)
    target_id: Optional[int] = Field(default=None, gt=0)
    relation_type: Optional[str] = Field(default=None, min_length=1, max_length=64)
    label: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = Field(default=None, max_length=MAX_DESCRIPTION_LENGTH)
    properties_json: Optional[str] = Field(default=None, max_length=MAX_JSON_LENGTH)
    directed: Optional[int] = None
    weight: Optional[float] = None

    @field_validator('source_type', 'target_type', 'relation_type')
    @classmethod
    def sanitize_relation_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=100) if v else v

    @field_validator('label', 'description')
    @classmethod
    def sanitize_optional_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v, max_length=MAX_TEXT_FIELD_LENGTH) if v else v

"""AI-related schemas."""
from __future__ import annotations

from datetime import datetime

from app.schemas.base import BaseSchema, TimestampSchema


class AIProviderBase(BaseSchema):
    name: str
    api_key: str | None = None  # plaintext for create/update
    base_url: str | None = None
    model_name: str
    max_tokens: int = 4096
    temperature: float = 0.7
    is_active: bool = True


class AIProviderCreate(AIProviderBase):
    pass


class AIProviderUpdate(BaseSchema):
    name: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    model_name: str | None = None
    max_tokens: int | None = None
    temperature: float | None = None
    is_active: bool | None = None


class AIProviderOut(BaseSchema):
    id: int
    name: str
    base_url: str | None = None
    model_name: str
    max_tokens: int
    temperature: float
    is_active: bool
    created_at: str
    updated_at: str
    # api_key never returned

    @classmethod
    def model_validate(cls, obj, **kwargs):
        # Auto-convert datetime fields from ORM
        data = {}
        for key in ["id", "name", "base_url", "model_name", "max_tokens", "temperature", "is_active", "created_at", "updated_at"]:
            val = getattr(obj, key, None)
            if isinstance(val, datetime):
                val = val.isoformat()
            data[key] = val
        return cls(**data)


class AIGenerateRequest(BaseSchema):
    prompt: str
    operation: str = "continue"
    chapter_id: int | None = None
    human_ai_ratio: float | None = None
    style: str | None = None


class WritingSettingsBase(BaseSchema):
    human_ai_ratio: float = 0.5
    writing_style: str = "default"
    target_word_count: int | None = None
    sprint_data_json: str | None = None


class WritingSettingsUpdate(BaseSchema):
    human_ai_ratio: float | None = None
    writing_style: str | None = None
    target_word_count: int | None = None
    sprint_data_json: str | None = None


class WritingSettingsOut(WritingSettingsBase, TimestampSchema):
    id: int
    project_id: int

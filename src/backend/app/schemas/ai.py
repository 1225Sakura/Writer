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
    use_env: bool = False  # v0.4 P0-Sec5 D.2.2: explicit env fallback flag


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
    # api_key never returned (v0.4 P0-Sec5 D.2.1: list never returns full key)
    masked_key: str | None = None  # last 4 chars + "sk-***" prefix

    @classmethod
    def model_validate(cls, obj, **kwargs):
        # Auto-convert datetime fields from ORM
        data = {}
        for key in ["id", "name", "base_url", "model_name", "max_tokens", "temperature", "is_active", "created_at", "updated_at"]:
            val = getattr(obj, key, None)
            if isinstance(val, datetime):
                val = val.isoformat()
            data[key] = val
        # Compute masked_key from raw api_key (last 4 chars only)
        raw_key = getattr(obj, "api_key_encrypted", None) or ""
        if raw_key and len(raw_key) > 4:
            data["masked_key"] = f"sk-***{raw_key[-4:]}"
        else:
            data["masked_key"] = None
        return cls(**data)


# v0.4 P0-Sec5 D.2.1: separate schema for full key retrieval
class AIProviderKeyOut(BaseSchema):
    api_key: str | None = None  # decrypted; None if use_env=True


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

# Input Validation Utilities
# Pydantic validators and sanitization functions

import re
from typing import Any, Optional
from pydantic import BaseModel, field_validator, Field, ConfigDict
from datetime import datetime


# String length limits
MAX_TITLE_LENGTH = 200
MAX_CONTENT_LENGTH = 500000
MAX_NAME_LENGTH = 100
MAX_SLUG_LENGTH = 100


def sanitize_string(value: str) -> str:
    """Remove potentially dangerous characters from user input."""
    if not isinstance(value, str):
        return value
    # Remove null bytes
    value = value.replace('\x00', '')
    # Strip leading/trailing whitespace
    value = value.strip()
    return value


def sanitize_html(value: str) -> str:
    """Remove HTML tags from input."""
    if not isinstance(value, str):
        return value
    # Remove HTML tags
    value = re.sub(r'<[^>]+>', '', value)
    return sanitize_string(value)


def validate_slug(value: str) -> str:
    """Validate and normalize a slug."""
    value = sanitize_string(value.lower())
    # Only allow alphanumeric, underscore, hyphen
    value = re.sub(r'[^a-z0-9_-]', '', value)
    if not value:
        raise ValueError("Slug cannot be empty")
    if len(value) > MAX_SLUG_LENGTH:
        raise ValueError(f"Slug exceeds maximum length of {MAX_SLUG_LENGTH}")
    return value


def validate_email(value: str) -> str:
    """Validate email format."""
    value = sanitize_string(value)
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, value):
        raise ValueError("Invalid email format")
    return value.lower()


def validate_chinese_text(value: str) -> str:
    """Validate text that may contain Chinese characters."""
    value = sanitize_string(value)
    if not value or len(value.strip()) == 0:
        raise ValueError("Text cannot be empty")
    return value


class TitleValidator(BaseModel):
    """Validator for title fields."""
    value: str = Field(..., min_length=1, max_length=MAX_TITLE_LENGTH)

    @field_validator('value')
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = sanitize_string(v)
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > MAX_TITLE_LENGTH:
            raise ValueError(f"Title exceeds maximum length of {MAX_TITLE_LENGTH}")
        return v


class ContentValidator(BaseModel):
    """Validator for content/text fields."""
    value: str = Field(..., min_length=1, max_length=MAX_CONTENT_LENGTH)

    @field_validator('value')
    @classmethod
    def validate_content(cls, v: str) -> str:
        v = sanitize_string(v)
        if not v:
            raise ValueError("Content cannot be empty")
        if len(v) > MAX_CONTENT_LENGTH:
            raise ValueError(f"Content exceeds maximum length of {MAX_CONTENT_LENGTH}")
        return v


class NameValidator(BaseModel):
    """Validator for name fields (characters, items, etc.)."""
    value: str = Field(..., min_length=1, max_length=MAX_NAME_LENGTH)

    @field_validator('value')
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = sanitize_string(v)
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > MAX_NAME_LENGTH:
            raise ValueError(f"Name exceeds maximum length of {MAX_NAME_LENGTH}")
        return v


class SlugValidator(BaseModel):
    """Validator for slug fields."""
    value: str = Field(..., min_length=1, max_length=MAX_SLUG_LENGTH)

    @field_validator('value')
    @classmethod
    def validate_slug(cls, v: str) -> str:
        return validate_slug(v)


class PaginationValidator(BaseModel):
    """Validator for pagination parameters."""
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @field_validator('page')
    @classmethod
    def validate_page(cls, v: int) -> int:
        if v < 1:
            return 1
        return v

    @field_validator('page_size')
    @classmethod
    def validate_page_size(cls, v: int) -> int:
        if v < 1:
            return 20
        if v > 100:
            return 100
        return v


class UUIDValidator(BaseModel):
    """Validator for UUID fields."""
    value: str

    @field_validator('value')
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        v = sanitize_string(v)
        # Basic UUID format check (8-4-4-4-12 hex characters)
        pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        if not re.match(pattern, v.lower()):
            raise ValueError("Invalid UUID format")
        return v.lower()


class WritingStyleValidator(BaseModel):
    """Validator for writing style selection."""
    style: str

    @field_validator('style')
    @classmethod
    def validate_style(cls, v: str) -> str:
        valid_styles = {'jiangnan', 'kafka', 'camus', 'default', 'custom'}
        v = sanitize_string(v).lower()
        if v not in valid_styles:
            raise ValueError(f"Invalid style. Must be one of: {', '.join(valid_styles)}")
        return v


class AICommandValidator(BaseModel):
    """Validator for AI writing commands."""
    command: str
    content: Optional[str] = None

    @field_validator('command')
    @classmethod
    def validate_command(cls, v: str) -> str:
        valid_commands = {'optimize', 'expand', 'summarize', 'rewrite', 'continue', 'polish'}
        v = sanitize_string(v).lower()
        if v not in valid_commands:
            raise ValueError(f"Invalid command. Must be one of: {', '.join(valid_commands)}")
        return v


class ChatMessageValidator(BaseModel):
    """Validator for chat messages."""
    role: str
    content: str = Field(..., min_length=1, max_length=10000)

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        valid_roles = {'user', 'assistant', 'system'}
        v = sanitize_string(v).lower()
        if v not in valid_roles:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(valid_roles)}")
        return v

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        v = sanitize_string(v)
        if not v:
            raise ValueError("Content cannot be empty")
        if len(v) > 10000:
            raise ValueError("Content exceeds maximum length of 10000")
        return v


def validate_entity_type(entity_type: str) -> str:
    """Validate entity type for the ontology."""
    valid_types = {
        'character', 'item', 'location', 'faction',
        'rule', 'outline', 'ifline', 'chapter'
    }
    entity_type = sanitize_string(entity_type).lower()
    if entity_type not in valid_types:
        raise ValueError(f"Invalid entity type. Must be one of: {', '.join(valid_types)}")
    return entity_type


def validate_writing_ratio(ratio: float) -> float:
    """Validate human-AI writing ratio (0.0 to 1.0)."""
    if not isinstance(ratio, (int, float)):
        raise ValueError("Ratio must be a number")
    if ratio < 0.0 or ratio > 1.0:
        raise ValueError("Ratio must be between 0.0 and 1.0")
    return float(ratio)

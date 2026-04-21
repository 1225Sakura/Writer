# Auto Novel Writer - Common Schemas
# Shared types, pagination, error responses, and validation utilities

import re
import html
from datetime import datetime, date
from typing import Any, Optional, TypeVar, Generic, List
from pydantic import BaseModel, Field, field_validator, ConfigDict


# ============================================
# Length Limits
# ============================================

MAX_NAME_LENGTH = 200
MAX_TITLE_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 5000
MAX_TEXT_FIELD_LENGTH = 10000
MAX_CONTENT_LENGTH = 500000
MAX_SLUG_LENGTH = 100
MAX_JSON_LENGTH = 100000
MAX_PROMPT_LENGTH = 10000
MAX_MESSAGE_LENGTH = 50000
MIN_CHINESE_CHARS = 1

# ============================================
# Sanitization Utilities
# ============================================

def sanitize_text(value: Optional[str], max_length: Optional[int] = None) -> Optional[str]:
    """Sanitize text input: strip whitespace, remove null bytes, escape HTML.

    Args:
        value: Input string to sanitize
        max_length: Optional maximum length to truncate to

    Returns:
        Sanitized string or None if input was None/empty after stripping
    """
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    # Remove null bytes
    value = value.replace('\x00', '')
    # Strip leading/trailing whitespace
    value = value.strip()
    # Escape HTML to prevent injection
    value = html.escape(value, quote=False)
    # Truncate if needed
    if max_length is not None and len(value) > max_length:
        value = value[:max_length]
    return value if value else None


def sanitize_html_content(value: Optional[str]) -> Optional[str]:
    """Remove HTML tags from input completely.

    Args:
        value: Input string that may contain HTML

    Returns:
        String with HTML tags removed
    """
    if value is None:
        return None
    # Remove HTML tags
    value = re.sub(r'<[^>]+>', '', value)
    return sanitize_text(value)


# ============================================
# Validation Functions
# ============================================

def validate_chinese_name(value: str) -> str:
    """Validate a Chinese name field.

    Allows Chinese characters, alphanumeric, spaces, and common punctuation.
    Rejects control characters and dangerous symbols.

    Args:
        value: Name string to validate

    Returns:
        Validated and sanitized name

    Raises:
        ValueError: If name is invalid
    """
    value = sanitize_text(value)
    if not value:
        raise ValueError('Name cannot be empty')
    if len(value) > MAX_NAME_LENGTH:
        raise ValueError(f'Name exceeds maximum length of {MAX_NAME_LENGTH}')
    # Check for dangerous characters (control chars except tab/newline)
    if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', value):
        raise ValueError('Name contains invalid control characters')
    return value


def validate_no_special_chars(value: str, field_name: str = 'Field') -> str:
    """Validate that a field contains no special/dangerous characters.

    Args:
        value: String to validate
        field_name: Name of the field for error messages

    Returns:
        Validated and sanitized string

    Raises:
        ValueError: If field contains special characters
    """
    value = sanitize_text(value)
    if not value:
        raise ValueError(f'{field_name} cannot be empty')
    # Reject script tags and event handlers
    if re.search(r'<\s*script|on\w+\s*=|javascript:', value, re.IGNORECASE):
        raise ValueError(f'{field_name} contains potentially dangerous content')
    return value


def validate_date_range(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    allow_equal: bool = True
) -> tuple[Optional[date], Optional[date]]:
    """Validate a date range.

    Args:
        start_date: Start of the range
        end_date: End of the range
        allow_equal: Whether start and end can be the same date

    Returns:
        Tuple of (start_date, end_date)

    Raises:
        ValueError: If date range is invalid
    """
    if start_date is not None and end_date is not None:
        if allow_equal and start_date > end_date:
            raise ValueError('Start date must be before or equal to end date')
        if not allow_equal and start_date >= end_date:
            raise ValueError('Start date must be before end date')
    return start_date, end_date


def validate_positive_id(value: Optional[int], field_name: str = 'ID') -> Optional[int]:
    """Validate that an ID is a positive integer.

    Args:
        value: ID value to validate
        field_name: Name of the field for error messages

    Returns:
        Validated ID or None

    Raises:
        ValueError: If ID is not positive
    """
    if value is None:
        return None
    if not isinstance(value, int):
        raise ValueError(f'{field_name} must be an integer')
    if value <= 0:
        raise ValueError(f'{field_name} must be a positive integer')
    return value


def validate_non_empty(value: Optional[str], field_name: str = 'Field', max_length: Optional[int] = None) -> str:
    """Validate that a string field is not empty.

    Args:
        value: String to validate
        field_name: Name of the field for error messages
        max_length: Optional maximum length

    Returns:
        Validated and sanitized string

    Raises:
        ValueError: If string is empty or too long
    """
    sanitized = sanitize_text(value)
    if not sanitized:
        raise ValueError(f'{field_name} cannot be empty')
    if max_length is not None and len(sanitized) > max_length:
        raise ValueError(f'{field_name} exceeds maximum length of {max_length}')
    return sanitized


def validate_chinese_text_length(value: Optional[str], min_chars: int = MIN_CHINESE_CHARS, max_chars: int = MAX_TEXT_FIELD_LENGTH, field_name: str = 'Text') -> Optional[str]:
    """Validate Chinese text length.

    Counts characters (not bytes) to properly handle CJK characters.

    Args:
        value: Text to validate
        min_chars: Minimum character count
        max_chars: Maximum character count
        field_name: Name of the field for error messages

    Returns:
        Validated and sanitized text or None

    Raises:
        ValueError: If text length is out of bounds
    """
    if value is None:
        return None
    sanitized = sanitize_text(value, max_length=max_chars)
    if sanitized is None:
        if min_chars > 0:
            raise ValueError(f'{field_name} cannot be empty')
        return None
    char_count = len(sanitized)
    if char_count < min_chars:
        raise ValueError(f'{field_name} must be at least {min_chars} characters')
    if char_count > max_chars:
        raise ValueError(f'{field_name} exceeds maximum length of {max_chars} characters')
    return sanitized


# ============================================
# Error Response Models
# ============================================

class ErrorDetail(BaseModel):
    """Detailed error information."""
    model_config = ConfigDict(populate_by_name=True)

    loc: Optional[list[str]] = None
    msg: str
    type: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error response format."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool = False
    error_code: str = "ERROR"
    message: str
    details: Optional[list[ErrorDetail]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ValidationErrorResponse(ErrorResponse):
    """Validation error response with field details."""
    error_code: str = "VALIDATION_ERROR"
    message: str = "Request validation failed"


# ============================================
# Pagination Models
# ============================================

T = TypeVar('T')


class PaginationParams(BaseModel):
    """Standard pagination query parameters."""
    model_config = ConfigDict(populate_by_name=True)

    skip: int = Field(default=0, ge=0, description="Number of items to skip")
    limit: int = Field(default=50, ge=1, le=200, description="Maximum items to return")

    @field_validator('limit')
    @classmethod
    def validate_limit(cls, v: int) -> int:
        if v < 1:
            return 50
        if v > 200:
            return 200
        return v


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response wrapper."""
    model_config = ConfigDict(populate_by_name=True)

    items: List[T]
    total: int
    skip: int
    limit: int
    has_more: bool

    @classmethod
    def create(cls, items: List[T], total: int, skip: int, limit: int) -> 'PaginatedResponse[T]':
        """Create a paginated response from items and count."""
        return cls(
            items=items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + len(items)) < total
        )


# ============================================
# Common Response Models
# ============================================

class SuccessResponse(BaseModel):
    """Standard success response."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool = True
    message: str
    data: Optional[Any] = None


class MessageResponse(BaseModel):
    """Simple message response."""
    model_config = ConfigDict(populate_by_name=True)

    message: str


class TimestampedResponse(BaseModel):
    """Base model with timestamp fields."""
    model_config = ConfigDict(from_attributes=True)

    created_at: datetime
    updated_at: Optional[datetime] = None


class IDResponse(BaseModel):
    """Response containing only an ID."""
    model_config = ConfigDict(populate_by_name=True)

    id: int

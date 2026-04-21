"""
Error Handling Middleware
Custom exceptions and handlers for consistent error responses.

Provides:
- Domain-specific exceptions for each entity type
- Standardized error response format
- Request context propagation via contextvars
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from typing import Any, Dict, Optional
from datetime import datetime, timezone
import logging
import contextvars
import uuid

logger = logging.getLogger("writer-api")

# Context variables for request context propagation across async boundaries
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")
correlation_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None
)


# =============================================================================
# Error Codes
# =============================================================================

class ErrorCode:
    """Standardized error codes for the application."""

    # Generic errors (1xxx)
    INTERNAL_ERROR = "INTERNAL_ERROR"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    AUTH_ERROR = "AUTH_ERROR"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    CONFLICT = "CONFLICT"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"

    # External service errors (2xxx)
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    AI_SERVICE_ERROR = "AI_SERVICE_ERROR"
    AI_SERVICE_TIMEOUT = "AI_SERVICE_TIMEOUT"
    AI_SERVICE_RATE_LIMIT = "AI_SERVICE_RATE_LIMIT"

    # Database errors (3xxx)
    DATABASE_ERROR = "DATABASE_ERROR"
    DATABASE_CONNECTION_ERROR = "DATABASE_CONNECTION_ERROR"
    DATABASE_CONSTRAINT_ERROR = "DATABASE_CONSTRAINT_ERROR"

    # Character errors (4xxx)
    CHARACTER_NOT_FOUND = "CHARACTER_NOT_FOUND"
    CHARACTER_NAME_EMPTY = "CHARACTER_NAME_EMPTY"
    CHARACTER_NAME_TOO_LONG = "CHARACTER_NAME_TOO_LONG"
    CHARACTER_RELATIONSHIP_INVALID = "CHARACTER_RELATIONSHIP_INVALID"
    CHARACTER_STORYLINE_NOT_FOUND = "CHARACTER_STORYLINE_NOT_FOUND"

    # Chapter errors (5xxx)
    CHAPTER_NOT_FOUND = "CHAPTER_NOT_FOUND"
    CHAPTER_INVALID_ORDER = "CHAPTER_INVALID_ORDER"
    CHAPTER_ORDER_DUPLICATE = "CHAPTER_ORDER_DUPLICATE"
    CHAPTER_STATUS_INVALID = "CHAPTER_STATUS_INVALID"
    DRAFT_VERSION_NOT_FOUND = "DRAFT_VERSION_NOT_FOUND"
    DRAFT_VERSION_MISMATCH = "DRAFT_VERSION_MISMATCH"

    # Outline errors (6xxx)
    OUTLINE_NOT_FOUND = "OUTLINE_NOT_FOUND"
    OUTLINE_TITLE_EMPTY = "OUTLINE_TITLE_EMPTY"

    # IF Line errors (7xxx)
    IFLINE_NOT_FOUND = "IFLINE_NOT_FOUND"
    IFLINE_SYNC_MODE_INVALID = "IFLINE_SYNC_MODE_INVALID"

    # Item errors (8xxx)
    ITEM_NOT_FOUND = "ITEM_NOT_FOUND"
    ITEM_NAME_EMPTY = "ITEM_NAME_EMPTY"

    # Location errors (9xxx)
    LOCATION_NOT_FOUND = "LOCATION_NOT_FOUND"
    LOCATION_NAME_EMPTY = "LOCATION_NAME_EMPTY"

    # Faction errors (10xxx)
    FACTION_NOT_FOUND = "FACTION_NOT_FOUND"
    FACTION_NAME_EMPTY = "FACTION_NAME_EMPTY"

    # World setting errors (11xxx)
    WORLD_SETTING_NOT_FOUND = "WORLD_SETTING_NOT_FOUND"
    RULE_NOT_FOUND = "RULE_NOT_FOUND"

    # Plot thread errors (12xxx)
    PLOT_THREAD_NOT_FOUND = "PLOT_THREAD_NOT_FOUND"
    PLOT_THREAD_STATUS_INVALID = "PLOT_THREAD_STATUS_INVALID"

    # Chat/Session errors (13xxx)
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    MESSAGE_NOT_FOUND = "MESSAGE_NOT_FOUND"

    # Style errors (14xxx)
    STYLE_NOT_FOUND = "STYLE_NOT_FOUND"
    STYLE_INVALID = "STYLE_INVALID"

    # Export/Import errors (15xxx)
    IMPORT_VERSION_UNSUPPORTED = "IMPORT_VERSION_UNSUPPORTED"
    IMPORT_DATA_INVALID = "IMPORT_DATA_INVALID"


# =============================================================================
# Base Exception
# =============================================================================

class AppException(Exception):
    """Base application exception with standardized error response."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = ErrorCode.INTERNAL_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        self.timestamp = datetime.now(timezone.utc).isoformat()
        super().__init__(self.message)

    def to_dict(self, request_id: Optional[str] = None) -> Dict[str, Any]:
        """Convert exception to standardized error response dict."""
        response: Dict[str, Any] = {
            "error_code": self.error_code,
            "message": self.message,
            "timestamp": self.timestamp,
        }
        if self.details:
            response["details"] = self.details
        if request_id:
            response["request_id"] = request_id
        return response


# =============================================================================
# Generic Exceptions
# =============================================================================

class NotFoundError(AppException):
    """Resource not found."""

    def __init__(
        self,
        message: str = "Resource not found",
        error_code: str = ErrorCode.NOT_FOUND,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=404,
            error_code=error_code,
            details=details,
        )


class ValidationError(AppException):
    """Input validation failed."""

    def __init__(
        self,
        message: str = "Validation failed",
        error_code: str = ErrorCode.VALIDATION_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=422,
            error_code=error_code,
            details=details,
        )


class AuthenticationError(AppException):
    """Authentication failed."""

    def __init__(
        self,
        message: str = "Authentication failed",
        error_code: str = ErrorCode.AUTH_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=401,
            error_code=error_code,
            details=details,
        )


class PermissionDeniedError(AppException):
    """Permission denied."""

    def __init__(
        self,
        message: str = "Permission denied",
        error_code: str = ErrorCode.PERMISSION_DENIED,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=403,
            error_code=error_code,
            details=details,
        )


class ConflictError(AppException):
    """Resource conflict."""

    def __init__(
        self,
        message: str = "Resource conflict",
        error_code: str = ErrorCode.CONFLICT,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=409,
            error_code=error_code,
            details=details,
        )


class RateLimitError(AppException):
    """Rate limit exceeded."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        error_code: str = ErrorCode.RATE_LIMIT_EXCEEDED,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=429,
            error_code=error_code,
            details=details,
        )


class ServiceUnavailableError(AppException):
    """Service temporarily unavailable."""

    def __init__(
        self,
        message: str = "Service temporarily unavailable",
        error_code: str = ErrorCode.SERVICE_UNAVAILABLE,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=503,
            error_code=error_code,
            details=details,
        )


class ExternalServiceError(AppException):
    """External service (AI API, etc.) error."""

    def __init__(
        self,
        message: str = "External service error",
        error_code: str = ErrorCode.EXTERNAL_SERVICE_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=502,
            error_code=error_code,
            details=details,
        )


class DatabaseError(AppException):
    """Database operation error."""

    def __init__(
        self,
        message: str = "Database operation failed",
        error_code: str = ErrorCode.DATABASE_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=500,
            error_code=error_code,
            details=details,
        )


# =============================================================================
# Domain-Specific: Character Exceptions
# =============================================================================

class CharacterNotFoundError(NotFoundError):
    """Character not found."""

    def __init__(
        self,
        character_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"character_id": character_id} if character_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Character not found" + (f" (id={character_id})" if character_id else ""),
            error_code=ErrorCode.CHARACTER_NOT_FOUND,
            details=extra or None,
        )


class CharacterNameEmptyError(ValidationError):
    """Character name is empty."""

    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message="Character name cannot be empty",
            error_code=ErrorCode.CHARACTER_NAME_EMPTY,
            details=details,
        )


class CharacterNameTooLongError(ValidationError):
    """Character name exceeds maximum length."""

    def __init__(self, max_length: int, details: Optional[Dict[str, Any]] = None):
        extra = {"max_length": max_length}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Character name exceeds maximum length of {max_length}",
            error_code=ErrorCode.CHARACTER_NAME_TOO_LONG,
            details=extra,
        )


class CharacterRelationshipInvalidError(ValidationError):
    """Character relationship is invalid."""

    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message="Invalid character relationship",
            error_code=ErrorCode.CHARACTER_RELATIONSHIP_INVALID,
            details=details,
        )


class CharacterStorylineNotFoundError(NotFoundError):
    """Character storyline not found."""

    def __init__(
        self,
        storyline_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"storyline_id": storyline_id} if storyline_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Character storyline not found"
            + (f" (id={storyline_id})" if storyline_id else ""),
            error_code=ErrorCode.CHARACTER_STORYLINE_NOT_FOUND,
            details=extra or None,
        )


# =============================================================================
# Domain-Specific: Chapter Exceptions
# =============================================================================

class ChapterNotFoundError(NotFoundError):
    """Chapter not found."""

    def __init__(
        self,
        chapter_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"chapter_id": chapter_id} if chapter_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Chapter not found" + (f" (id={chapter_id})" if chapter_id else ""),
            error_code=ErrorCode.CHAPTER_NOT_FOUND,
            details=extra or None,
        )


class ChapterInvalidOrderError(ValidationError):
    """Chapter order is invalid."""

    def __init__(
        self,
        order: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"provided_order": order} if order is not None else {}
        if details:
            extra.update(details)
        super().__init__(
            message="Invalid chapter order" + (f": {order}" if order is not None else ""),
            error_code=ErrorCode.CHAPTER_INVALID_ORDER,
            details=extra or None,
        )


class ChapterOrderDuplicateError(ConflictError):
    """Chapter order already exists."""

    def __init__(
        self,
        order: Optional[int] = None,
        outline_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra: Dict[str, Any] = {}
        if order is not None:
            extra["order"] = order
        if outline_id is not None:
            extra["outline_id"] = outline_id
        if details:
            extra.update(details)
        super().__init__(
            message="Chapter order already exists"
            + (f" (order={order})" if order is not None else ""),
            error_code=ErrorCode.CHAPTER_ORDER_DUPLICATE,
            details=extra or None,
        )


class ChapterStatusInvalidError(ValidationError):
    """Chapter status is invalid."""

    def __init__(self, status: str, valid_statuses: Optional[list] = None, details: Optional[Dict[str, Any]] = None):
        extra: Dict[str, Any] = {"provided_status": status}
        if valid_statuses:
            extra["valid_statuses"] = valid_statuses
        if details:
            extra.update(details)
        super().__init__(
            message=f"Invalid chapter status: '{status}'",
            error_code=ErrorCode.CHAPTER_STATUS_INVALID,
            details=extra,
        )


class DraftVersionNotFoundError(NotFoundError):
    """Draft version not found."""

    def __init__(
        self,
        chapter_id: Optional[int] = None,
        version_number: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra: Dict[str, Any] = {}
        if chapter_id is not None:
            extra["chapter_id"] = chapter_id
        if version_number is not None:
            extra["version_number"] = version_number
        if details:
            extra.update(details)
        super().__init__(
            message="Draft version not found",
            error_code=ErrorCode.DRAFT_VERSION_NOT_FOUND,
            details=extra or None,
        )


class DraftVersionMismatchError(ValidationError):
    """Draft version chapter ID mismatch."""

    def __init__(
        self,
        expected_chapter_id: int,
        actual_chapter_id: int,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra: Dict[str, Any] = {
            "expected_chapter_id": expected_chapter_id,
            "actual_chapter_id": actual_chapter_id,
        }
        if details:
            extra.update(details)
        super().__init__(
            message=f"Draft chapter ID mismatch: expected {expected_chapter_id}, got {actual_chapter_id}",
            error_code=ErrorCode.DRAFT_VERSION_MISMATCH,
            details=extra,
        )


# =============================================================================
# Domain-Specific: Outline Exceptions
# =============================================================================

class OutlineNotFoundError(NotFoundError):
    """Outline not found."""

    def __init__(
        self,
        outline_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"outline_id": outline_id} if outline_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Outline not found" + (f" (id={outline_id})" if outline_id else ""),
            error_code=ErrorCode.OUTLINE_NOT_FOUND,
            details=extra or None,
        )


class OutlineTitleEmptyError(ValidationError):
    """Outline title is empty."""

    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message="Outline title cannot be empty",
            error_code=ErrorCode.OUTLINE_TITLE_EMPTY,
            details=details,
        )


# =============================================================================
# Domain-Specific: IF Line Exceptions
# =============================================================================

class IFLineNotFoundError(NotFoundError):
    """IF line not found."""

    def __init__(
        self,
        if_line_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"if_line_id": if_line_id} if if_line_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"IF line not found" + (f" (id={if_line_id})" if if_line_id else ""),
            error_code=ErrorCode.IFLINE_NOT_FOUND,
            details=extra or None,
        )


class IFLineSyncModeInvalidError(ValidationError):
    """IF line sync mode is invalid."""

    def __init__(
        self,
        mode: str,
        valid_modes: Optional[list] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra: Dict[str, Any] = {"provided_mode": mode}
        if valid_modes:
            extra["valid_modes"] = valid_modes
        if details:
            extra.update(details)
        super().__init__(
            message=f"Invalid IF line sync mode: '{mode}'",
            error_code=ErrorCode.IFLINE_SYNC_MODE_INVALID,
            details=extra,
        )


# =============================================================================
# Domain-Specific: Item Exceptions
# =============================================================================

class ItemNotFoundError(NotFoundError):
    """Item not found."""

    def __init__(
        self,
        item_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"item_id": item_id} if item_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Item not found" + (f" (id={item_id})" if item_id else ""),
            error_code=ErrorCode.ITEM_NOT_FOUND,
            details=extra or None,
        )


class ItemNameEmptyError(ValidationError):
    """Item name is empty."""

    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message="Item name cannot be empty",
            error_code=ErrorCode.ITEM_NAME_EMPTY,
            details=details,
        )


# =============================================================================
# Domain-Specific: Location Exceptions
# =============================================================================

class LocationNotFoundError(NotFoundError):
    """Location not found."""

    def __init__(
        self,
        location_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"location_id": location_id} if location_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Location not found" + (f" (id={location_id})" if location_id else ""),
            error_code=ErrorCode.LOCATION_NOT_FOUND,
            details=extra or None,
        )


class LocationNameEmptyError(ValidationError):
    """Location name is empty."""

    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message="Location name cannot be empty",
            error_code=ErrorCode.LOCATION_NAME_EMPTY,
            details=details,
        )


# =============================================================================
# Domain-Specific: Faction Exceptions
# =============================================================================

class FactionNotFoundError(NotFoundError):
    """Faction not found."""

    def __init__(
        self,
        faction_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"faction_id": faction_id} if faction_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Faction not found" + (f" (id={faction_id})" if faction_id else ""),
            error_code=ErrorCode.FACTION_NOT_FOUND,
            details=extra or None,
        )


class FactionNameEmptyError(ValidationError):
    """Faction name is empty."""

    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message="Faction name cannot be empty",
            error_code=ErrorCode.FACTION_NAME_EMPTY,
            details=details,
        )


# =============================================================================
# Domain-Specific: World Setting Exceptions
# =============================================================================

class WorldSettingNotFoundError(NotFoundError):
    """World setting not found."""

    def __init__(
        self,
        setting_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"setting_id": setting_id} if setting_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"World setting not found" + (f" (id={setting_id})" if setting_id else ""),
            error_code=ErrorCode.WORLD_SETTING_NOT_FOUND,
            details=extra or None,
        )


class RuleNotFoundError(NotFoundError):
    """Rule not found."""

    def __init__(
        self,
        rule_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"rule_id": rule_id} if rule_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Rule not found" + (f" (id={rule_id})" if rule_id else ""),
            error_code=ErrorCode.RULE_NOT_FOUND,
            details=extra or None,
        )


# =============================================================================
# Domain-Specific: Plot Thread Exceptions
# =============================================================================

class PlotThreadNotFoundError(NotFoundError):
    """Plot thread not found."""

    def __init__(
        self,
        plot_thread_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"plot_thread_id": plot_thread_id} if plot_thread_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Plot thread not found"
            + (f" (id={plot_thread_id})" if plot_thread_id else ""),
            error_code=ErrorCode.PLOT_THREAD_NOT_FOUND,
            details=extra or None,
        )


class PlotThreadStatusInvalidError(ValidationError):
    """Plot thread status is invalid."""

    def __init__(
        self,
        status: str,
        valid_statuses: Optional[list] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra: Dict[str, Any] = {"provided_status": status}
        if valid_statuses:
            extra["valid_statuses"] = valid_statuses
        if details:
            extra.update(details)
        super().__init__(
            message=f"Invalid plot thread status: '{status}'",
            error_code=ErrorCode.PLOT_THREAD_STATUS_INVALID,
            details=extra,
        )


# =============================================================================
# Domain-Specific: Session/Chat Exceptions
# =============================================================================

class SessionNotFoundError(NotFoundError):
    """Chat session not found."""

    def __init__(
        self,
        session_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"session_id": session_id} if session_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Session not found" + (f" (id={session_id})" if session_id else ""),
            error_code=ErrorCode.SESSION_NOT_FOUND,
            details=extra or None,
        )


class SessionExpiredError(AppException):
    """Chat session has expired."""

    def __init__(
        self,
        session_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"session_id": session_id} if session_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Session has expired" + (f" (id={session_id})" if session_id else ""),
            status_code=410,
            error_code=ErrorCode.SESSION_EXPIRED,
            details=extra or None,
        )


class MessageNotFoundError(NotFoundError):
    """Chat message not found."""

    def __init__(
        self,
        message_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra = {"message_id": message_id} if message_id else {}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Message not found" + (f" (id={message_id})" if message_id else ""),
            error_code=ErrorCode.MESSAGE_NOT_FOUND,
            details=extra or None,
        )


# =============================================================================
# Domain-Specific: Style Exceptions
# =============================================================================

class StyleNotFoundError(NotFoundError):
    """Writing style not found."""

    def __init__(
        self,
        style_id: Optional[int] = None,
        style_name: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra: Dict[str, Any] = {}
        if style_id is not None:
            extra["style_id"] = style_id
        if style_name is not None:
            extra["style_name"] = style_name
        if details:
            extra.update(details)
        super().__init__(
            message=f"Style not found"
            + (f" (id={style_id})" if style_id else (f" (name={style_name})" if style_name else "")),
            error_code=ErrorCode.STYLE_NOT_FOUND,
            details=extra or None,
        )


class StyleInvalidError(ValidationError):
    """Writing style is invalid."""

    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message="Invalid writing style",
            error_code=ErrorCode.STYLE_INVALID,
            details=details,
        )


# =============================================================================
# Domain-Specific: Export/Import Exceptions
# =============================================================================

class ImportVersionUnsupportedError(ValidationError):
    """Import data version is not supported."""

    def __init__(
        self,
        version: str,
        supported_versions: Optional[list] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra: Dict[str, Any] = {"provided_version": version}
        if supported_versions:
            extra["supported_versions"] = supported_versions
        if details:
            extra.update(details)
        super().__init__(
            message=f"Unsupported import version: '{version}'",
            error_code=ErrorCode.IMPORT_VERSION_UNSUPPORTED,
            details=extra,
        )


class ImportDataInvalidError(ValidationError):
    """Import data is invalid."""

    def __init__(self, reason: str, details: Optional[Dict[str, Any]] = None):
        extra = {"reason": reason}
        if details:
            extra.update(details)
        super().__init__(
            message=f"Invalid import data: {reason}",
            error_code=ErrorCode.IMPORT_DATA_INVALID,
            details=extra,
        )


# =============================================================================
# AI Service Exceptions
# =============================================================================

class AIServiceError(ExternalServiceError):
    """AI service error."""

    def __init__(
        self,
        message: str = "AI service error",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code=ErrorCode.AI_SERVICE_ERROR,
            details=details,
        )


class AIServiceTimeoutError(ExternalServiceError):
    """AI service request timed out."""

    def __init__(
        self,
        timeout_seconds: Optional[float] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra: Dict[str, Any] = {}
        if timeout_seconds is not None:
            extra["timeout_seconds"] = timeout_seconds
        if details:
            extra.update(details)
        super().__init__(
            message=f"AI service request timed out"
            + (f" after {timeout_seconds}s" if timeout_seconds else ""),
            error_code=ErrorCode.AI_SERVICE_TIMEOUT,
            details=extra or None,
        )


class AIServiceRateLimitError(ExternalServiceError):
    """AI service rate limit exceeded."""

    def __init__(
        self,
        retry_after: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        extra: Dict[str, Any] = {}
        if retry_after is not None:
            extra["retry_after_seconds"] = retry_after
        if details:
            extra.update(details)
        super().__init__(
            message="AI service rate limit exceeded",
            error_code=ErrorCode.AI_SERVICE_RATE_LIMIT,
            details=extra or None,
        )


# =============================================================================
# Error Response Helpers
# =============================================================================

def build_error_response(
    message: str,
    error_code: str,
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
    timestamp: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a standardized error response structure.

    Format:
        {
            "error_code": str,
            "message": str,
            "details": dict | null,
            "request_id": str | null,
            "timestamp": str (ISO 8601)
        }
    """
    response: Dict[str, Any] = {
        "error_code": error_code,
        "message": message,
        "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
    }
    if details:
        response["details"] = details
    if request_id:
        response["request_id"] = request_id
    return response


def get_current_request_id() -> str:
    """Get the current request ID from context or generate a new one."""
    req_id = request_id_var.get()
    if not req_id:
        req_id = str(uuid.uuid4())
        request_id_var.set(req_id)
    return req_id


def set_request_context(request_id: str, correlation_id: Optional[str] = None) -> None:
    """Set request context for the current async task."""
    request_id_var.set(request_id)
    if correlation_id:
        correlation_id_var.set(correlation_id)


# =============================================================================
# Exception Handlers
# =============================================================================

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle AppException and its subclasses."""
    request_id = getattr(request.state, "request_id", None) or get_current_request_id()

    log_extra = {
        "path": request.url.path,
        "error_code": exc.error_code,
        "request_id": request_id,
        "details": exc.details,
    }

    if exc.status_code >= 500:
        logger.error(
            f"AppException: {exc.error_code} - {exc.message}",
            extra=log_extra,
        )
    else:
        logger.warning(
            f"AppException: {exc.error_code} - {exc.message}",
            extra=log_extra,
        )

    return JSONResponse(
        status_code=exc.status_code,
        content=build_error_response(
            message=exc.message,
            error_code=exc.error_code,
            details=exc.details,
            request_id=request_id,
            timestamp=exc.timestamp,
        ),
    )


async def generic_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Handle unhandled exceptions."""
    request_id = getattr(request.state, "request_id", None) or get_current_request_id()

    logger.error(
        f"Unhandled exception: {exc}",
        extra={
            "path": request.url.path,
            "request_id": request_id,
            "error_type": type(exc).__name__,
        },
        exc_info=True,
    )

    return JSONResponse(
        status_code=500,
        content=build_error_response(
            message="Internal server error",
            error_code=ErrorCode.INTERNAL_ERROR,
            request_id=request_id,
        ),
    )


def register_exception_handlers(app) -> None:
    """Register all exception handlers with the FastAPI app."""
    # Register all AppException subclasses with the generic handler
    app.add_exception_handler(AppException, app_exception_handler)
    # Keep generic handler last
    app.add_exception_handler(Exception, generic_exception_handler)

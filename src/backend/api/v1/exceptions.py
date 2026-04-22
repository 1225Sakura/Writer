"""
API Exceptions
Custom exceptions for API v1 with standardized error format.
"""

from fastapi import HTTPException, status
from typing import Optional, Dict, Any


class APIException(HTTPException):
    """Base API exception with standardized error structure."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        detail = {
            "code": code,
            "message": message,
            "details": details,
        }
        super().__init__(status_code=status_code, detail=detail)


# Common exceptions
class NotFoundException(APIException):
    """Resource not found."""

    def __init__(self, code: str = "NOT_FOUND", message: str = "Resource not found", details: Optional[Dict[str, Any]] = None):
        super().__init__(code=code, message=message, status_code=status.HTTP_404_NOT_FOUND, details=details)


class ValidationException(APIException):
    """Validation error."""

    def __init__(self, code: str = "VALIDATION_ERROR", message: str = "Validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(code=code, message=message, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, details=details)


class ConflictException(APIException):
    """Resource conflict."""

    def __init__(self, code: str = "CONFLICT", message: str = "Resource conflict", details: Optional[Dict[str, Any]] = None):
        super().__init__(code=code, message=message, status_code=status.HTTP_409_CONFLICT, details=details)


class RateLimitException(APIException):
    """Rate limit exceeded."""

    def __init__(self, code: str = "RATE_LIMIT_EXCEEDED", message: str = "Rate limit exceeded", details: Optional[Dict[str, Any]] = None):
        super().__init__(code=code, message=message, status_code=status.HTTP_429_TOO_MANY_REQUESTS, details=details)


class ServiceUnavailableException(APIException):
    """Service unavailable."""

    def __init__(self, code: str = "SERVICE_UNAVAILABLE", message: str = "Service temporarily unavailable", details: Optional[Dict[str, Any]] = None):
        super().__init__(code=code, message=message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE, details=details)


# Domain-specific exceptions
class SessionNotFoundException(NotFoundException):
    def __init__(self, session_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"Session not found" + (f" (id={session_id})" if session_id else "")
        extra = {"session_id": session_id} if session_id else {}
        if details:
            extra.update(details)
        super().__init__(code="SESSION_NOT_FOUND", message=msg, details=extra if extra else None)


class ChapterNotFoundException(NotFoundException):
    def __init__(self, chapter_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"Chapter not found" + (f" (id={chapter_id})" if chapter_id else "")
        extra = {"chapter_id": chapter_id} if chapter_id else {}
        if details:
            extra.update(details)
        super().__init__(code="CHAPTER_NOT_FOUND", message=msg, details=extra if extra else None)


class OutlineNotFoundException(NotFoundException):
    def __init__(self, outline_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"Outline not found" + (f" (id={outline_id})" if outline_id else "")
        extra = {"outline_id": outline_id} if outline_id else {}
        if details:
            extra.update(details)
        super().__init__(code="OUTLINE_NOT_FOUND", message=msg, details=extra if extra else None)


class DraftVersionNotFoundException(NotFoundException):
    def __init__(self, chapter_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = "Draft version not found"
        extra = {"chapter_id": chapter_id} if chapter_id else {}
        if details:
            extra.update(details)
        super().__init__(code="DRAFT_VERSION_NOT_FOUND", message=msg, details=extra if extra else None)


class IFLineNotFoundException(NotFoundException):
    def __init__(self, if_line_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"IF line not found" + (f" (id={if_line_id})" if if_line_id else "")
        extra = {"if_line_id": if_line_id} if if_line_id else {}
        if details:
            extra.update(details)
        super().__init__(code="IFLINE_NOT_FOUND", message=msg, details=extra if extra else None)


class PlotThreadNotFoundException(NotFoundException):
    def __init__(self, plot_thread_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"Plot thread not found" + (f" (id={plot_thread_id})" if plot_thread_id else "")
        extra = {"plot_thread_id": plot_thread_id} if plot_thread_id else {}
        if details:
            extra.update(details)
        super().__init__(code="PLOT_THREAD_NOT_FOUND", message=msg, details=extra if extra else None)


class StyleNotFoundException(NotFoundException):
    def __init__(self, style_id: Optional[int] = None, style_name: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        msg = "Style not found" + (f" (id={style_id})" if style_id else (f" (name={style_name})" if style_name else ""))
        extra: Dict[str, Any] = {}
        if style_id is not None:
            extra["style_id"] = style_id
        if style_name is not None:
            extra["style_name"] = style_name
        if details:
            extra.update(details)
        super().__init__(code="STYLE_NOT_FOUND", message=msg, details=extra if extra else None)


class CharacterNotFoundException(NotFoundException):
    def __init__(self, character_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"Character not found" + (f" (id={character_id})" if character_id else "")
        extra = {"character_id": character_id} if character_id else {}
        if details:
            extra.update(details)
        super().__init__(code="CHARACTER_NOT_FOUND", message=msg, details=extra if extra else None)


class ItemNotFoundException(NotFoundException):
    def __init__(self, item_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"Item not found" + (f" (id={item_id})" if item_id else "")
        extra = {"item_id": item_id} if item_id else {}
        if details:
            extra.update(details)
        super().__init__(code="ITEM_NOT_FOUND", message=msg, details=extra if extra else None)


class LocationNotFoundException(NotFoundException):
    def __init__(self, location_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"Location not found" + (f" (id={location_id})" if location_id else "")
        extra = {"location_id": location_id} if location_id else {}
        if details:
            extra.update(details)
        super().__init__(code="LOCATION_NOT_FOUND", message=msg, details=extra if extra else None)


class FactionNotFoundException(NotFoundException):
    def __init__(self, faction_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"Faction not found" + (f" (id={faction_id})" if faction_id else "")
        extra = {"faction_id": faction_id} if faction_id else {}
        if details:
            extra.update(details)
        super().__init__(code="FACTION_NOT_FOUND", message=msg, details=extra if extra else None)


class WorldSettingNotFoundException(NotFoundException):
    def __init__(self, setting_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"World setting not found" + (f" (id={setting_id})" if setting_id else "")
        extra = {"setting_id": setting_id} if setting_id else {}
        if details:
            extra.update(details)
        super().__init__(code="WORLD_SETTING_NOT_FOUND", message=msg, details=extra if extra else None)


class RuleNotFoundException(NotFoundException):
    def __init__(self, rule_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"Rule not found" + (f" (id={rule_id})" if rule_id else "")
        extra = {"rule_id": rule_id} if rule_id else {}
        if details:
            extra.update(details)
        super().__init__(code="RULE_NOT_FOUND", message=msg, details=extra if extra else None)


class ImportVersionUnsupportedException(ValidationException):
    def __init__(self, version: str, supported_versions: Optional[list] = None, details: Optional[Dict[str, Any]] = None):
        extra: Dict[str, Any] = {"provided_version": version}
        if supported_versions:
            extra["supported_versions"] = supported_versions
        if details:
            extra.update(details)
        super().__init__(code="IMPORT_VERSION_UNSUPPORTED", message=f"Unsupported import version: {version}", details=extra)


class EntityNotFoundException(NotFoundException):
    def __init__(self, entity_type: str, entity_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        msg = f"{entity_type} not found" + (f" (id={entity_id})" if entity_id else "")
        extra = {"entity_type": entity_type, "entity_id": entity_id} if entity_id else {"entity_type": entity_type}
        if details:
            extra.update(details)
        super().__init__(code=f"{entity_type.upper().replace(' ', '_')}_NOT_FOUND", message=msg, details=extra if extra else None)


class TaskNotFoundException(NotFoundException):
    def __init__(self, task_id: str, details: Optional[Dict[str, Any]] = None):
        extra = {"task_id": task_id}
        if details:
            extra.update(details)
        super().__init__(code="TASK_NOT_FOUND", message=f"Task {task_id} not found", details=extra)


class SnapshotNotFoundException(NotFoundException):
    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(code="SNAPSHOT_NOT_FOUND", message="Snapshot not found", details=details)


class ArchiveNotFoundException(NotFoundException):
    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(code="ARCHIVE_NOT_FOUND", message="Archive not found", details=details)


class GenreNotFoundException(NotFoundException):
    def __init__(self, genre: str, details: Optional[Dict[str, Any]] = None):
        extra = {"genre": genre}
        if details:
            extra.update(details)
        super().__init__(code="GENRE_NOT_FOUND", message=f"Genre '{genre}' not found", details=extra)


class AIServiceException(ServiceUnavailableException):
    def __init__(self, message: str = "AI service error", details: Optional[Dict[str, Any]] = None):
        super().__init__(code="AI_SERVICE_ERROR", message=message, details=details)


class AIQuotaExceededException(RateLimitException):
    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(code="AI_SERVICE_RATE_LIMIT", message="AI service rate limit exceeded", details=details)
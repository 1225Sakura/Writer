"""Error Handling Middleware Package."""

from .errors import (
    # Context variables
    request_id_var,
    correlation_id_var,
    get_current_request_id,
    set_request_context,
    # Error codes
    ErrorCode,
    # Base exception
    AppException,
    # Generic exceptions
    NotFoundError,
    ValidationError,
    AuthenticationError,
    PermissionDeniedError,
    ConflictError,
    RateLimitError,
    ServiceUnavailableError,
    ExternalServiceError,
    DatabaseError,
    # Character exceptions
    CharacterNotFoundError,
    CharacterNameEmptyError,
    CharacterNameTooLongError,
    CharacterRelationshipInvalidError,
    CharacterStorylineNotFoundError,
    # Chapter exceptions
    ChapterNotFoundError,
    ChapterInvalidOrderError,
    ChapterOrderDuplicateError,
    ChapterStatusInvalidError,
    DraftVersionNotFoundError,
    DraftVersionMismatchError,
    # Outline exceptions
    OutlineNotFoundError,
    OutlineTitleEmptyError,
    # IF Line exceptions
    IFLineNotFoundError,
    IFLineSyncModeInvalidError,
    # Item exceptions
    ItemNotFoundError,
    ItemNameEmptyError,
    # Location exceptions
    LocationNotFoundError,
    LocationNameEmptyError,
    # Faction exceptions
    FactionNotFoundError,
    FactionNameEmptyError,
    # World setting exceptions
    WorldSettingNotFoundError,
    RuleNotFoundError,
    # Plot thread exceptions
    PlotThreadNotFoundError,
    PlotThreadStatusInvalidError,
    # Session/Chat exceptions
    SessionNotFoundError,
    SessionExpiredError,
    MessageNotFoundError,
    # Style exceptions
    StyleNotFoundError,
    StyleInvalidError,
    # Export/Import exceptions
    ImportVersionUnsupportedError,
    ImportDataInvalidError,
    # AI Service exceptions
    AIServiceError,
    AIServiceTimeoutError,
    AIServiceRateLimitError,
    # Helpers
    build_error_response,
    register_exception_handlers,
)

__all__ = [
    "request_id_var",
    "correlation_id_var",
    "get_current_request_id",
    "set_request_context",
    "ErrorCode",
    "AppException",
    "NotFoundError",
    "ValidationError",
    "AuthenticationError",
    "PermissionDeniedError",
    "ConflictError",
    "RateLimitError",
    "ServiceUnavailableError",
    "ExternalServiceError",
    "DatabaseError",
    "CharacterNotFoundError",
    "CharacterNameEmptyError",
    "CharacterNameTooLongError",
    "CharacterRelationshipInvalidError",
    "CharacterStorylineNotFoundError",
    "ChapterNotFoundError",
    "ChapterInvalidOrderError",
    "ChapterOrderDuplicateError",
    "ChapterStatusInvalidError",
    "DraftVersionNotFoundError",
    "DraftVersionMismatchError",
    "OutlineNotFoundError",
    "OutlineTitleEmptyError",
    "IFLineNotFoundError",
    "IFLineSyncModeInvalidError",
    "ItemNotFoundError",
    "ItemNameEmptyError",
    "LocationNotFoundError",
    "LocationNameEmptyError",
    "FactionNotFoundError",
    "FactionNameEmptyError",
    "WorldSettingNotFoundError",
    "RuleNotFoundError",
    "PlotThreadNotFoundError",
    "PlotThreadStatusInvalidError",
    "SessionNotFoundError",
    "SessionExpiredError",
    "MessageNotFoundError",
    "StyleNotFoundError",
    "StyleInvalidError",
    "ImportVersionUnsupportedError",
    "ImportDataInvalidError",
    "AIServiceError",
    "AIServiceTimeoutError",
    "AIServiceRateLimitError",
    "build_error_response",
    "register_exception_handlers",
]

"""
Centralized exception hierarchy for the Writer application.

Re-exports all exceptions from middleware.errors and adds missing domain-specific types.
Import from this module for all exception handling across the codebase.
"""

# Re-export all existing exceptions from middleware.errors
from backend.middleware.errors import (
    AppException,
    ErrorCode,
    # HTTP/API errors
    NotFoundError,
    ValidationError,
    AuthenticationError,
    PermissionDeniedError,
    ConflictError,
    RateLimitError,
    ServiceUnavailableError,
    # External service errors
    ExternalServiceError,
    AIServiceError,
    AIServiceTimeoutError,
    AIServiceRateLimitError,
    # Database errors
    DatabaseError,
    # Entity-specific errors
    CharacterNotFoundError,
    CharacterNameEmptyError,
    CharacterNameTooLongError,
    CharacterRelationshipInvalidError,
    CharacterStorylineNotFoundError,
    ChapterNotFoundError,
    ChapterInvalidOrderError,
    ChapterOrderDuplicateError,
    ChapterStatusInvalidError,
    DraftVersionNotFoundError,
    DraftVersionMismatchError,
    OutlineNotFoundError,
    OutlineTitleEmptyError,
    IFLineNotFoundError,
    IFLineSyncModeInvalidError,
    ItemNotFoundError,
    ItemNameEmptyError,
    LocationNotFoundError,
    LocationNameEmptyError,
    FactionNotFoundError,
    FactionNameEmptyError,
    WorldSettingNotFoundError,
    RuleNotFoundError,
    PlotThreadNotFoundError,
    PlotThreadStatusInvalidError,
    SessionNotFoundError,
    SessionExpiredError,
    MessageNotFoundError,
    StyleNotFoundError,
    StyleInvalidError,
    ImportVersionUnsupportedError,
    ImportDataInvalidError,
)


# =============================================================================
# Agent & Checker Exceptions
# =============================================================================

class AgentError(AppException):
    """Base exception for agent-related failures."""
    def __init__(self, message: str = "Agent error", agent_name: str = "", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "AGENT_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )
        self.agent_name = agent_name


class AgentTimeoutError(AgentError):
    """Agent operation timed out."""
    def __init__(self, message: str = "Agent operation timed out", **kwargs):
        super().__init__(message=message, error_code="AGENT_TIMEOUT", **kwargs)


class AgentContextError(AgentError):
    """Agent context is invalid or missing required fields."""
    def __init__(self, message: str = "Invalid agent context", **kwargs):
        super().__init__(message=message, error_code="AGENT_CONTEXT_ERROR", **kwargs)


class CheckerError(AppException):
    """Base exception for checker pipeline failures."""
    def __init__(self, message: str = "Checker error", checker_name: str = "", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "CHECKER_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )
        self.checker_name = checker_name


class CheckerAnalysisError(CheckerError):
    """Checker analysis failed (not a quality failure, but an execution failure)."""
    def __init__(self, message: str = "Checker analysis failed", **kwargs):
        super().__init__(message=message, error_code="CHECKER_ANALYSIS_ERROR", **kwargs)


# =============================================================================
# Infrastructure Exceptions
# =============================================================================

class CacheError(AppException):
    """Cache operation failed."""
    def __init__(self, message: str = "Cache error", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "CACHE_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )


class EncryptionError(AppException):
    """Encryption/decryption operation failed."""
    def __init__(self, message: str = "Encryption error", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "ENCRYPTION_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )


class EmbeddingError(AppException):
    """Embedding generation or search failed."""
    def __init__(self, message: str = "Embedding error", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "EMBEDDING_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )


class RAGError(AppException):
    """RAG (Retrieval-Augmented Generation) operation failed."""
    def __init__(self, message: str = "RAG error", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "RAG_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )


class TaskQueueError(AppException):
    """Task queue operation failed."""
    def __init__(self, message: str = "Task queue error", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "TASK_QUEUE_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )


class ExportImportError(AppException):
    """Export/import operation failed."""
    def __init__(self, message: str = "Export/import error", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "EXPORT_IMPORT_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )


class SnapshotError(AppException):
    """Snapshot operation failed."""
    def __init__(self, message: str = "Snapshot error", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "SNAPSHOT_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )


class ConstraintError(AppException):
    """Constraint engine operation failed."""
    def __init__(self, message: str = "Constraint error", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "CONSTRAINT_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )


class GraphServiceError(AppException):
    """Graph service operation failed."""
    def __init__(self, message: str = "Graph service error", **kwargs):
        super().__init__(
            message=message,
            error_code=kwargs.pop("error_code", "GRAPH_SERVICE_ERROR"),
            status_code=kwargs.pop("status_code", 500),
            **kwargs,
        )


__all__ = [
    # Base
    "AppException",
    "ErrorCode",
    # HTTP/API
    "NotFoundError",
    "ValidationError",
    "AuthenticationError",
    "PermissionDeniedError",
    "ConflictError",
    "RateLimitError",
    "ServiceUnavailableError",
    # External service
    "ExternalServiceError",
    "AIServiceError",
    "AIServiceTimeoutError",
    "AIServiceRateLimitError",
    # Database
    "DatabaseError",
    # Agent/Checker
    "AgentError",
    "AgentTimeoutError",
    "AgentContextError",
    "CheckerError",
    "CheckerAnalysisError",
    # Infrastructure
    "CacheError",
    "EncryptionError",
    "EmbeddingError",
    "RAGError",
    "TaskQueueError",
    "ExportImportError",
    "SnapshotError",
    "ConstraintError",
    "GraphServiceError",
    # Entity-specific (all re-exported)
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
]

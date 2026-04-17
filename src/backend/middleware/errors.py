# Error Handling Middleware
# Custom exceptions and handlers for consistent error responses

from fastapi import Request
from fastapi.responses import JSONResponse
from typing import Any, Dict, Optional
import logging
import traceback

logger = logging.getLogger('writer-api')


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_ERROR",
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(AppException):
    """Resource not found."""

    def __init__(
        self,
        message: str = "Resource not found",
        error_code: str = "NOT_FOUND",
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
        error_code: str = "VALIDATION_ERROR",
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
        error_code: str = "AUTH_ERROR",
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
        error_code: str = "PERMISSION_DENIED",
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
        error_code: str = "CONFLICT",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=409,
            error_code=error_code,
            details=details,
        )


class ExternalServiceError(AppException):
    """External service (AI API, etc.) error."""

    def __init__(
        self,
        message: str = "External service error",
        error_code: str = "EXTERNAL_SERVICE_ERROR",
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
        error_code: str = "DATABASE_ERROR",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=500,
            error_code=error_code,
            details=details,
        )


def build_error_response(
    message: str,
    error_code: str,
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a consistent error response structure."""
    response = {
        "success": False,
        "error": {
            "code": error_code,
            "message": message,
        },
    }
    if details:
        response["error"]["details"] = details
    if request_id:
        response["request_id"] = request_id
    return response


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle AppException and its subclasses."""
    logger.warning(
        f"AppException: {exc.error_code} - {exc.message}",
        extra={"path": request.url.path, "details": exc.details},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=build_error_response(
            message=exc.message,
            error_code=exc.error_code,
            details=exc.details,
        ),
    )


async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    """Handle NotFoundError."""
    return await app_exception_handler(request, exc)


async def validation_exception_handler(
    request: Request, exc: ValidationError
) -> JSONResponse:
    """Handle ValidationError."""
    return await app_exception_handler(request, exc)


async def auth_exception_handler(
    request: Request, exc: AuthenticationError
) -> JSONResponse:
    """Handle AuthenticationError."""
    return await app_exception_handler(request, exc)


async def permission_exception_handler(
    request: Request, exc: PermissionDeniedError
) -> JSONResponse:
    """Handle PermissionDeniedError."""
    return await app_exception_handler(request, exc)


async def conflict_exception_handler(
    request: Request, exc: ConflictError
) -> JSONResponse:
    """Handle ConflictError."""
    return await app_exception_handler(request, exc)


async def external_service_exception_handler(
    request: Request, exc: ExternalServiceError
) -> JSONResponse:
    """Handle ExternalServiceError."""
    logger.error(
        f"ExternalServiceError: {exc.message}",
        extra={"path": request.url.path, "details": exc.details},
    )
    return await app_exception_handler(request, exc)


async def database_exception_handler(
    request: Request, exc: DatabaseError
) -> JSONResponse:
    """Handle DatabaseError."""
    logger.error(
        f"DatabaseError: {exc.message}",
        extra={"path": request.url.path, "details": exc.details},
    )
    return await app_exception_handler(request, exc)


async def generic_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Handle unhandled exceptions."""
    logger.error(
        f"Unhandled exception: {exc}",
        extra={"path": request.url.path},
    )
    return JSONResponse(
        status_code=500,
        content=build_error_response(
            message="Internal server error",
            error_code="INTERNAL_ERROR",
        ),
    )


def register_exception_handlers(app):
    """Register all exception handlers with the FastAPI app."""
    app.add_exception_handler(NotFoundError, not_found_handler)
    app.add_exception_handler(ValidationError, validation_exception_handler)
    app.add_exception_handler(AuthenticationError, auth_exception_handler)
    app.add_exception_handler(PermissionDeniedError, permission_exception_handler)
    app.add_exception_handler(ConflictError, conflict_exception_handler)
    app.add_exception_handler(ExternalServiceError, external_service_exception_handler)
    app.add_exception_handler(DatabaseError, database_exception_handler)
    # Keep generic handler last
    app.add_exception_handler(Exception, generic_exception_handler)

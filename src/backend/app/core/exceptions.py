"""Custom exceptions and global error handler (v0.4 P0-Sec8 hardened).

v0.4 changes:
- Every error response includes correlation_id (UUID4)
- Generic exception handler no longer leaks str(exc) to UI
- X-Request-ID middleware: reads or generates request-scoped correlation_id
"""
from __future__ import annotations

import logging
import uuid

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

logger = logging.getLogger(__name__)


class WriterException(Exception):
    """Base application exception."""
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundException(WriterException):
    def __init__(self, resource: str, id: int | str):
        super().__init__("NOT_FOUND", f"{resource} not found: {id}", status.HTTP_404_NOT_FOUND)


class ValidationException(WriterException):
    def __init__(self, message: str):
        super().__init__("VALIDATION_ERROR", message, status.HTTP_400_BAD_REQUEST)


class AuthException(WriterException):
    def __init__(self, message: str = "Invalid API key"):
        super().__init__("AUTH_ERROR", message, status.HTTP_401_UNAUTHORIZED)


class ConflictException(WriterException):
    def __init__(self, message: str):
        super().__init__("CONFLICT", message, status.HTTP_409_CONFLICT)


def _get_correlation_id(request: Request) -> str:
    """Read X-Request-ID header or generate UUID4."""
    cid = request.headers.get("X-Request-ID") or request.headers.get("x-request-id")
    if not cid:
        cid = str(uuid.uuid4())
    return cid


def _make_error_response(
    code: str, message: str, correlation_id: str, errors: dict | None = None
) -> dict:
    body = {"success": False, "error": {"code": code, "message": message, "correlation_id": correlation_id}}
    if errors:
        body["error"]["errors"] = errors
    return body


async def writer_exception_handler(request: Request, exc: WriterException) -> JSONResponse:
    cid = _get_correlation_id(request)
    return JSONResponse(
        status_code=exc.status_code,
        content=_make_error_response(exc.code, exc.message, cid),
        headers={"X-Request-ID": cid},
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    cid = _get_correlation_id(request)
    errors: dict[str, list[str]] = {}
    for err in exc.errors():
        loc = ".".join(str(x) for x in err.get("loc", []))
        errors.setdefault(loc, []).append(err.get("msg", "Invalid value"))
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=_make_error_response("VALIDATION_ERROR", "Request validation failed", cid, errors),
        headers={"X-Request-ID": cid},
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """v0.4 P0-Sec8: NEVER leak str(exc) to UI. Log full traceback server-side."""
    cid = _get_correlation_id(request)
    # Log full exception server-side for debugging
    logger.exception("Unhandled exception [correlation_id=%s]", cid)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_make_error_response(
            "INTERNAL_ERROR",
            "Internal server error (see server logs with correlation_id)",
            cid,
        ),
        headers={"X-Request-ID": cid},
    )
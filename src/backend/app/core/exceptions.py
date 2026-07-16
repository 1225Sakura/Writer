"""Custom exceptions and global error handler.

2026 Decision: FastAPI HTTPException default format doesn't match frontend expectations.
We return {success: false, error: {code, message, errors?}} uniformly.
"""
from __future__ import annotations

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError


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


def _make_error_response(code: str, message: str, errors: dict | None = None) -> dict:
    body = {"success": False, "error": {"code": code, "message": message}}
    if errors:
        body["error"]["errors"] = errors
    return body


async def writer_exception_handler(_request: Request, exc: WriterException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_make_error_response(exc.code, exc.message),
    )


async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors: dict[str, list[str]] = {}
    for err in exc.errors():
        loc = ".".join(str(x) for x in err.get("loc", []))
        errors.setdefault(loc, []).append(err.get("msg", "Invalid value"))
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=_make_error_response("VALIDATION_ERROR", "Request validation failed", errors),
    )


async def generic_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_make_error_response("SERVER_ERROR", str(exc) or "Internal server error"),
    )

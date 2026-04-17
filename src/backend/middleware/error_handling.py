# Error handling and validation middleware

import traceback
import logging
from typing import Union, Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import ValidationError

from utils.logging import get_logger

logger = get_logger("writer-api.middleware.error")


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for comprehensive error handling with:
    - Consistent error response format
    - Request ID tracking for error correlation
    - Structured error logging
    - Pydantic validation error handling
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            return response
        except ValidationError as e:
            return self._handle_validation_error(request, e)
        except Exception as e:
            return self._handle_generic_error(request, e)

    def _handle_validation_error(self, request: Request, exc: ValidationError) -> JSONResponse:
        """Handle Pydantic validation errors with detailed field-level feedback."""
        request_id = getattr(request.state, "request_id", "unknown")

        errors = []
        for error in exc.errors():
            errors.append({
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            })

        logger.warning(
            f"Validation error on {request.method} {request.url.path}",
            extra={
                "event": "validation_error",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "errors": errors,
            }
        )

        return JSONResponse(
            status_code=422,
            content={
                "detail": "Validation error",
                "request_id": request_id,
                "errors": errors,
            }
        )

    def _handle_generic_error(self, request: Request, exc: Exception) -> JSONResponse:
        """Handle unexpected errors with stack traces in debug mode."""
        request_id = getattr(request.state, "request_id", "unknown")

        error_id = f"ERR-{request_id[:8]}"

        logger.error(
            f"Unhandled error: {exc}",
            extra={
                "event": "unhandled_error",
                "request_id": request_id,
                "error_id": error_id,
                "method": request.method,
                "path": request.url.path,
                "error_type": type(exc).__name__,
                "traceback": traceback.format_exc(),
            },
            exc_info=True,
        )

        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "error_id": error_id,
                "request_id": request_id,
            }
        )


def setup_error_handling_middleware(app):
    """Register the error handling middleware with the FastAPI app."""
    app.add_middleware(ErrorHandlingMiddleware)

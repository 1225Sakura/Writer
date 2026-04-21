"""
Request Context Propagation Module

Provides context variable management for request IDs and correlation IDs
across async boundaries using Python's contextvars.

Usage:
    from middleware.request_context import get_request_id, set_request_id

    async def some_service():
        request_id = get_request_id()
        logger.info("Processing", extra={"request_id": request_id})
"""

import contextvars
import uuid
from typing import Optional

# Context variables for request context propagation across async boundaries
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default=""
)
correlation_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None
)
user_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "user_id", default=None
)


def get_request_id() -> str:
    """Get the current request ID from context, or generate a new one."""
    req_id = request_id_var.get()
    if not req_id:
        req_id = str(uuid.uuid4())
        request_id_var.set(req_id)
    return req_id


def set_request_id(request_id: str) -> None:
    """Set the request ID for the current async context."""
    request_id_var.set(request_id)


def get_correlation_id() -> Optional[str]:
    """Get the current correlation ID from context."""
    return correlation_id_var.get()


def set_correlation_id(correlation_id: Optional[str]) -> None:
    """Set the correlation ID for the current async context."""
    correlation_id_var.set(correlation_id)


def get_user_id() -> Optional[str]:
    """Get the current user ID from context."""
    return user_id_var.get()


def set_user_id(user_id: Optional[str]) -> None:
    """Set the user ID for the current async context."""
    user_id_var.set(user_id)


def get_request_context() -> dict:
    """Get the full request context as a dictionary."""
    return {
        "request_id": get_request_id(),
        "correlation_id": get_correlation_id(),
        "user_id": get_user_id(),
    }


def set_request_context(
    request_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> str:
    """Set the full request context for the current async task.

    Args:
        request_id: Request ID (generated if not provided)
        correlation_id: Optional correlation ID for tracing
        user_id: Optional user ID

    Returns:
        The request ID (generated or provided)
    """
    req_id = request_id or str(uuid.uuid4())
    request_id_var.set(req_id)
    if correlation_id:
        correlation_id_var.set(correlation_id)
    if user_id:
        user_id_var.set(user_id)
    return req_id


def clear_request_context() -> None:
    """Clear all request context variables."""
    request_id_var.set("")
    correlation_id_var.set(None)
    user_id_var.set(None)

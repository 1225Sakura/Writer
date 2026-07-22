"""Correlation ID middleware.

v0.4 P0-Sec8: Mint or read X-Request-ID per request; attach to request.state
and echo back in response headers. Works with `app.core.logging.CorrelationIDFilter`
to inject correlation_id into every log record for traceability.
"""
from __future__ import annotations

import uuid
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Read X-Request-ID from inbound headers or mint a UUID4.

    - Inbound header present → use it (allows caller-supplied correlation)
    - Inbound header missing → mint `str(uuid.uuid4())`
    - Attaches to `request.state.correlation_id` for downstream handlers
    - Echoes back in `X-Request-ID` response header for client-side correlation
    - Compatible with `app.core.logging.CorrelationIDFilter` via contextvars
    """

    HEADER_NAME = "X-Request-ID"

    async def dispatch(self, request: Request, call_next) -> Response:
        cid: Optional[str] = request.headers.get(self.HEADER_NAME)
        if not cid or not cid.strip():
            cid = str(uuid.uuid4())
        # Attach to request.state for explicit access in handlers.
        request.state.correlation_id = cid
        # Also push into contextvar so logging filter can pick it up.
        _correlation_id_var.set(cid)
        try:
            response = await call_next(request)
        finally:
            _correlation_id_var.set(None)
        response.headers[self.HEADER_NAME] = cid
        return response


# ---------------------------------------------------------------------------
# ContextVar — accessed by logging filter; survives across middleware chain.
# ---------------------------------------------------------------------------

from contextvars import ContextVar

_correlation_id_var: ContextVar[Optional[str]] = ContextVar(
    "correlation_id", default=None
)


def get_correlation_id() -> Optional[str]:
    """Public accessor used by logging filter and exception handlers."""
    return _correlation_id_var.get()

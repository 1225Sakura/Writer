# Auto Novel Writer - Local API Authentication
# Lightweight auth for desktop app (not multi-user SaaS)

import secrets
import ipaddress
from typing import Optional

from fastapi import Request, HTTPException, Depends, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

from backend.config import settings
from backend.utils.logging import get_logger

logger = get_logger('auth')

# Security scheme for OpenAPI docs
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# In-memory cache for the API key (avoids repeated DB lookups)
_api_key_cache: Optional[str] = None


class AuthConfig(BaseModel):
    """Auth configuration model."""
    api_key: str
    allow_localhost_skip: bool = True


class AuthResponse(BaseModel):
    """Response model for auth endpoints."""
    api_key: str
    message: str


def _is_localhost_request(request: Request) -> bool:
    """Check if request originates from localhost/loopback."""
    client_host = request.client.host if request.client else None
    if not client_host:
        return False
    try:
        addr = ipaddress.ip_address(client_host)
        return addr.is_loopback
    except ValueError:
        return client_host in ("localhost", "127.0.0.1", "::1")


def generate_api_key() -> str:
    """Generate a secure random API key."""
    return f"writer_{secrets.token_urlsafe(32)}"


async def get_or_create_api_key() -> str:
    """Get existing API key from config or generate a new one."""
    global _api_key_cache

    if _api_key_cache:
        return _api_key_cache

    # Try to get from settings (env var or .env file)
    if hasattr(settings, 'api_key') and settings.api_key:
        _api_key_cache = settings.api_key
        return _api_key_cache

    # Generate and store a new key
    new_key = generate_api_key()
    _api_key_cache = new_key

    # Log a warning that a new key was generated
    logger.info("Generated new API key for local authentication")

    return new_key


def set_api_key(key: str) -> None:
    """Set the API key (used for testing)."""
    global _api_key_cache
    _api_key_cache = key


def clear_api_key_cache() -> None:
    """Clear the API key cache."""
    global _api_key_cache
    _api_key_cache = None


async def verify_api_key(
    request: Request,
    api_key: Optional[str] = Depends(api_key_header)
) -> bool:
    """
    Verify API key from request header.

    - Skips auth for health checks (handled at router level)
    - Skips auth for localhost requests if configured
    - Requires X-API-Key header for all other requests
    """
    # Allow localhost requests to skip auth (dev convenience)
    if getattr(settings, 'auth_skip_localhost', True):
        if _is_localhost_request(request):
            return True

    # Check API key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    valid_key = await get_or_create_api_key()
    if not secrets.compare_digest(api_key, valid_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )

    return True


# Dependency alias for cleaner route definitions
require_auth = Depends(verify_api_key)

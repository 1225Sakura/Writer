# Auto Novel Writer - Authentication Routes
# Local API key management for desktop app

from fastapi import APIRouter, HTTPException, status

from backend.middleware.auth import (
    get_or_create_api_key,
    generate_api_key,
    set_api_key,
    AuthResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/key", response_model=AuthResponse)
async def get_api_key():
    """
    Get or create the local API key.

    For a desktop app, this returns the existing key.
    The key is generated once and persisted for the app's lifetime.
    """
    key = await get_or_create_api_key()
    return AuthResponse(
        api_key=key,
        message="Use this key in the X-API-Key header for all API requests"
    )


@router.post("/key/refresh", response_model=AuthResponse)
async def refresh_api_key():
    """
    Generate a new API key, invalidating the old one.

    Use this if you suspect the key has been compromised.
    """
    new_key = generate_api_key()
    set_api_key(new_key)
    return AuthResponse(
        api_key=new_key,
        message="API key refreshed. Update your client with the new key."
    )


@router.get("/status")
async def auth_status():
    """Check if authentication is configured."""
    key = await get_or_create_api_key()
    return {
        "enabled": True,
        "key_configured": bool(key),
        "auth_type": "api_key",
        "skip_localhost": True,
    }

"""Auth API router — local desktop API key management.

v0.4 P0-Sec1a: Provides first-launch key initialization, status check, and key rotation.
Mounted at /auth/* (NOT under /api/v1/* per v0.4 spec — these are bootstrap endpoints).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.core.security import get_or_init_api_key

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/status")
async def auth_status() -> dict:
    """Check auth initialization status without exposing the key.

    Returns:
        {initialized: bool, keychain_available: bool}
    """
    settings = get_settings()
    keychain_available = True
    try:
        import keyring  # type: ignore
        keyring.get_password("writer", "master_key")
    except Exception:
        keychain_available = False

    return {
        "initialized": bool(settings.api_key),
        "keychain_available": keychain_available,
    }


@router.post("/key/init")
async def init_auth_key() -> dict:
    """Initialize API key on first launch.

    Idempotent: returns existing key if already initialized.
    In dev mode (NODE_ENV=development) the key is logged once at startup.
    """
    key = get_or_init_api_key()
    return {"initialized": True, "key": key}


@router.post("/key/refresh")
async def refresh_auth_key() -> dict:
    """Rotate API key (invalidates old key).

    Per spec v0.4 §5.1 P0-Sec1a — not auto-exposed in production UI.
    """
    import secrets

    settings = get_settings()
    new_key = secrets.token_urlsafe(32)
    settings.api_key = new_key

    # Persist to .env
    from pathlib import Path

    env_path = Path(".env")
    env_path.touch(mode=0o600, exist_ok=True)
    with env_path.open("a") as f:
        f.write(f"\nAPI_KEY={new_key}\n")
    return {"rotated": True, "key": new_key}


@router.get("/key")
async def get_key_status() -> dict:
    """Get current key fingerprint (NOT the key itself) for verification."""
    import hashlib

    settings = get_settings()
    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "AUTH_NOT_INITIALIZED",
                              "message": "Auth not initialized"}},
        )
    fingerprint = hashlib.sha256(settings.api_key.encode()).hexdigest()[:16]
    return {"fingerprint": fingerprint, "length": len(settings.api_key)}
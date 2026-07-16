"""Local API key security (Electron desktop only).

2026 Decision: Desktop app doesn't need JWT/OAuth. A single X-API-Key header is sufficient.
The key is stored in backend config (not user-facing). Electron renderer sends it via IPC.
"""
from __future__ import annotations

from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader

from app.config import get_settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(api_key_header)) -> str:
    """FastAPI dependency to verify local API key."""
    settings = get_settings()
    if not api_key or api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": {"code": "AUTH_ERROR", "message": "Invalid API key"}},
        )
    return api_key


def encrypt_api_key(raw: str) -> str:
    """Simple XOR obfuscation for storing API keys in SQLite (NOT production-grade encryption).
    For desktop app, this is acceptable; OS keychain is preferred but adds complexity.
    2026 Decision: Use OS keychain (keyring) in Phase 2; Phase 1 uses simple obfuscation.
    """
    import base64
    key = b"writer" * 8
    obf = bytes(a ^ b for a, b in zip(raw.encode(), key))
    return base64.b64encode(obf).decode()


def decrypt_api_key(obfuscated: str) -> str:
    import base64
    key = b"writer" * 8
    obf = base64.b64decode(obfuscated.encode())
    raw = bytes(a ^ b for a, b in zip(obf, key))
    return raw.decode()

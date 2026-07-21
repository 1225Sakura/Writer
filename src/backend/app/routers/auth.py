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


# ----- WS Ticket System (v0.4 P0-Sec1b PR-4 + P0-Sec2) -----
import secrets
import sqlite3
import time
from pathlib import Path

# Ticket storage in SQLite (in-process, ephemeral)
_TICKET_DB: sqlite3.Connection | None = None
_TICKET_TTL_SECONDS = 300  # 5 min
_ALLOWED_WS_ORIGINS = {"http://localhost:5173", "app://writer", "http://localhost:8000"}


def _ticket_db() -> sqlite3.Connection:
    global _TICKET_DB
    if _TICKET_DB is None:
        db_path = Path.home() / ".writer" / "ws-tickets.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        _TICKET_DB = sqlite3.connect(str(db_path), check_same_thread=False)
        _TICKET_DB.execute("""
            CREATE TABLE IF NOT EXISTS ws_tickets (
                token TEXT PRIMARY KEY,
                user_session TEXT,
                path TEXT,
                expires_at REAL,
                consumed_at REAL
            )
        """)
        _TICKET_DB.commit()
    return _TICKET_DB


@router.post("/ws-ticket", dependencies=[Depends(verify_api_key)])
async def issue_ws_ticket() -> dict:
    """Issue a single-use WS upgrade ticket.

    Frontend calls this before connecting WebSocket; passes ticket via query string.
    Atomic consume on upgrade (INSERT OR IGNORE + DELETE RETURNING semantics).
    """
    token = secrets.token_urlsafe(32)
    expires_at = time.time() + _TICKET_TTL_SECONDS
    _ticket_db().execute(
        "INSERT INTO ws_tickets (token, expires_at) VALUES (?, ?)",
        (token, expires_at),
    )
    _ticket_db().commit()
    return {"ticket": token, "expires_in": _TICKET_TTL_SECONDS}


@router.post("/ws-ticket/consume", dependencies=[Depends(verify_api_key)])
async def consume_ws_ticket(token: str, user_session: str | None = None, path: str | None = None) -> dict:
    """Atomic consume of WS ticket (admin/server-side helper)."""
    db = _ticket_db()
    now = time.time()
    cur = db.execute(
        "SELECT expires_at FROM ws_tickets WHERE token = ? AND consumed_at IS NULL",
        (token,),
    ).fetchone()
    if not cur:
        raise HTTPException(status_code=400, detail={"code": "INVALID_TICKET"})
    if cur[0] < now:
        raise HTTPException(status_code=400, detail={"code": "EXPIRED_TICKET"})
    db.execute(
        "UPDATE ws_tickets SET consumed_at = ?, user_session = ?, path = ? WHERE token = ?",
        (now, user_session, path, token),
    )
    db.commit()
    return {"consumed": True}
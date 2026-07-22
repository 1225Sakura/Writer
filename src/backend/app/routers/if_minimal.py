"""IF-Line minimal vertical-slice endpoint (v0.5 patch Phase 0a.5).

Frozen contract: docs/architecture/if-api-schema-v1.md

Exposes ONE endpoint that exercises the full IF-Line fork flow against
the real database (no mocks):

    POST /api/v1/if-lines/{if_line_id}/fork

This is intentionally minimal: it does not modify existing routers. It
adds to the api_router in app/routers/__init__.py so the OpenAPI schema
is updated and the e2e suite can drive it.
"""
from __future__ import annotations

import logging
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.security import verify_api_key
from app.database import get_db
from app.models import Chapter, IFLine, Outline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/if-lines", tags=["if_minimal"])

# ----------------------------------------------------------------------
# In-process idempotency cache (24h TTL). Sufficient for the vertical
# slice; production should back this with SQLite/Redis.
# ----------------------------------------------------------------------
_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60
_idempotency_cache: dict[str, tuple[float, dict, str]] = {}
# value: (expires_at_epoch_seconds, response_body_dict, request_payload_signature)


def _idempotency_signature(payload: dict) -> str:
    """Stable signature of payload for idempotency conflict detection."""
    import hashlib
    import json

    canon = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def _idempotency_check(key: str, signature: str) -> Optional[dict]:
    """Return cached response if key matches; raise 409 if signature differs."""
    import time

    entry = _idempotency_cache.get(key)
    if entry is None:
        return None
    expires_at, body, sig = entry
    if expires_at < time.time():
        _idempotency_cache.pop(key, None)
        return None
    if sig != signature:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "error": {
                    "code": "CONFLICT",
                    "message": "Idempotency-Key already used with a different payload",
                },
            },
        )
    return body


def _idempotency_store(key: str, signature: str, body: dict) -> None:
    import time

    _idempotency_cache[key] = (
        time.time() + _IDEMPOTENCY_TTL_SECONDS,
        body,
        signature,
    )


# ----------------------------------------------------------------------
# Request / response schemas
# ----------------------------------------------------------------------


class ForkRequest(BaseModel):
    """POST /api/v1/if-lines/{if_line_id}/fork body."""

    if_line_id: str = Field(..., min_length=1, max_length=128)
    source_chapter_id: Optional[str] = Field(default=None, max_length=128)
    label: Optional[str] = Field(default=None, max_length=120)

    @field_validator("if_line_id", "source_chapter_id")
    @classmethod
    def _no_path_traversal(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if re.search(r"[\\/]|\\.\\.", v):
            raise ValueError("id contains illegal characters")
        return v


class ForkConflict(BaseModel):
    chapter_id: str
    type: str
    message: str


class ForkResponseData(BaseModel):
    forked_if_line_id: str
    forked_chapter_id: str
    conflicts: list[ForkConflict] = Field(default_factory=list)


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def _to_str_id(value) -> str:
    """Render an int/PK as the canonical string id used in the contract."""
    return str(value) if value is not None else ""


def _resolve_if_line_id(raw: str) -> int:
    """Accept either a numeric PK or a UUID-shaped string.

    For UUIDs we look the IFLine up by its stringified int PK. The
    schema is intentionally permissive on the wire; backend anchors on
    the IFLine.id integer PK.
    """
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "if_line_id must be an integer id",
                },
            },
        )


# ----------------------------------------------------------------------
# Endpoint
# ----------------------------------------------------------------------


@router.post("/{if_line_id}/fork", response_model=None)
def fork_if_line(
    if_line_id: str,
    payload: ForkRequest,
    req: Request,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    x_request_id: Optional[str] = Header(default=None, alias="X-Request-ID"),
):
    """Fork an IF-Line into a new divergent branch (atomic)."""
    correlation_id = x_request_id or req.headers.get("X-Request-ID") or str(uuid.uuid4())

    # ---- Idempotency replay ----
    if idempotency_key is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Idempotency-Key header is required",
                },
            },
            headers={"X-Request-ID": correlation_id},
        )

    signature = _idempotency_signature(payload.model_dump())
    cached = _idempotency_check(idempotency_key, signature)
    if cached is not None:
        cached.setdefault("headers", {})["X-Request-ID"] = correlation_id
        return cached

    # ---- Validate path/body coherence ----
    path_pk = _resolve_if_line_id(if_line_id)
    if str(path_pk) != str(payload.if_line_id):
        # Try forgiving comparison (payload may be UUID-shaped in v1; we
        # currently only support int PKs, so this is a hard mismatch).
        try:
            payload_pk = int(payload.if_line_id)
        except (TypeError, ValueError):
            payload_pk = -1
        if payload_pk != path_pk:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "success": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "payload.if_line_id does not match path parameter",
                    },
                },
                headers={"X-Request-ID": correlation_id},
            )

    # ---- Look up source IFLine ----
    source_line: Optional[IFLine] = db.get(IFLine, path_pk)
    if source_line is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": {"code": "NOT_FOUND", "message": f"IFLine not found: {path_pk}"},
            },
            headers={"X-Request-ID": correlation_id},
        )

    source_chapter: Optional[Chapter] = None
    if payload.source_chapter_id is not None:
        try:
            src_pk = int(payload.source_chapter_id)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "success": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "source_chapter_id must be an integer id",
                    },
                },
                headers={"X-Request-ID": correlation_id},
            )
        source_chapter = db.get(Chapter, src_pk)
        if source_chapter is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error": {
                        "code": "NOT_FOUND",
                        "message": f"Chapter not found: {src_pk}",
                    },
                },
                headers={"X-Request-ID": correlation_id},
            )

    # ---- Atomic fork ----
    try:
        new_if_line = IFLine(
            project_id=source_line.project_id,
            name=(payload.label or f"Fork of IFLine {source_line.id}").strip()[:255],
            parent_line_id=source_line.id,
            fork_chapter_id=source_chapter.id if source_chapter is not None else source_line.fork_chapter_id,
            content=dict(source_line.content or {}),
        )
        db.add(new_if_line)
        db.flush()  # populate new_if_line.id

        target_outline_id: Optional[int] = None
        if source_chapter is not None and source_chapter.outline_id is not None:
            target_outline_id = source_chapter.outline_id
        elif source_line.fork_chapter_id is not None:
            fork_ch = db.get(Chapter, source_line.fork_chapter_id)
            if fork_ch is not None:
                target_outline_id = fork_ch.outline_id

        if target_outline_id is None:
            # Last resort: synthesize an outline for the new IFLine.
            new_outline = Outline(
                project_id=source_line.project_id,
                title=f"IF线 #{new_if_line.id} 分叉",
            )
            db.add(new_outline)
            db.flush()
            target_outline_id = new_outline.id

        if source_chapter is not None:
            new_chapter = Chapter(
                project_id=source_chapter.project_id,
                outline_id=target_outline_id,
                title=(payload.label or source_chapter.title or "未命名章节")[:255],
                summary=source_chapter.summary,
                status=source_chapter.status,
                word_count=source_chapter.word_count,
                chapter_order=source_chapter.chapter_order,
                content=source_chapter.content,
                notes=source_chapter.notes,
                note_category=source_chapter.note_category,
                note_pinned=source_chapter.note_pinned,
                sections=source_chapter.sections,
                pacing_notes=source_chapter.pacing_notes,
                character_dynamics=source_chapter.character_dynamics,
                foreshadowing=source_chapter.foreshadowing,
            )
            db.add(new_chapter)
            db.flush()
            forked_chapter_id = new_chapter.id
        else:
            # No source chapter: synthesize a placeholder chapter for the
            # new branch so the UI has something to render.
            new_chapter = Chapter(
                project_id=source_line.project_id,
                outline_id=target_outline_id,
                title=(payload.label or "未命名章节")[:255],
                status="planning",
                word_count=0,
                chapter_order=0,
            )
            db.add(new_chapter)
            db.flush()
            forked_chapter_id = new_chapter.id

        db.commit()
        db.refresh(new_if_line)
        db.refresh(new_chapter)
    except Exception:
        db.rollback()
        logger.exception("Fork failed [correlation_id=%s]", correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Internal server error (see server logs with correlation_id)",
                    "correlation_id": correlation_id,
                },
            },
            headers={"X-Request-ID": correlation_id},
        )

    response_body = {
        "success": True,
        "data": {
            "forked_if_line_id": _to_str_id(new_if_line.id),
            "forked_chapter_id": _to_str_id(forked_chapter_id),
            "conflicts": [],
        },
    }

    _idempotency_store(idempotency_key, signature, response_body)

    return response_body
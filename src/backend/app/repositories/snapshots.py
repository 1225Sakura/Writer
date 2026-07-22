"""SnapshotsRepository — typed SQLAlchemy access for snapshots."""
from __future__ import annotations

import hashlib
from typing import Optional

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models import Snapshot, SnapshotTag


def _fingerprint(content: str) -> str:
    """SHA256 of content (content-addressed)."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


class SnapshotsRepository:
    """Typed SQLAlchemy access to snapshots + tags."""

    def __init__(self, db: Session):
        self._db = db

    # ----- CRUD -----

    def get(self, snapshot_id: int) -> Optional[Snapshot]:
        stmt = select(Snapshot).where(Snapshot.id == snapshot_id)
        return self._db.execute(stmt).scalars().first()

    def list(
        self,
        chapter_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Snapshot]:
        stmt = select(Snapshot).order_by(Snapshot.created_at.desc()).offset(skip).limit(limit)
        if chapter_id is not None:
            stmt = stmt.where(Snapshot.chapter_id == chapter_id)
        return list(self._db.execute(stmt).scalars().all())

    def count(self, chapter_id: Optional[int] = None) -> int:
        stmt = select(func.count(Snapshot.id))
        if chapter_id is not None:
            stmt = stmt.where(Snapshot.chapter_id == chapter_id)
        return int(self._db.execute(stmt).scalar_one())

    def create(
        self,
        chapter_id: int,
        content: str,
        *,
        label: Optional[str] = None,
        parent_snapshot_id: Optional[int] = None,
        meta: Optional[dict] = None,
    ) -> Snapshot:
        s = Snapshot(
            user_id="default-user",
            chapter_id=chapter_id,
            content=content,
            label=label,
            parent_snapshot_id=parent_snapshot_id,
            word_count=len(content.split()) if content else 0,
            fingerprint=_fingerprint(content),
            meta=meta,
        )
        self._db.add(s)
        self._db.commit()
        self._db.refresh(s)
        return s

    def update_label(self, snapshot_id: int, label: str) -> Optional[Snapshot]:
        s = self.get(snapshot_id)
        if not s:
            return None
        s.label = label
        self._db.commit()
        self._db.refresh(s)
        return s

    def delete(self, snapshot_id: int) -> bool:
        s = self.get(snapshot_id)
        if not s:
            return False
        self._db.delete(s)
        self._db.commit()
        return True

    def batch_delete(self, snapshot_ids: list[int]) -> int:
        """Delete multiple snapshots by id. Returns count deleted."""
        stmt = delete(Snapshot).where(Snapshot.id.in_(snapshot_ids))
        result = self._db.execute(stmt)
        self._db.commit()
        return result.rowcount or 0

    # ----- Search -----

    def search(
        self,
        q: str,
        chapter_id: Optional[int] = None,
        limit: int = 100,
    ) -> list[Snapshot]:
        """LIKE search on label + content."""
        pattern = f"%{q}%"
        stmt = select(Snapshot).where(
            or_(Snapshot.label.ilike(pattern), Snapshot.content.ilike(pattern))
        )
        if chapter_id is not None:
            stmt = stmt.where(Snapshot.chapter_id == chapter_id)
        stmt = stmt.order_by(Snapshot.created_at.desc()).limit(limit)
        return list(self._db.execute(stmt).scalars().all())

    # ----- Tags -----

    def add_tag(self, snapshot_id: int, tag: str) -> Optional[SnapshotTag]:
        existing = self._db.execute(
            select(SnapshotTag).where(
                SnapshotTag.snapshot_id == snapshot_id, SnapshotTag.tag == tag
            )
        ).scalars().first()
        if existing:
            return existing
        t = SnapshotTag(snapshot_id=snapshot_id, tag=tag)
        self._db.add(t)
        self._db.commit()
        self._db.refresh(t)
        return t

    def remove_tag(self, snapshot_id: int, tag: str) -> bool:
        stmt = delete(SnapshotTag).where(
            SnapshotTag.snapshot_id == snapshot_id, SnapshotTag.tag == tag
        )
        result = self._db.execute(stmt)
        self._db.commit()
        return (result.rowcount or 0) > 0

    # ----- Fork / Revert -----

    def fork(
        self,
        source_id: int,
        *,
        label: Optional[str] = None,
        target_chapter_id: Optional[int] = None,
    ) -> Optional[Snapshot]:
        """Create a new snapshot that copies content from source_id.

        The new snapshot has a new id; parent_snapshot_id points back to source.
        """
        source = self.get(source_id)
        if not source:
            return None
        return self.create(
            chapter_id=target_chapter_id or source.chapter_id,
            content=source.content,
            label=label or f"Fork of #{source_id}",
            parent_snapshot_id=source_id,
            meta={"forked_from": source_id},
        )

    def revert_chapter(
        self, snapshot_id: int, db_session: Session
    ) -> Optional[dict]:
        """Apply snapshot's content back to chapter.content. Returns revert summary.

        Caller passes `db_session` (same as self._db) so we can also update Chapter.
        """
        from app.models import Chapter
        s = self.get(snapshot_id)
        if not s:
            return None
        chap = db_session.query(Chapter).filter(Chapter.id == s.chapter_id).first()
        if not chap:
            return None
        old_content = chap.content
        chap.content = s.content
        db_session.commit()
        return {
            "chapter_id": s.chapter_id,
            "snapshot_id": snapshot_id,
            "old_word_count": len(old_content.split()) if old_content else 0,
            "new_word_count": s.word_count,
        }

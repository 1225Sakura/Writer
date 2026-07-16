"""Draft repository: typed data access + TOCTOU-safe version increment.

The `create_next_version` helper runs as a single SQL statement so the
read of `MAX(version_number)` and the `INSERT` cannot interleave with
another writer's INSERT on the same `chapter_id` under SQLite's
single-writer / statement-level atomicity.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Draft


class DraftRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, chapter_id: int, version_number: int) -> Optional[Draft]:
        return (
            self._db.query(Draft)
            .filter(Draft.chapter_id == chapter_id, Draft.version_number == version_number)
            .first()
        )

    def get_latest(self, chapter_id: int) -> Optional[Draft]:
        return (
            self._db.query(Draft)
            .filter(Draft.chapter_id == chapter_id)
            .order_by(Draft.version_number.desc())
            .first()
        )

    def list(
        self,
        chapter_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Draft]:
        return (
            self._db.query(Draft)
            .filter(Draft.chapter_id == chapter_id)
            .order_by(Draft.version_number.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create_next_version(self, chapter_id: int, content: str) -> Draft:
        """Race-free single-statement version increment.

        Uses INSERT...SELECT...COALESCE(MAX,0)+1 so the new version
        number is computed and inserted atomically. Returns the
        freshly inserted Draft row.

        NOTE: `updated_at` is included alongside `created_at` because
        the Draft model inherits TimestampMixin (NOT NULL on both) and
        SQLAlchemy ORM defaults do not fire through raw `text()`.
        """
        result = self._db.execute(
            text(
                """
                INSERT INTO drafts (chapter_id, version_number, content, created_at, updated_at)
                SELECT :cid,
                       COALESCE(MAX(version_number), 0) + 1,
                       :content,
                       :ts,
                       :ts
                FROM drafts
                WHERE chapter_id = :cid
                RETURNING id
                """
            ),
            {"cid": chapter_id, "content": content, "ts": datetime.utcnow()},
        )
        new_id = result.scalar_one()
        self._db.commit()
        return self._db.get(Draft, new_id)

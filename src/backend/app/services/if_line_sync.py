"""IFLineSyncService (US-017): syncs a base chapter into one or more IFLines
with conflict detection.

Behavior:
  1. Validate the source IFLine (URL path id) and base chapter exist (404).
  2. For each target IFLine id:
       - Find the target's matching chapter by chapter_order (target's outline is
         the IFLine's fork_chapter outline, if any).
       - If target chapter missing: record a "missing_chapter" conflict and skip.
       - If content already matches: no-op (idempotent).
       - If target chapter was modified after fork AND base was also modified
         after fork: "both_modified" conflict.
       - If only target chapter was modified after fork: "content_mismatch".
       - Otherwise (only base changed, or neither): copy base content to target
         and append to synced.
  3. Return {"synced": [...], "conflicts": [...]}.

Conflict timestamps: use IFLine.created_at as the divergence moment. We
fall back to IFLine.fork_chapter.created_at when the IFLine row has no
created_at (shouldn't happen, but defensive).
"""
from __future__ import annotations

from app.core.exceptions import NotFoundException
from app.models import IFLine


class IFLineSyncService:
    def __init__(
        self,
        db,
        if_line_repo,
        chapter_repo,
        outline_repo,
    ):
        self._db = db
        self._if_lines = if_line_repo
        self._chapters = chapter_repo
        self._outlines = outline_repo

    def sync(
        self,
        if_line_id: int,
        base_chapter_id: int,
        target_line_ids: list[int],
    ) -> dict:
        source_line = self._if_lines.get(if_line_id)
        if not source_line:
            raise NotFoundException("IFLine", if_line_id)

        base_chapter = self._chapters.get(base_chapter_id)
        if not base_chapter:
            raise NotFoundException("Chapter", base_chapter_id)

        synced: list[dict] = []
        conflicts: list[dict] = []

        for target_line_id in target_line_ids:
            target_line = self._if_lines.get(target_line_id)
            if target_line is None:
                raise NotFoundException("IFLine", target_line_id)

            fork_ts = self._resolve_fork_timestamp(target_line)
            target_chapter = self._find_target_chapter(target_line, base_chapter)

            if target_chapter is None:
                conflicts.append(
                    {
                        "chapterId": base_chapter_id,
                        "type": "missing_chapter",
                        "message": (
                            f"Target IFLine {target_line_id} has no chapter at "
                            f"order {base_chapter.chapter_order}"
                        ),
                    }
                )
                continue

            base_content = base_chapter.content or ""
            target_content = target_chapter.content or ""
            if base_content == target_content:
                # Already synced — skip (idempotent, no DB write).
                continue

            target_modified_after = target_chapter.updated_at > fork_ts
            base_modified_after = base_chapter.updated_at > fork_ts

            if target_modified_after and base_modified_after:
                conflicts.append(
                    {
                        "chapterId": target_chapter.id,
                        "type": "both_modified",
                        "message": (
                            f"Chapter {target_chapter.id} modified in both base "
                            f"and target after fork"
                        ),
                    }
                )
            elif target_modified_after:
                conflicts.append(
                    {
                        "chapterId": target_chapter.id,
                        "type": "content_mismatch",
                        "message": (
                            f"Target chapter {target_chapter.id} modified after "
                            f"fork; base change cannot be applied automatically"
                        ),
                    }
                )
            else:
                target_chapter.content = base_chapter.content
                self._db.commit()
                self._db.refresh(target_chapter)
                synced.append(
                    {
                        "chapterId": target_chapter.id,
                        "newRevision": target_chapter.updated_at.isoformat(),
                    }
                )

        return {"synced": synced, "conflicts": conflicts}

    def _resolve_fork_timestamp(self, if_line: IFLine):
        """The fork divergence timestamp for an IFLine.

        Anchor on the IFLine's own created_at (when this branch diverged).
        Falls back to IFLine.fork_chapter.created_at when the IFLine row
        carries no created_at, then to the unix epoch as last resort.
        """
        if if_line.created_at is not None:
            return if_line.created_at
        if if_line.fork_chapter_id is not None:
            fork_ch = self._chapters.get(if_line.fork_chapter_id)
            if fork_ch is not None and fork_ch.created_at is not None:
                return fork_ch.created_at
        from datetime import datetime
        return datetime(1970, 1, 1)

    def _find_target_chapter(self, target_line: IFLine, base_chapter):
        """Locate target_line's chapter that corresponds to base_chapter.

        Match strategy: chapter_order equality within the IFLine's outline.
        The outline is inferred from IFLine.fork_chapter.outline_id; when the
        IFLine has no fork_chapter, there is nothing to sync into.
        """
        if target_line.fork_chapter_id is None:
            return None
        fork_ch = self._chapters.get(target_line.fork_chapter_id)
        if fork_ch is None or fork_ch.outline_id is None:
            return None
        candidates = self._chapters.list(
            outline_id=fork_ch.outline_id,
            limit=1000,
        )
        for ch in candidates:
            if ch.chapter_order == base_chapter.chapter_order:
                return ch
        return None

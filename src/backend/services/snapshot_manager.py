"""Project snapshot manager — creates full project snapshots from database."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import async_session_maker
from backend.core.domain import (
    Character,
    CharacterRelationship,
    CharacterStoryline,
    Item,
    Location,
    Faction,
    WorldSetting,
    Rule,
    Outline,
    Chapter,
    IFLine,
    ChatSession,
    ChatMessage,
    ExtractedEntity,
    DraftVersion,
    PlotThread,
    AIInspectionResult,
    WritingSettings,
    Project,
    GenreConfiguration,
    WorkflowExecution,
    AgentExecutionLog,
)
from backend.services.content_storage import content_storage

SNAPSHOT_VERSION = "1.0"


def _model_to_dict(model: Any) -> dict | None:
    """Convert SQLAlchemy model instance to plain dict."""
    if model is None:
        return None
    result: dict[str, Any] = {}
    for key, value in model.__dict__.items():
        if key.startswith("_"):
            continue
        if isinstance(value, datetime):
            result[key] = value.isoformat()
        else:
            result[key] = value
    return result


class SnapshotManager:
    """Manages project snapshots stored as JSON files on disk."""

    def __init__(self, snapshot_dir: str | Path | None = None) -> None:
        self.snapshot_dir = Path(snapshot_dir) if snapshot_dir else Path("data/snapshots")
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)

    def _snapshot_path(self, snapshot_id: str) -> Path:
        return self.snapshot_dir / f"{snapshot_id}.json"

    def _list_snapshot_files(self) -> list[Path]:
        return sorted(self.snapshot_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)

    async def _fetch_all_data(self, session: AsyncSession) -> dict[str, Any]:
        """Fetch all project data from the database."""
        data: dict[str, Any] = {}

        # Project & Genre
        projects = (await session.execute(select(Project))).scalars().all()
        data["projects"] = [_model_to_dict(p) for p in projects]

        genres = (await session.execute(select(GenreConfiguration))).scalars().all()
        data["genre_configurations"] = [_model_to_dict(g) for g in genres]

        # Characters
        characters = (await session.execute(select(Character))).scalars().all()
        data["characters"] = [_model_to_dict(c) for c in characters]

        relationships = (await session.execute(select(CharacterRelationship))).scalars().all()
        data["character_relationships"] = [_model_to_dict(r) for r in relationships]

        storylines = (await session.execute(select(CharacterStoryline))).scalars().all()
        data["character_storylines"] = [_model_to_dict(s) for s in storylines]

        # World entities
        items = (await session.execute(select(Item))).scalars().all()
        data["items"] = [_model_to_dict(i) for i in items]

        locations = (await session.execute(select(Location))).scalars().all()
        data["locations"] = [_model_to_dict(l) for l in locations]

        factions = (await session.execute(select(Faction))).scalars().all()
        data["factions"] = [_model_to_dict(f) for f in factions]

        world_settings = (await session.execute(select(WorldSetting))).scalars().all()
        data["world_settings"] = [_model_to_dict(w) for w in world_settings]

        rules = (await session.execute(select(Rule))).scalars().all()
        data["rules"] = [_model_to_dict(r) for r in rules]

        # Story structure
        outlines = (await session.execute(select(Outline))).scalars().all()
        data["outlines"] = [_model_to_dict(o) for o in outlines]

        chapters = (await session.execute(select(Chapter))).scalars().all()
        data["chapters"] = [_model_to_dict(c) for c in chapters]

        if_lines = (await session.execute(select(IFLine))).scalars().all()
        data["if_lines"] = [_model_to_dict(i) for i in if_lines]

        # Chat
        chat_sessions = (await session.execute(select(ChatSession))).scalars().all()
        data["chat_sessions"] = [_model_to_dict(s) for s in chat_sessions]

        messages = (await session.execute(select(ChatMessage))).scalars().all()
        data["chat_messages"] = [_model_to_dict(m) for m in messages]

        extracted = (await session.execute(select(ExtractedEntity))).scalars().all()
        data["extracted_entities"] = [_model_to_dict(e) for e in extracted]

        # Writing
        drafts = (await session.execute(select(DraftVersion))).scalars().all()
        data["draft_versions"] = [_model_to_dict(d) for d in drafts]

        plot_threads = (await session.execute(select(PlotThread))).scalars().all()
        data["plot_threads"] = [_model_to_dict(p) for p in plot_threads]

        inspections = (await session.execute(select(AIInspectionResult))).scalars().all()
        data["ai_inspection_results"] = [_model_to_dict(i) for i in inspections]

        writing_settings = (await session.execute(select(WritingSettings))).scalars().all()
        data["writing_settings"] = [_model_to_dict(w) for w in writing_settings]

        # Workflows
        workflows = (await session.execute(select(WorkflowExecution))).scalars().all()
        data["workflow_executions"] = [_model_to_dict(w) for w in workflows]

        agent_logs = (await session.execute(select(AgentExecutionLog))).scalars().all()
        data["agent_execution_logs"] = [_model_to_dict(a) for a in agent_logs]

        # Content storage references (resolve content_storage_id -> actual content)
        content_data: dict[str, str | None] = {}
        for chapter in chapters:
            cid = chapter.content_storage_id
            if cid:
                content_data[cid] = await content_storage.retrieve(cid)
        for draft in drafts:
            cid = draft.content_storage_id
            if cid:
                content_data[cid] = await content_storage.retrieve(cid)
        data["content_storage"] = content_data

        return data

    async def create_snapshot(
        self,
        name: str | None = None,
        description: str | None = None,
        triggered_by: str = "manual",
    ) -> dict[str, Any]:
        """Create a full project snapshot and save to disk."""
        snapshot_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")[:-3]

        async with async_session_maker() as session:
            payload = await self._fetch_all_data(session)

        snapshot: dict[str, Any] = {
            "version": SNAPSHOT_VERSION,
            "snapshot_id": snapshot_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "name": name or f"Snapshot {snapshot_id}",
            "description": description,
            "triggered_by": triggered_by,
            "payload": payload,
        }

        path = self._snapshot_path(snapshot_id)
        path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

        return {
            "snapshot_id": snapshot_id,
            "name": snapshot["name"],
            "created_at": snapshot["created_at"],
            "path": str(path),
            "size_bytes": path.stat().st_size,
        }

    async def restore_snapshot(self, snapshot_id: str) -> dict[str, Any]:
        """Restore database from a snapshot file."""
        path = self._snapshot_path(snapshot_id)
        if not path.exists():
            raise FileNotFoundError(f"Snapshot not found: {snapshot_id}")

        snapshot = json.loads(path.read_text(encoding="utf-8"))
        version = snapshot.get("version")
        if version != SNAPSHOT_VERSION:
            raise ValueError(f"Snapshot version mismatch: expected {SNAPSHOT_VERSION}, got {version}")

        payload = snapshot["payload"]

        async with async_session_maker() as session:
            # Clear existing data (truncate all tables)
            for table in reversed([
                AgentExecutionLog, WorkflowExecution,
                AIInspectionResult, PlotThread, DraftVersion,
                ExtractedEntity, ChatMessage, ChatSession,
                IFLine, Chapter, Outline,
                CharacterStoryline, CharacterRelationship, Character,
                Rule, WorldSetting, Faction, Location, Item,
                WritingSettings, GenreConfiguration, Project,
            ]):
                await session.execute(table.__table__.delete())
            await session.flush()

            # Helper to insert rows
            def insert_rows(model_cls, rows):
                for row in rows:
                    clean = {k: v for k, v in row.items() if not k.startswith("_") and k != "id"}
                    # Convert iso datetime strings back to datetime
                    for k, v in list(clean.items()):
                        if isinstance(v, str) and "T" in v and v.endswith("Z"):
                            try:
                                clean[k] = datetime.fromisoformat(v.replace("Z", "+00:00"))
                            except ValueError:
                                pass
                        elif isinstance(v, str) and "T" in v and len(v) >= 19:
                            try:
                                clean[k] = datetime.fromisoformat(v)
                            except ValueError:
                                pass
                    session.add(model_cls(**clean))

            # Insert in dependency order
            insert_rows(Project, payload.get("projects", []))
            await session.flush()
            insert_rows(GenreConfiguration, payload.get("genre_configurations", []))
            await session.flush()
            insert_rows(Character, payload.get("characters", []))
            await session.flush()
            insert_rows(CharacterRelationship, payload.get("character_relationships", []))
            await session.flush()
            insert_rows(CharacterStoryline, payload.get("character_storylines", []))
            await session.flush()
            insert_rows(Item, payload.get("items", []))
            await session.flush()
            insert_rows(Location, payload.get("locations", []))
            await session.flush()
            insert_rows(Faction, payload.get("factions", []))
            await session.flush()
            insert_rows(WorldSetting, payload.get("world_settings", []))
            await session.flush()
            insert_rows(Rule, payload.get("rules", []))
            await session.flush()
            insert_rows(Outline, payload.get("outlines", []))
            await session.flush()
            insert_rows(Chapter, payload.get("chapters", []))
            await session.flush()
            insert_rows(IFLine, payload.get("if_lines", []))
            await session.flush()
            insert_rows(ChatSession, payload.get("chat_sessions", []))
            await session.flush()
            insert_rows(ChatMessage, payload.get("chat_messages", []))
            await session.flush()
            insert_rows(ExtractedEntity, payload.get("extracted_entities", []))
            await session.flush()
            insert_rows(DraftVersion, payload.get("draft_versions", []))
            await session.flush()
            insert_rows(PlotThread, payload.get("plot_threads", []))
            await session.flush()
            insert_rows(AIInspectionResult, payload.get("ai_inspection_results", []))
            await session.flush()
            insert_rows(WritingSettings, payload.get("writing_settings", []))
            await session.flush()
            insert_rows(WorkflowExecution, payload.get("workflow_executions", []))
            await session.flush()
            insert_rows(AgentExecutionLog, payload.get("agent_execution_logs", []))
            await session.flush()

            # Restore content storage
            content_storage_data = payload.get("content_storage", {})
            for content_id, content in content_storage_data.items():
                if content is not None:
                    await content_storage.store(content, content_id=content_id)

            await session.commit()

        return {
            "snapshot_id": snapshot_id,
            "restored_at": datetime.now(timezone.utc).isoformat(),
            "entities_restored": sum(len(payload.get(k, [])) for k in payload if k != "content_storage"),
        }

    def list_snapshots(self) -> list[dict[str, Any]]:
        """List all available snapshots with metadata."""
        results = []
        for path in self._list_snapshot_files():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                results.append({
                    "snapshot_id": data.get("snapshot_id", path.stem),
                    "name": data.get("name", path.stem),
                    "description": data.get("description"),
                    "created_at": data.get("created_at"),
                    "triggered_by": data.get("triggered_by", "unknown"),
                    "size_bytes": path.stat().st_size,
                })
            except (json.JSONDecodeError, KeyError):
                continue
        return results

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        """Get full snapshot data by ID."""
        path = self._snapshot_path(snapshot_id)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def delete_snapshot(self, snapshot_id: str) -> bool:
        """Delete a snapshot file."""
        path = self._snapshot_path(snapshot_id)
        if path.exists():
            path.unlink()
            return True
        return False

    def cleanup_old_snapshots(self, keep_count: int = 20) -> int:
        """Remove oldest snapshots, keeping only the most recent N."""
        files = self._list_snapshot_files()
        removed = 0
        for path in files[keep_count:]:
            path.unlink()
            removed += 1
        return removed


# Global instance
snapshot_manager = SnapshotManager()

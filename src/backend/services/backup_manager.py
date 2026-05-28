"""Backup manager — scheduled, event-triggered, and manual backups."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Awaitable

from sqlalchemy.exc import SQLAlchemyError

from backend.services.snapshot_manager import SnapshotManager, snapshot_manager

logger = logging.getLogger(__name__)


class BackupTrigger(str, Enum):
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    EVENT = "event"
    SHUTDOWN = "shutdown"


@dataclass
class BackupSchedule:
    """Schedule configuration for automatic backups."""
    enabled: bool = True
    interval_minutes: int = 30
    max_snapshots: int = 20
    backup_on_shutdown: bool = True
    backup_on_chapter_save: bool = True
    backup_on_settings_change: bool = False


@dataclass
class BackupStatus:
    """Current backup system status."""
    last_backup_at: str | None = None
    last_backup_id: str | None = None
    last_backup_trigger: str | None = None
    next_scheduled_at: str | None = None
    total_backups: int = 0
    schedule: BackupSchedule = field(default_factory=BackupSchedule)
    is_running: bool = False


class BackupManager:
    """Manages automatic and manual backup strategies."""

    def __init__(
        self,
        snapshot_mgr: SnapshotManager | None = None,
        status_file: str | Path | None = None,
    ) -> None:
        self.snapshot_mgr = snapshot_mgr or snapshot_manager
        self.status_file = Path(status_file) if status_file else Path("data/backups/status.json")
        self.status_file.parent.mkdir(parents=True, exist_ok=True)
        self._status = BackupStatus()
        self._load_status()
        self._task: asyncio.Task | None = None
        self._event_handlers: list[Callable[[str, dict[str, Any]], Awaitable[None]]] = []

    def _load_status(self) -> None:
        if self.status_file.exists():
            try:
                data = json.loads(self.status_file.read_text(encoding="utf-8"))
                self._status = BackupStatus(
                    last_backup_at=data.get("last_backup_at"),
                    last_backup_id=data.get("last_backup_id"),
                    last_backup_trigger=data.get("last_backup_trigger"),
                    next_scheduled_at=data.get("next_scheduled_at"),
                    total_backups=data.get("total_backups", 0),
                    schedule=BackupSchedule(**data.get("schedule", {})),
                    is_running=data.get("is_running", False),
                )
            except (json.JSONDecodeError, TypeError):
                self._status = BackupStatus()

    def _save_status(self) -> None:
        self.status_file.write_text(
            json.dumps(
                {
                    "last_backup_at": self._status.last_backup_at,
                    "last_backup_id": self._status.last_backup_id,
                    "last_backup_trigger": self._status.last_backup_trigger,
                    "next_scheduled_at": self._status.next_scheduled_at,
                    "total_backups": self._status.total_backups,
                    "schedule": {
                        "enabled": self._status.schedule.enabled,
                        "interval_minutes": self._status.schedule.interval_minutes,
                        "max_snapshots": self._status.schedule.max_snapshots,
                        "backup_on_shutdown": self._status.schedule.backup_on_shutdown,
                        "backup_on_chapter_save": self._status.schedule.backup_on_chapter_save,
                        "backup_on_settings_change": self._status.schedule.backup_on_settings_change,
                    },
                    "is_running": self._status.is_running,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    async def backup(
        self,
        trigger: BackupTrigger = BackupTrigger.MANUAL,
        name: str | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Create a backup snapshot."""
        if self._status.is_running:
            return {"status": "skipped", "reason": "backup already in progress"}

        self._status.is_running = True
        try:
            result = await self.snapshot_mgr.create_snapshot(
                name=name or f"Backup ({trigger.value})",
                description=description,
                triggered_by=trigger.value,
            )

            self._status.last_backup_at = result["created_at"]
            self._status.last_backup_id = result["snapshot_id"]
            self._status.last_backup_trigger = trigger.value
            self._status.total_backups += 1

            # Cleanup old snapshots
            removed = self.snapshot_mgr.cleanup_old_snapshots(self._status.schedule.max_snapshots)
            if removed > 0:
                result["old_snapshots_removed"] = removed

            self._save_status()
            await self._notify_event("backup_completed", result)
            return result
        finally:
            self._status.is_running = False
            self._save_status()

    async def backup_on_event(self, event_type: str, event_data: dict[str, Any] | None = None) -> dict[str, Any] | None:
        """Trigger backup based on application events."""
        schedule = self._status.schedule

        if event_type == "chapter_save" and schedule.backup_on_chapter_save:
            chapter_id = (event_data or {}).get("chapter_id")
            return await self.backup(
                trigger=BackupTrigger.EVENT,
                name=f"Auto-backup on chapter save",
                description=f"Chapter ID: {chapter_id}" if chapter_id else None,
            )

        if event_type == "settings_change" and schedule.backup_on_settings_change:
            return await self.backup(
                trigger=BackupTrigger.EVENT,
                name="Auto-backup on settings change",
            )

        if event_type == "shutdown" and schedule.backup_on_shutdown:
            return await self.backup(
                trigger=BackupTrigger.SHUTDOWN,
                name="Auto-backup on shutdown",
            )

        return None

    def get_status(self) -> dict[str, Any]:
        """Get current backup status."""
        schedule = self._status.schedule
        next_scheduled = None
        if schedule.enabled and self._status.last_backup_at:
            last = datetime.fromisoformat(self._status.last_backup_at.replace("Z", "+00:00"))
            next_time = last + timedelta(minutes=schedule.interval_minutes)
            next_scheduled = next_time.isoformat()

        return {
            "last_backup_at": self._status.last_backup_at,
            "last_backup_id": self._status.last_backup_id,
            "last_backup_trigger": self._status.last_backup_trigger,
            "next_scheduled_at": next_scheduled,
            "total_backups": self._status.total_backups,
            "schedule": {
                "enabled": schedule.enabled,
                "interval_minutes": schedule.interval_minutes,
                "max_snapshots": schedule.max_snapshots,
                "backup_on_shutdown": schedule.backup_on_shutdown,
                "backup_on_chapter_save": schedule.backup_on_chapter_save,
                "backup_on_settings_change": schedule.backup_on_settings_change,
            },
            "is_running": self._status.is_running,
        }

    def update_schedule(self, schedule: BackupSchedule) -> dict[str, Any]:
        """Update backup schedule configuration."""
        self._status.schedule = schedule
        self._save_status()
        return self.get_status()

    async def start_scheduler(self) -> None:
        """Start the background scheduled backup loop."""
        if self._task is not None and not self._task.done():
            return
        self._task = asyncio.create_task(self._scheduler_loop())

    async def stop_scheduler(self) -> None:
        """Stop the background scheduler."""
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                logger.debug("Backup scheduler task cancelled")
            self._task = None

    async def _scheduler_loop(self) -> None:
        """Background loop for scheduled backups."""
        while True:
            try:
                schedule = self._status.schedule
                if schedule.enabled:
                    now = datetime.now(timezone.utc)
                    should_backup = False

                    if self._status.last_backup_at is None:
                        should_backup = True
                    else:
                        last = datetime.fromisoformat(self._status.last_backup_at.replace("Z", "+00:00"))
                        if now - last >= timedelta(minutes=schedule.interval_minutes):
                            should_backup = True

                    if should_backup:
                        await self.backup(trigger=BackupTrigger.SCHEDULED)

                await asyncio.sleep(60)  # Check every minute
            except asyncio.CancelledError:
                break
            except SQLAlchemyError as e:
                logger.warning("Backup scheduler error (will retry): %s", e)
                await asyncio.sleep(60)

    def on_event(self, handler: Callable[[str, dict[str, Any]], Awaitable[None]]) -> None:
        """Register an event handler for backup events."""
        self._event_handlers.append(handler)

    async def _notify_event(self, event_type: str, data: dict[str, Any]) -> None:
        """Notify all registered event handlers."""
        for handler in self._event_handlers:
            try:
                await handler(event_type, data)
            except SQLAlchemyError as e:
                logger.debug("Backup event handler error: %s", e)


# Global instance
backup_manager = BackupManager()

# Auto Novel Writer - Snapshot & Backup Routes
# Project snapshot, restore, backup scheduling, and archive endpoints

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Optional

from backend.middleware.auth import require_auth
from backend.services.snapshot_manager import snapshot_manager
from backend.services.backup_manager import backup_manager, BackupSchedule, BackupTrigger
from backend.services.archive_manager import archive_manager, ArchiveFormat

router = APIRouter(prefix="/snapshots", tags=["snapshots"], dependencies=[require_auth])


# ---------------------------------------------------------------------------
# Snapshot endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/create",
    summary="创建项目快照",
    description="创建当前项目的完整数据库快照，包含所有设定、章节、聊天记录等。",
)
async def create_snapshot(
    name: Optional[str] = None,
    description: Optional[str] = None,
):
    """Create a full project snapshot."""
    try:
        result = await snapshot_manager.create_snapshot(
            name=name,
            description=description,
            triggered_by="manual",
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create snapshot: {str(e)}")


@router.post(
    "/restore/{snapshot_id}",
    summary="恢复快照",
    description="从指定快照 ID 恢复项目数据，会覆盖当前所有数据。",
)
async def restore_snapshot(snapshot_id: str):
    """Restore project data from a snapshot."""
    try:
        result = await snapshot_manager.restore_snapshot(snapshot_id)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore snapshot: {str(e)}")


@router.get(
    "",
    summary="列出所有快照",
    description="获取所有可用快照的列表及其元数据。",
)
async def list_snapshots():
    """List all available snapshots."""
    return snapshot_manager.list_snapshots()


@router.get(
    "/{snapshot_id}",
    summary="获取快照详情",
    description="获取指定快照的完整数据。",
)
async def get_snapshot(snapshot_id: str):
    """Get full snapshot data by ID."""
    snapshot = snapshot_manager.get_snapshot(snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


@router.delete(
    "/{snapshot_id}",
    summary="删除快照",
    description="删除指定 ID 的快照文件。",
)
async def delete_snapshot(snapshot_id: str):
    """Delete a snapshot by ID."""
    deleted = snapshot_manager.delete_snapshot(snapshot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return {"message": "Snapshot deleted", "snapshot_id": snapshot_id}


# ---------------------------------------------------------------------------
# Backup endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/backups/trigger",
    summary="手动触发备份",
    description="立即创建一次备份快照。",
)
async def trigger_backup(
    name: Optional[str] = None,
    description: Optional[str] = None,
):
    """Manually trigger a backup."""
    try:
        result = await backup_manager.backup(
            trigger=BackupTrigger.MANUAL,
            name=name,
            description=description,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger backup: {str(e)}")


@router.get(
    "/backups/status",
    summary="获取备份状态",
    description="获取当前备份系统的状态，包括上次备份时间、下次计划备份时间、配置等。",
)
async def get_backup_status():
    """Get current backup system status."""
    return backup_manager.get_status()


@router.post(
    "/backups/schedule",
    summary="配置备份计划",
    description="更新自动备份的计划配置。",
)
async def update_backup_schedule(
    enabled: Optional[bool] = None,
    interval_minutes: Optional[int] = None,
    max_snapshots: Optional[int] = None,
    backup_on_shutdown: Optional[bool] = None,
    backup_on_chapter_save: Optional[bool] = None,
    backup_on_settings_change: Optional[bool] = None,
):
    """Update backup schedule configuration."""
    current = backup_manager.get_status()["schedule"]
    schedule = BackupSchedule(
        enabled=enabled if enabled is not None else current["enabled"],
        interval_minutes=interval_minutes if interval_minutes is not None else current["interval_minutes"],
        max_snapshots=max_snapshots if max_snapshots is not None else current["max_snapshots"],
        backup_on_shutdown=backup_on_shutdown if backup_on_shutdown is not None else current["backup_on_shutdown"],
        backup_on_chapter_save=backup_on_chapter_save if backup_on_chapter_save is not None else current["backup_on_chapter_save"],
        backup_on_settings_change=backup_on_settings_change if backup_on_settings_change is not None else current["backup_on_settings_change"],
    )
    return backup_manager.update_schedule(schedule)


@router.post(
    "/backups/start-scheduler",
    summary="启动备份调度器",
    description="启动后台定时备份调度器。",
)
async def start_backup_scheduler(background_tasks: BackgroundTasks):
    """Start the background backup scheduler."""
    background_tasks.add_task(backup_manager.start_scheduler)
    return {"status": "started", "message": "Backup scheduler started in background"}


@router.post(
    "/backups/stop-scheduler",
    summary="停止备份调度器",
    description="停止后台定时备份调度器。",
)
async def stop_backup_scheduler():
    """Stop the background backup scheduler."""
    await backup_manager.stop_scheduler()
    return {"status": "stopped", "message": "Backup scheduler stopped"}


# ---------------------------------------------------------------------------
# Archive / Export endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/archives/export",
    summary="导出项目归档",
    description="将项目导出为压缩归档文件（zip/tar.gz/tar.bz2）。",
)
async def export_project(
    snapshot_id: Optional[str] = None,
    format: ArchiveFormat = "zip",
    include_content_storage: bool = True,
):
    """Export project as a compressed archive."""
    try:
        result = await archive_manager.export_project(
            snapshot_id=snapshot_id,
            format=format,
            include_content_storage=include_content_storage,
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export project: {str(e)}")


@router.post(
    "/archives/import",
    summary="导入项目归档",
    description="从压缩归档文件导入项目数据。",
)
async def import_project(
    archive_path: str,
    overwrite: bool = False,
):
    """Import project from a compressed archive."""
    try:
        result = await archive_manager.import_project(
            archive_path=archive_path,
            overwrite=overwrite,
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import project: {str(e)}")


@router.get(
    "/archives/list",
    summary="列出所有归档",
    description="获取所有导出归档文件的列表。",
)
async def list_archives():
    """List all exported archives."""
    return archive_manager.list_archives()


@router.delete(
    "/archives/{filename}",
    summary="删除归档",
    description="删除指定的归档文件。",
)
async def delete_archive(filename: str):
    """Delete an archive file."""
    deleted = archive_manager.delete_archive(filename)
    if not deleted:
        raise HTTPException(status_code=404, detail="Archive not found")
    return {"message": "Archive deleted", "filename": filename}

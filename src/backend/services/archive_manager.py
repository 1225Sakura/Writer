"""Archive manager — compressed project export/import."""

from __future__ import annotations

import json
import shutil
import tarfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from backend.services.snapshot_manager import SnapshotManager, snapshot_manager

ArchiveFormat = Literal["zip", "tar.gz", "tar.bz2"]


class ArchiveManager:
    """Manages compressed project archives for export and import."""

    def __init__(
        self,
        snapshot_mgr: SnapshotManager | None = None,
        archive_dir: str | Path | None = None,
    ) -> None:
        self.snapshot_mgr = snapshot_mgr or snapshot_manager
        self.archive_dir = Path(archive_dir) if archive_dir else Path("data/archives")
        self.archive_dir.mkdir(parents=True, exist_ok=True)

    def _archive_path(self, filename: str) -> Path:
        return self.archive_dir / filename

    async def export_project(
        self,
        snapshot_id: str | None = None,
        format: ArchiveFormat = "zip",
        include_content_storage: bool = True,
    ) -> dict[str, Any]:
        """Export project as a compressed archive."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        if snapshot_id:
            snapshot = self.snapshot_mgr.get_snapshot(snapshot_id)
            if not snapshot:
                raise FileNotFoundError(f"Snapshot not found: {snapshot_id}")
        else:
            # Create a temporary snapshot
            result = await self.snapshot_mgr.create_snapshot(
                name=f"Export {timestamp}",
                triggered_by="export",
            )
            snapshot = self.snapshot_mgr.get_snapshot(result["snapshot_id"])
            if not snapshot:
                raise RuntimeError("Failed to create export snapshot")

        # Determine extension
        ext_map: dict[ArchiveFormat, str] = {"zip": ".zip", "tar.gz": ".tar.gz", "tar.bz2": ".tar.bz2"}
        ext = ext_map.get(format, ".zip")
        filename = f"project_export_{timestamp}{ext}"
        archive_path = self._archive_path(filename)

        # Write snapshot JSON to temp
        temp_json = self.archive_dir / f"_temp_{timestamp}.json"
        temp_json.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

        try:
            if format == "zip":
                with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as zf:
                    zf.write(temp_json, arcname="snapshot.json")
                    if include_content_storage:
                        content = snapshot.get("payload", {}).get("content_storage", {})
                        for cid, text in content.items():
                            if text is not None:
                                zf.writestr(f"content/{cid}.txt", text)
            elif format in ("tar.gz", "tar.bz2"):
                mode = "w:gz" if format == "tar.gz" else "w:bz2"
                with tarfile.open(archive_path, mode) as tf:
                    tf.add(temp_json, arcname="snapshot.json")
                    if include_content_storage:
                        content = snapshot.get("payload", {}).get("content_storage", {})
                        for cid, text in content.items():
                            if text is not None:
                                import io
                                data = text.encode("utf-8")
                                info = tarfile.TarInfo(name=f"content/{cid}.txt")
                                info.size = len(data)
                                tf.addfile(info, io.BytesIO(data))
            else:
                raise ValueError(f"Unsupported archive format: {format}")
        finally:
            if temp_json.exists():
                temp_json.unlink()

        return {
            "filename": filename,
            "path": str(archive_path),
            "format": format,
            "size_bytes": archive_path.stat().st_size,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "snapshot_id": snapshot.get("snapshot_id"),
        }

    async def import_project(
        self,
        archive_path: str | Path,
        overwrite: bool = False,
    ) -> dict[str, Any]:
        """Import project from a compressed archive."""
        archive_path = Path(archive_path)
        if not archive_path.exists():
            raise FileNotFoundError(f"Archive not found: {archive_path}")

        extract_dir = self.archive_dir / f"_import_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        extract_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Extract archive
            if zipfile.is_zipfile(archive_path):
                with zipfile.ZipFile(archive_path, "r") as zf:
                    zf.extractall(extract_dir)
            elif tarfile.is_tarfile(archive_path):
                with tarfile.open(archive_path, "r:*") as tf:
                    tf.extractall(extract_dir)
            else:
                raise ValueError("Unsupported archive file format")

            # Find snapshot.json
            snapshot_file = extract_dir / "snapshot.json"
            if not snapshot_file.exists():
                # Search recursively
                for path in extract_dir.rglob("snapshot.json"):
                    snapshot_file = path
                    break

            if not snapshot_file.exists():
                raise ValueError("Archive does not contain a valid snapshot.json")

            snapshot = json.loads(snapshot_file.read_text(encoding="utf-8"))
            snapshot_id = snapshot.get("snapshot_id", "imported")

            # Save snapshot to snapshot manager
            dest_path = self.snapshot_mgr._snapshot_path(snapshot_id)
            if dest_path.exists() and not overwrite:
                raise FileExistsError(f"Snapshot {snapshot_id} already exists. Use overwrite=True to replace.")

            dest_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

            # Restore from snapshot
            restore_result = await self.snapshot_mgr.restore_snapshot(snapshot_id)

            return {
                "snapshot_id": snapshot_id,
                "restored_at": datetime.now(timezone.utc).isoformat(),
                "entities_restored": restore_result.get("entities_restored", 0),
                "archive_path": str(archive_path),
            }
        finally:
            if extract_dir.exists():
                shutil.rmtree(extract_dir)

    def list_archives(self) -> list[dict[str, Any]]:
        """List all exported archives."""
        results = []
        for path in sorted(self.archive_dir.glob("project_export_*"), key=lambda p: p.stat().st_mtime, reverse=True):
            results.append({
                "filename": path.name,
                "path": str(path),
                "size_bytes": path.stat().st_size,
                "created_at": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
            })
        return results

    def delete_archive(self, filename: str) -> bool:
        """Delete an archive file."""
        path = self._archive_path(filename)
        if path.exists():
            path.unlink()
            return True
        return False

    def cleanup_old_archives(self, keep_count: int = 10) -> int:
        """Remove oldest archives, keeping only the most recent N."""
        files = sorted(self.archive_dir.glob("project_export_*"), key=lambda p: p.stat().st_mtime, reverse=True)
        removed = 0
        for path in files[keep_count:]:
            path.unlink()
            removed += 1
        return removed


# Global instance
archive_manager = ArchiveManager()

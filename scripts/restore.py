#!/usr/bin/env python3
"""
Database Restore Script
Restores database from backup file with integrity verification.
"""

import shutil
import os
import sys
from datetime import datetime
from pathlib import Path

# Project root
ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "writer.db"
BACKUP_DIR = DATA_DIR / "backups"


def verify_backup(backup_path: Path) -> bool:
    """Verify backup file integrity by checking SQLite header."""
    try:
        with open(backup_path, 'rb') as f:
            header = f.read(16)
            return header[:16] == b'SQLite format 3\x00'
    except Exception:
        return False


def restore_database(backup_file: str) -> bool:
    """Restore database from backup file."""
    # Resolve backup path
    if '/' in backup_file or '\\' in backup_file:
        backup_path = Path(backup_file)
    else:
        backup_path = BACKUP_DIR / backup_file

    # Check if backup exists
    if not backup_path.exists():
        print(f"[ERROR] Backup file not found: {backup_path}")
        return False

    # Verify backup integrity
    if not verify_backup(backup_path):
        print(f"[ERROR] Backup file is invalid or corrupted: {backup_path}")
        return False

    # Create data directory if needed
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Create backup of current database if it exists
    if DB_PATH.exists():
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        emergency_backup = DATA_DIR / f'writer_emergency_{timestamp}.db'
        shutil.copy2(DB_PATH, emergency_backup)
        print(f"[OK] Current database backed up to: {emergency_backup}")

    try:
        # Restore database
        shutil.copy2(backup_path, DB_PATH)
        print(f"[OK] Database restored from: {backup_path}")
        print(f"[OK] Database location: {DB_PATH}")
        return True

    except Exception as e:
        print(f"[ERROR] Restore failed: {e}")
        return False


def list_backups() -> list:
    """List all available backups."""
    if not BACKUP_DIR.exists():
        return []

    backups = sorted(
        [f for f in BACKUP_DIR.glob('writer_backup_*.db')],
        key=lambda x: x.stat().st_mtime,
        reverse=True
    )
    return backups


def show_restore_status():
    """Show restore status and available backups."""
    print("=" * 60)
    print("Database Restore")
    print("=" * 60)

    # Check current database
    if DB_PATH.exists():
        size = DB_PATH.stat().st_size / 1024
        mtime = datetime.fromtimestamp(DB_PATH.stat().st_mtime)
        print(f"\n[OK] Current database: {DB_PATH}")
        print(f"     Size: {size:.1f} KB")
        print(f"     Last modified: {mtime.strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print(f"\n[WARN] No database found at: {DB_PATH}")

    # List available backups
    backups = list_backups()
    print(f"\nAvailable backups: {len(backups)}")

    if backups:
        print("\nUsage: python restore.py <backup_filename>")
        print("\nAvailable backups:")
        for i, backup in enumerate(backups, 1):
            size = backup.stat().st_size / 1024
            mtime = datetime.fromtimestamp(backup.stat().st_mtime)
            print(f"  {i}. {backup.name}")
            print(f"        {size:.1f} KB | {mtime.strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print("\nNo backups found in backup directory")

    print("=" * 60)


if __name__ == '__main__':
    if len(sys.argv) > 1:
        if sys.argv[1] == '--list':
            show_restore_status()
        else:
            success = restore_database(sys.argv[1])
            sys.exit(0 if success else 1)
    else:
        show_restore_status()
        print("\nUsage: python restore.py <backup_filename>")

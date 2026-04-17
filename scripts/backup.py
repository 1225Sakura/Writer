#!/usr/bin/env python3
"""
Database Backup Script
Backs up SQLite database to timestamped file with integrity check.
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


def backup_database() -> bool:
    """Backup database to timestamped file."""
    # Ensure backup directory exists
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # Check if database exists
    if not DB_PATH.exists():
        print(f"[ERROR] Database file not found: {DB_PATH}")
        return False

    # Generate timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = BACKUP_DIR / f'writer_backup_{timestamp}.db'

    try:
        # Copy database file
        shutil.copy2(DB_PATH, backup_path)

        # Verify backup integrity
        if verify_backup(backup_path):
            print(f"[OK] Database backed up to: {backup_path}")
            print(f"[OK] Backup size: {backup_path.stat().st_size / 1024:.1f} KB")
            return True
        else:
            print(f"[ERROR] Backup verification failed")
            backup_path.unlink(missing_ok=True)
            return False

    except Exception as e:
        print(f"[ERROR] Backup failed: {e}")
        return False


def verify_backup(backup_path: Path) -> bool:
    """Verify backup file integrity by checking SQLite header."""
    try:
        with open(backup_path, 'rb') as f:
            header = f.read(16)
            # SQLite files start with "SQLite format 3\000"
            return header[:16] == b'SQLite format 3\x00'
    except Exception:
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


def show_backup_status():
    """Show backup status and list."""
    print("=" * 60)
    print("Database Backup Status")
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

    # List backups
    backups = list_backups()
    print(f"\nBackups found: {len(backups)}")

    if backups:
        print("\nAvailable backups:")
        for i, backup in enumerate(backups[:5], 1):
            size = backup.stat().st_size / 1024
            mtime = datetime.fromtimestamp(backup.stat().st_mtime)
            print(f"  {i}. {backup.name}")
            print(f"     Size: {size:.1f} KB | Modified: {mtime.strftime('%Y-%m-%d %H:%M:%S')}")
        if len(backups) > 5:
            print(f"  ... and {len(backups) - 5} more")
    else:
        print("  No backups found")

    print("=" * 60)


if __name__ == '__main__':
    if '--status' in sys.argv:
        show_backup_status()
    else:
        success = backup_database()
        sys.exit(0 if success else 1)

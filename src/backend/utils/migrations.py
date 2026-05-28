"""
Database migration utilities for Auto Novel Writer.

Provides async helpers to check if Alembic migrations are current,
useful for startup health checks and CLI commands.
"""

import asyncio
import subprocess
import sys
from pathlib import Path


ALEMBIC_INI = Path(__file__).parent.parent / "alembic.ini"
BASE_DIR = Path(__file__).parent.parent

# Resolve the alembic executable path (prefer venv, fallback to PATH)
def _get_alembic_cmd() -> list:
    """Build the alembic command list with the correct executable path."""
    # Try venv alembic first
    venv_alembic = BASE_DIR / ".venv" / "Scripts" / "alembic.exe"
    if venv_alembic.exists():
        return [str(venv_alembic), "-c", str(ALEMBIC_INI)]

    venv_alembic_unix = BASE_DIR / ".venv" / "bin" / "alembic"
    if venv_alembic_unix.exists():
        return [str(venv_alembic_unix), "-c", str(ALEMBIC_INI)]

    # Fallback to PATH
    return ["alembic", "-c", str(ALEMBIC_INI)]


async def check_migrations_current() -> bool:
    """
    Check if the database is at the latest Alembic revision.

    Returns True if migrations are current, False otherwise.
    This is an async wrapper around the alembic CLI.
    """
    if not ALEMBIC_INI.exists():
        # No alembic.ini means migrations aren't set up yet
        return True

    loop = asyncio.get_event_loop()
    alembic_cmd = _get_alembic_cmd()

    def _run_check():
        try:
            # Run 'alembic current' to get the current revision
            result = subprocess.run(
                alembic_cmd + ["current"],
                cwd=BASE_DIR,
                capture_output=True,
                text=True,
                timeout=10,
            )
            current_output = result.stdout.strip()

            # Run 'alembic heads' to get the latest revision
            result = subprocess.run(
                alembic_cmd + ["heads"],
                cwd=BASE_DIR,
                capture_output=True,
                text=True,
                timeout=10,
            )
            heads_output = result.stdout.strip()

            # Extract revision IDs from output
            # Output format: "<rev_id> (head)" or "<rev_id>"
            current_rev = current_output.split()[0] if current_output else None
            head_rev = heads_output.split()[0] if heads_output else None

            if not current_rev or not head_rev:
                return False

            return current_rev == head_rev
        except subprocess.SubprocessError:
            return False

    return await loop.run_in_executor(None, _run_check)


async def get_migration_status() -> dict:
    """
    Get detailed migration status.

    Returns a dict with:
        - current: current revision
        - head: latest revision
        - is_current: whether DB is up to date
        - pending_count: number of pending migrations
    """
    if not ALEMBIC_INI.exists():
        return {
            "current": None,
            "head": None,
            "is_current": True,
            "pending_count": 0,
            "message": "Alembic not configured",
        }

    loop = asyncio.get_event_loop()
    alembic_cmd = _get_alembic_cmd()

    def _run_status():
        try:
            # Get current revision
            result = subprocess.run(
                alembic_cmd + ["current"],
                cwd=BASE_DIR,
                capture_output=True,
                text=True,
                timeout=10,
            )
            current_output = result.stdout.strip()
            current_rev = current_output.split()[0] if current_output else None

            # Get head revision
            result = subprocess.run(
                alembic_cmd + ["heads"],
                cwd=BASE_DIR,
                capture_output=True,
                text=True,
                timeout=10,
            )
            heads_output = result.stdout.strip()
            head_rev = heads_output.split()[0] if heads_output else None

            # Count pending migrations via history
            result = subprocess.run(
                alembic_cmd + ["history", "--verbose"],
                cwd=BASE_DIR,
                capture_output=True,
                text=True,
                timeout=10,
            )
            history_lines = [
                line for line in result.stdout.strip().split("\n")
                if line.startswith("Rev:")
            ]
            total_migrations = len(history_lines)

            is_current = current_rev == head_rev if current_rev and head_rev else False

            return {
                "current": current_rev,
                "head": head_rev,
                "is_current": is_current,
                "pending_count": 0 if is_current else total_migrations,
                "total_migrations": total_migrations,
            }
        except subprocess.SubprocessError as e:
            return {
                "current": None,
                "head": None,
                "is_current": False,
                "pending_count": 0,
                "error": str(e),
            }

    return await loop.run_in_executor(None, _run_status)

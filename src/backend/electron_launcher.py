"""Electron launcher — entry point for Electron main process.

Usage: python electron_launcher.py <host> <port>
Electron main.ts calls: spawn(python, [launcherPath, host, port])
"""
from __future__ import annotations

import sys
import os

# Ensure backend directory is on path so imports work
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn
from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig


def _run_alembic_upgrade() -> None:
    """Apply pending migrations before serving requests."""
    cfg = AlembicConfig(os.path.join(backend_dir, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    alembic_command.upgrade(cfg, "head")


def main() -> None:
    host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000

    # Set data dir from Electron env
    data_dir = os.environ.get("WRITER_DATA_DIR", os.path.join(backend_dir, "data"))
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{data_dir}/writer.db")
    os.environ.setdefault("WRITER_ELECTRON_MODE", "1")

    # Apply Alembic migrations before serving (idempotent)
    _run_alembic_upgrade()

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_level="info",
        workers=1,
        loop="asyncio",
    )


if __name__ == "__main__":
    main()

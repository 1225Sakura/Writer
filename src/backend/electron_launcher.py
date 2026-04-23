"""
Electron Launcher for Writer Backend
Handles import path setup so both bare imports and package imports work.

The backend codebase uses mixed import styles:
- main.py uses bare imports (e.g., 'from config import settings')
- Routes use absolute 'backend.*' imports
- Some files use relative imports

This launcher bridges the gap by aliasing backend submodules as top-level
modules in sys.modules before importing backend.main.
"""

import sys
import os
from pathlib import Path

# Add project src/ directory to path so 'backend' package is discoverable
backend_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.dirname(backend_dir)
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

# Alias backend submodules as top-level modules so bare imports work.
# This allows main.py's 'from config import settings' to resolve correctly
# when main is imported as backend.main.
_ALIASES = [
    'config',
    'database',
    'routes',
    'middleware',
    'utils',
    'services',
    'models',
    'agents',
    'schemas',
]

for _name in _ALIASES:
    _full = f'backend.{_name}'
    try:
        _mod = __import__(_full, fromlist=[''])
        if _name not in sys.modules:
            sys.modules[_name] = _mod
    except Exception as _e:
        print(f'[Launcher] Warning: could not alias backend.{_name}: {_e}')

# Auto-initialize database if needed using alembic migrations
def ensure_database():
    """Ensure database exists and is initialized using alembic migrations.

    In Electron mode, the data directory is set by the main process via
    WRITER_DATA_DIR env var. Falls back to backend/data/ for standalone runs.
    """
    import sqlite3

    # Respect Electron's data directory if provided
    electron_data_dir = os.environ.get('WRITER_DATA_DIR')
    if electron_data_dir:
        data_dir = Path(electron_data_dir)
    else:
        data_dir = Path(__file__).parent / 'data'

    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / 'writer.db'

    # If database exists, ensure it has all required columns (schema compatibility)
    if db_path.exists():
        print(f"[Launcher] Database already exists at {db_path}")
        # Ensure tags columns exist in all tables that need them
        _ensure_tags_columns(db_path)
        return

    print(f"[Launcher] Database not found, initializing at {db_path}...")

    # Use alembic programmatically with correct db path
    try:
        from alembic.config import Config
        from alembic import command

        alembic_cfg = Config(str(Path(__file__).parent / 'alembic.ini'))

        # Set the database URL to point to correct location
        db_url = f'sqlite:///{db_path}'
        alembic_cfg.set_main_option('sqlalchemy.url', db_url)

        # Run migrations
        command.upgrade(alembic_cfg, 'head')
        print("[Launcher] Database migrated successfully")
    except Exception as e:
        print(f"[Launcher] Migration error: {e}")
        import traceback
        traceback.print_exc()


def _ensure_tags_columns(db_path: Path):
    """Ensure tags columns exist in all tables that need them.

    This handles schema migrations for existing databases that may be missing
    the tags columns added in a later migration.
    """
    import sqlite3

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Tables that need tags column
    tables_needing_tags = ['characters', 'items', 'locations', 'factions', 'world_settings', 'rules']

    for table in tables_needing_tags:
        try:
            # Check if table exists
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,)
            )
            if not cursor.fetchone():
                continue  # Table doesn't exist, skip

            # Check if tags column exists
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [col[1] for col in cursor.fetchall()]

            if 'tags' not in columns:
                cursor.execute(f'ALTER TABLE {table} ADD COLUMN tags TEXT')
                print(f"[Launcher] Added tags column to {table}")
        except sqlite3.Error as e:
            print(f"[Launcher] Warning: Could not add tags to {table}: {e}")

    conn.commit()
    conn.close()

# Ensure database is initialized
ensure_database()

# Now import the FastAPI app — all imports should resolve correctly
import backend.interface.web.main
app = backend.interface.web.main.app

if __name__ == "__main__":
    import uvicorn

    host = sys.argv[1] if len(sys.argv) > 1 else "localhost"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
    )

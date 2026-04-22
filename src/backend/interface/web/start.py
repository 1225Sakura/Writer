#!/usr/bin/env python
# Startup script for Writer API
import sys
import os
from pathlib import Path

# Setup paths
BASE_DIR = Path(__file__).parent.parent.parent  # D:/writer
sys.path.insert(0, str(BASE_DIR / 'src'))
os.chdir(BASE_DIR / 'src' / 'backend')

# Alias backend submodules as top-level modules so bare imports in main.py
# and relative imports in routes/agents work together.
_ALIASES = [
    'config', 'database', 'routes', 'middleware',
    'utils', 'services', 'models', 'agents', 'schemas',
]
for _name in _ALIASES:
    _full = f'backend.{_name}'
    try:
        _mod = __import__(_full, fromlist=[''])
        if _name not in sys.modules:
            sys.modules[_name] = _mod
    except Exception as _e:
        print(f'[Start] Warning: could not alias backend.{_name}: {_e}')

# Load environment variables from .env.example if .env doesn't exist
ENV_FILE = Path(__file__).parent / '.env'
if not ENV_FILE.exists():
    EXAMPLE_FILE = Path(__file__).parent / '.env.example'
    if EXAMPLE_FILE.exists():
        import shutil
        shutil.copy(EXAMPLE_FILE, ENV_FILE)
        print(f"Created .env file from .env.example - please configure your API keys")

# Check required environment variables
from dotenv import load_dotenv
load_dotenv()

def check_environment():
    """Check required environment variables."""
    warnings = []
    if not os.getenv("MINIMAX_API_KEY"):
        warnings.append("MINIMAX_API_KEY is not set - AI features will not work")
    return warnings

# Auto-initialize database if needed
def ensure_database():
    """Ensure database exists and is initialized."""
    db_path = Path(__file__).parent.parent.parent / 'data' / 'writer.db'
    db_path.parent.mkdir(parents=True, exist_ok=True)

    if not db_path.exists():
        print("Database not found, initializing...")
        from init_db import init_db
        init_db()
        print("Database initialized successfully")

if __name__ == "__main__":
    # Check environment
    warnings = check_environment()
    for w in warnings:
        print(f"Warning: {w}")

    # Ensure database
    ensure_database()

    import uvicorn
    import backend.interface.web.main
    uvicorn.run(
        backend.interface.web.main.app,
        host="127.0.0.1",
        port=8000,
        reload=False
    )

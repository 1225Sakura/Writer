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

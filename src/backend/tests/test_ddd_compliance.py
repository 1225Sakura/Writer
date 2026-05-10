"""Tests enforcing DDD compliance across the codebase.

These tests prevent regressions by verifying:
1. No direct DB access in API endpoint files
2. No bare imports (non-backend.* imports)
3. Single AsyncEventBus instantiation site
"""

import os
import re
from pathlib import Path

ENDPOINT_DIR = Path(__file__).parent.parent / "api" / "v1" / "endpoints"
BACKEND_DIR = Path(__file__).parent.parent


def test_endpoints_have_no_direct_db_access():
    """No endpoint should use db.execute/db.add/db.flush/db.delete directly."""
    violations = []
    for py_file in ENDPOINT_DIR.glob("*.py"):
        if py_file.name == "__init__.py":
            continue
        content = py_file.read_text(encoding="utf-8")
        for pattern in [r'db\.execute', r'db\.add\(', r'db\.flush', r'db\.delete']:
            if re.search(pattern, content):
                violations.append(f"{py_file.name}: contains {pattern}")
    assert violations == [], "DDD violations found:\n" + "\n".join(violations)


def test_no_bare_imports_in_api_and_core():
    """All imports in api/ and core/ should use 'backend.*' prefix."""
    bare_import_pattern = re.compile(
        r'^from (config|database|init_db|routes|middleware|utils|services|agents|'
        r'api|core|db|events|infrastructure|repositories) import',
        re.MULTILINE,
    )
    violations = []
    for directory in [BACKEND_DIR / "api", BACKEND_DIR / "core"]:
        if not directory.exists():
            continue
        for py_file in directory.rglob("*.py"):
            if py_file.name == "__init__.py":
                continue
            content = py_file.read_text(encoding="utf-8")
            if bare_import_pattern.search(content):
                violations.append(str(py_file.relative_to(BACKEND_DIR)))
    assert violations == [], "Bare imports found:\n" + "\n".join(violations)


def test_single_event_bus_instantiation():
    """Only dependencies.py should instantiate AsyncEventBus()."""
    violations = []
    for py_file in (BACKEND_DIR / "api").rglob("*.py"):
        if py_file.name == "__init__.py":
            continue
        content = py_file.read_text(encoding="utf-8")
        if re.search(r'AsyncEventBus\(\)', content):
            # Only dependencies.py is allowed
            if py_file.name != "dependencies.py":
                violations.append(str(py_file.relative_to(BACKEND_DIR)))
    assert violations == [], "Unauthorized AsyncEventBus() instantiation:\n" + "\n".join(violations)


def test_no_sys_modules_hacks_outside_engine():
    """sys.modules manipulation should only exist in infrastructure/database/engine.py."""
    violations = []
    for py_file in BACKEND_DIR.rglob("*.py"):
        if py_file.name == "__init__.py":
            continue
        # Skip the allowed file
        if py_file.name == "engine.py" and "infrastructure" in str(py_file):
            continue
        # Skip .venv, tests, and this test file itself
        rel = str(py_file.relative_to(BACKEND_DIR))
        if ".venv" in rel or rel.startswith("tests" + os.sep):
            continue
        content = py_file.read_text(encoding="utf-8")
        # Check for actual sys.modules assignment (not comments)
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith('#'):
                continue
            if 'sys.modules[' in stripped and '=' in stripped:
                violations.append(f"{rel}: {stripped}")
    assert violations == [], "Unauthorized sys.modules usage:\n" + "\n".join(violations)

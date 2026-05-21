"""
Architecture import validation test.

Verifies that all critical backend modules can be imported without errors,
catching broken import chains, missing dependencies, and circular imports.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

# All critical modules that must import cleanly
CRITICAL_MODULES = [
    # Core domain
    "backend.core.domain.entities",
    # Core services
    "backend.core.services.ai.ai_service",
    # Infrastructure
    "backend.infrastructure.database",
    "backend.infrastructure.database.engine",
    "backend.infrastructure.security.encryption",
    "backend.infrastructure.rate_limit.sqlite_limiter",
    "backend.infrastructure.cache.cache_service",
    "backend.infrastructure.cache.tiered_cache",
    "backend.infrastructure.observability.metrics_service",
    # Services
    "backend.services.ws_message_queue",
    "backend.services.backup_manager",
    "backend.services.preload_service",
    "backend.services.strand_classifier",
    "backend.services.rag_service",
    # Middleware
    "backend.middleware.errors",
    # Interface
    "backend.interface.web.main",
]


@pytest.mark.parametrize("module_path", CRITICAL_MODULES)
def test_module_imports(module_path):
    """Verify each critical module can be imported without errors."""
    __import__(module_path)


def test_dead_directories_removed():
    """Verify dead code directories were properly removed."""
    backend_root = os.path.join(os.path.dirname(__file__), '..', 'src', 'backend')

    # db/ directory should not exist (was redundant with Alembic)
    db_dir = os.path.join(backend_root, 'db')
    assert not os.path.exists(db_dir), f"Dead directory {db_dir} should have been removed"

    # vendor/ directory should not exist (was dead fallback stub)
    vendor_dir = os.path.join(backend_root, 'vendor')
    assert not os.path.exists(vendor_dir), f"Dead directory {vendor_dir} should have been removed"


import ast
import glob as glob_mod


def test_no_bare_except_pass_anywhere():
    """Scan all backend source files for bare except: pass patterns."""
    backend_root = os.path.join(os.path.dirname(__file__), '..', 'src', 'backend')
    violations = []

    for py_file in glob_mod.glob(os.path.join(backend_root, '**', '*.py'), recursive=True):
        # Skip virtual environment and __pycache__
        if '.venv' in py_file or '__pycache__' in py_file:
            continue
        try:
            with open(py_file, 'r', encoding='utf-8') as f:
                tree = ast.parse(f.read())
        except SyntaxError:
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.ExceptHandler):
                if node.type is None and len(node.body) == 1:
                    if isinstance(node.body[0], ast.Pass):
                        rel_path = os.path.relpath(py_file, os.path.dirname(__file__))
                        violations.append(f"{rel_path}:{node.lineno}")

    assert not violations, f"Bare except:pass found in: {violations}"


def test_core_does_not_import_infrastructure():
    """Verify core domain doesn't directly import infrastructure modules.

    The one allowed exception is importing Base from backend.infrastructure.database,
    since SQLAlchemy ORM models need the declarative Base from the engine layer.
    """
    import backend.core.domain.entities as entities_mod
    source_file = entities_mod.__file__
    with open(source_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Allowed: importing Base from the database engine (SQLAlchemy declarative base)
    allowed_imports = {'backend.infrastructure.database'}

    violations = []
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if 'backend.infrastructure' not in stripped:
            continue
        # Check if this line imports something beyond the allowed database Base
        if 'from backend.infrastructure' in stripped:
            # Extract the module path after "from "
            parts = stripped.split()
            if len(parts) >= 2:
                mod_path = parts[1]
                if mod_path not in allowed_imports:
                    violations.append(f"line {i}: {stripped}")
        elif 'import backend.infrastructure' in stripped:
            violations.append(f"line {i}: {stripped}")

    assert not violations, \
        f"Core domain entities should not import infrastructure modules (except database Base): {violations}"

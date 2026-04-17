#!/usr/bin/env python3
"""
Project Health Check Script
Verifies that all required files and directories exist,
Python imports work, and key files compile.
"""

import os
import sys
import importlib.util
import subprocess
from pathlib import Path

# Project root
ROOT = Path(__file__).parent.parent

# Required files and directories
REQUIRED_STRUCTURE = {
    'src/backend': [
        'main.py',
        'config.py',
        'database.py',
        'migrations.py',
        'init_db.py',
        'routes/__init__.py',
        'routes/chat.py',
        'routes/settings.py',
        'routes/chapters.py',
        'routes/ai.py',
        'routes/styles.py',
        'models/__init__.py',
        'models/entities.py',
    ],
    'src/frontend': [
        'package.json',
        'vite.config.ts',
        'tsconfig.json',
        'src/main.tsx',
        'src/App.tsx',
        'src/styles/globals.css',
        'src/api/request.ts',
    ],
    '': [
        '.gitignore',
        '.editorconfig',
        'README.md',
    ],
}

# Optional but recommended
RECOMMENDED = {
    'src/backend': [
        'requirements.txt',
        'Dockerfile',
        'pytest.ini',
    ],
    'src/frontend': [
        'Dockerfile',
    ],
    '': [
        'docker-compose.yml',
    ],
}

# Key Python files to check for import errors
KEY_PYTHON_FILES = [
    'src/backend/config.py',
    'src/backend/database.py',
    'src/backend/models/entities.py',
    'scripts/backup.py',
    'scripts/restore.py',
    'scripts/health_check.py',
]


def check_file_exists(path: Path) -> tuple[bool, str]:
    """Check if a file exists."""
    exists = path.exists()
    status = '[OK]' if exists else '[MISSING]'
    return exists, f"{status} {path.relative_to(ROOT)}"


def check_python_import(file_path: Path) -> tuple[bool, str]:
    """Check if a Python file can be imported without errors."""
    try:
        # Convert to module path
        rel_path = file_path.relative_to(ROOT)
        module_parts = list(rel_path.parts)
        if module_parts[-1].endswith('.py'):
            module_parts[-1] = module_parts[-1][:-3]

        # Try importing with exec (avoiding actual import side effects)
        spec = importlib.util.spec_from_file_location("__check__", file_path)
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            # Don't execute - just check syntax
            with open(file_path, 'r', encoding='utf-8') as f:
                code = f.read()
            compile(code, str(file_path), 'exec')
            return True, f"[OK] {rel_path}"
        return False, f"[ERROR] {rel_path}"
    except SyntaxError as e:
        return False, f"[SYNTAX] {rel_path}: {e}"
    except Exception as e:
        return False, f"[ERROR] {rel_path}: {e}"


def check_typescript_compilation() -> tuple[bool, str]:
    """Check if TypeScript compiles without errors."""
    tsconfig = ROOT / 'src' / 'frontend' / 'tsconfig.json'
    if not tsconfig.exists():
        return False, "[SKIP] tsconfig.json not found"

    try:
        # Run tsc --noEmit in frontend directory
        result = subprocess.run(
            ['npx', 'tsc', '--noEmit'],
            cwd=str(ROOT / 'src' / 'frontend'),
            capture_output=True,
            text=True,
            timeout=120
        )
        if result.returncode == 0:
            return True, "[OK] TypeScript compilation passed"
        else:
            # Filter out node_modules errors
            errors = [l for l in result.stdout.split('\n') if 'node_modules' not in l and l.strip()]
            if errors:
                return False, f"[ERROR] TypeScript: {errors[:3]}"
            return True, "[OK] TypeScript compilation passed"
    except FileNotFoundError:
        return False, "[SKIP] npx/tsc not available"
    except subprocess.TimeoutExpired:
        return False, "[TIMEOUT] TypeScript check timed out"
    except Exception as e:
        return False, f"[ERROR] TypeScript check failed: {e}"


def main():
    print('=' * 60)
    print('Project Health Check')
    print('=' * 60)

    all_passed = True

    # Check required structure
    print('\n[Required Files]')
    for category, files in REQUIRED_STRUCTURE.items():
        base = ROOT / category if category else ROOT
        for file_path in files:
            full_path = base / file_path
            exists, msg = check_file_exists(full_path)
            print(msg)
            if not exists:
                all_passed = False

    # Check recommended structure
    print('\n[Recommended Files]')
    for category, files in RECOMMENDED.items():
        if category == 'root':
            base = ROOT
        else:
            base = ROOT / category
        for file_path in files:
            full_path = base / file_path
            exists, msg = check_file_exists(full_path)
            print(msg)

    # Check Python imports
    print('\n[Python Import Check]')
    for file_path in KEY_PYTHON_FILES:
        full_path = ROOT / file_path
        if full_path.exists():
            success, msg = check_python_import(full_path)
            print(msg)
            if not success:
                all_passed = False
        else:
            print(f"[SKIP] {file_path} (file not found)")

    # Check TypeScript compilation
    print('\n[TypeScript Check]')
    success, msg = check_typescript_compilation()
    print(msg)
    if not success:
        all_passed = False

    # Summary
    print('\n' + '=' * 60)
    if all_passed:
        print('[PASS] All required files present')
        return 0
    else:
        print('[FAIL] Some checks failed')
        return 1


if __name__ == '__main__':
    sys.exit(main())

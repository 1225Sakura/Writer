#!/usr/bin/env python3
"""
Project Health Check Script
Verifies that all required files and directories exist
"""

import os
import sys
from pathlib import Path

# Project root
ROOT = Path(__file__).parent.parent

# Required files and directories
REQUIRED_STRUCTURE = {
    'src/backend': [
        'main.py',
        'config.py',
        'database.py',
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
        'migrations.py',
    ],
    'src/frontend': [
        'Dockerfile',
        'nginx.conf',
    ],
    '': [
        'docker-compose.yml',
        '.github/workflows/ci.yml',
    ],
}


def check_file_exists(path: Path, description: str = '') -> tuple[bool, str]:
    """Check if a file exists."""
    exists = path.exists()
    status = '[OK]' if exists else '[MISSING]'
    msg = f'{status} {path.relative_to(ROOT)}'
    if description:
        msg += f' ({description})'
    return exists, msg


def main():
    print('=' * 60)
    print('Project Health Check')
    print('=' * 60)

    all_passed = True

    # Check required structure
    print('\n[Required Files]')
    for category, files in REQUIRED_STRUCTURE.items():
        base = ROOT / category
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
            if not exists:
                all_passed = False  # Not failing, but noting

    # Summary
    print('\n' + '=' * 60)
    if all_passed:
        print('[PASS] All required files present')
        return 0
    else:
        print('[FAIL] Some required files missing')
        return 1


if __name__ == '__main__':
    sys.exit(main())

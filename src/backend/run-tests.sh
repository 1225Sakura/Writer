#!/bin/bash
# Run backend tests with the correct Python environment.
# Usage: bash run-tests.sh [pytest args...]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PYTHON="$SCRIPT_DIR/.venv/Scripts/python.exe"

# Fallback for Linux/macOS
if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="$SCRIPT_DIR/.venv/bin/python"
fi

if [ ! -f "$VENV_PYTHON" ]; then
    echo "ERROR: Python venv not found at $SCRIPT_DIR/.venv"
    echo "Run: python -m venv .venv && .venv/Scripts/pip install -r requirements.txt"
    exit 1
fi

cd "$SCRIPT_DIR"
PYTHONPATH="$SCRIPT_DIR" "$VENV_PYTHON" -m pytest "$@"

#!/usr/bin/env bash
# scripts/start-services.sh — US-020 (manual dev helper).
#
# Starts the two long-running processes that the desktop app expects:
#   - Vite dev server on :5173  (frontend)
#   - Python FastAPI backend on :8000 (electron_launcher.py)
#
# Usage:
#   ./scripts/start-services.sh           # both
#   ./scripts/start-services.sh frontend  # vite only
#   ./scripts/start-services.sh backend   # uvicorn only
#
# This is a manual helper for local development; the Playwright test runner
# spawns these processes itself via `webServer` and `globalSetup`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$FRONTEND_DIR/src/backend"

VITE_PORT="${VITE_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

start_frontend() {
  echo "[start-services] launching vite on :$VITE_PORT"
  ( cd "$FRONTEND_DIR" && npm run dev -- --port "$VITE_PORT" )
}

start_backend() {
  echo "[start-services] launching python backend on :$BACKEND_PORT"
  PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"
  if [[ ! -x "$PYTHON_BIN" ]]; then
    PYTHON_BIN="$(command -v python)"
  fi
  ( cd "$BACKEND_DIR" && "$PYTHON_BIN" electron_launcher.py 127.0.0.1 "$BACKEND_PORT" )
}

target="${1:-all}"
case "$target" in
  frontend)
    start_frontend
    ;;
  backend)
    start_backend
    ;;
  all)
    # Trap SIGINT/SIGTERM so we can kill both children together.
    trap 'kill 0' EXIT INT TERM
    start_backend &
    BACKEND_PID=$!
    start_frontend &
    FRONTEND_PID=$!
    echo "[start-services] backend pid=$BACKEND_PID frontend pid=$FRONTEND_PID"
    wait "$BACKEND_PID" "$FRONTEND_PID"
    ;;
  *)
    echo "usage: $0 {frontend|backend|all}" >&2
    exit 64
    ;;
esac
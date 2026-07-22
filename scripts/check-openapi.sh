#!/usr/bin/env bash
# Linux/macOS wrapper for OpenAPI contract check.
# Delegates to check-openapi.mjs (cross-platform Node.js).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/check-openapi.mjs" "$@"

"""AILogEmitter — emits AI call metadata to a JSONL file for Electron main to consume.

Phase 0 implementation (US-018):
- Writes one JSON object per line to ``WRITER_DATA_DIR/ai-log-emit.jsonl`` (or
  ``/tmp/ai-log-emit.jsonl`` if the env var is unset).
- Electron main can either tail this file or read it on demand to build the
  canonical ``userData/ai-log.jsonl``.

Production-grade alternatives (Phase 1+):
- Open a WebSocket to Electron main and stream events directly.
- Use Electron's ``ai-log:append`` IPC handler from the renderer.

The emitter is deliberately minimal: append-only, fire-and-forget, no schema
validation beyond ``json.dumps``. Callers should construct payloads that match
the Electron handler's expected schema.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# File-system lock to serialize concurrent appends from multiple threads.
# Python's open(..., 'a') on POSIX is atomic for small writes (< PIPE_BUF=4096),
# but a lock keeps us safe on Windows and across larger payloads.
_WRITE_LOCK = threading.Lock()

_DEFAULT_DIR = "/tmp"


def _default_path() -> str:
    base_dir = os.environ.get("WRITER_DATA_DIR") or _DEFAULT_DIR
    return os.path.join(base_dir, "ai-log-emit.jsonl")


class AILogEmitter:
    """Append-only JSONL emitter for AI call metadata.

    Args:
        log_path: Target file path. Defaults to
            ``$WRITER_DATA_DIR/ai-log-emit.jsonl`` or ``/tmp/ai-log-emit.jsonl``.
    """

    def __init__(self, log_path: str | None = None) -> None:
        self._path = log_path or _default_path()

    @property
    def path(self) -> str:
        return self._path

    def emit(self, payload: dict[str, Any]) -> None:
        """Append a single record as one JSON line to the log file.

        Missing keys default to ``None``; ``timestamp`` defaults to the current
        UTC ISO timestamp if the caller does not provide one.
        """
        record = {
            "timestamp": payload.get("timestamp")
            or datetime.now(timezone.utc).isoformat(),
            "journeyId": payload.get("journeyId"),
            "stageId": payload.get("stageId"),
            "action": payload.get("action"),
            "prompt": payload.get("prompt"),
            "response": payload.get("response"),
            "latencyMs": payload.get("latencyMs"),
            "tokenCount": payload.get("tokenCount"),
            "correlationId": payload.get("correlationId"),
        }
        line = json.dumps(record, ensure_ascii=False) + "\n"

        parent = Path(self._path).parent
        parent.mkdir(parents=True, exist_ok=True)

        with _WRITE_LOCK:
            with open(self._path, "a", encoding="utf-8") as f:
                f.write(line)


# Singleton accessor for callers that want a shared emitter.
_default_emitter: AILogEmitter | None = None
_default_lock = threading.Lock()


def get_emitter() -> AILogEmitter:
    """Return a process-wide shared AILogEmitter."""
    global _default_emitter
    with _default_lock:
        if _default_emitter is None:
            _default_emitter = AILogEmitter()
        return _default_emitter


def reset_emitter() -> None:
    """Reset the singleton (for tests)."""
    global _default_emitter
    with _default_lock:
        _default_emitter = None
"""Tests for AILogEmitter — JSONL append-only AI call event log (US-018).

Covers:
- Single emit writes one well-formed JSON line
- Multiple emits append (not overwrite)
- Timestamp defaults to current UTC when omitted
- Missing payload keys default to ``None``
- Custom log_path is honored
- Parent directory is created if missing
- Chinese unicode is preserved (``ensure_ascii=False``)
- Concurrent writes are serialized by the lock
- Payload shape matches the Electron ``ai-log:append`` handler contract
"""
from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.services.ai_log_emitter import (
    AILogEmitter,
    get_emitter,
    reset_emitter,
)

# These are the fields the Electron ``ai-log:append`` IPC handler writes to
# ``userData/ai-log.jsonl``. The backend emitter must produce matching records.
EXPECTED_KEYS = {
    "timestamp",
    "journeyId",
    "stageId",
    "action",
    "prompt",
    "response",
    "latencyMs",
    "tokenCount",
    "correlationId",
}


def test_emit_writes_jsonl_line(tmp_path: Path) -> None:
    log = tmp_path / "ai-log.jsonl"
    emitter = AILogEmitter(str(log))

    emitter.emit({"action": "chat", "prompt": "hello"})

    contents = log.read_text(encoding="utf-8")
    lines = contents.strip().split("\n")
    assert len(lines) == 1

    record = json.loads(lines[0])
    assert record["action"] == "chat"
    assert record["prompt"] == "hello"


def test_emit_appends_multiple_lines(tmp_path: Path) -> None:
    log = tmp_path / "ai-log.jsonl"
    emitter = AILogEmitter(str(log))

    emitter.emit({"action": "step1"})
    emitter.emit({"action": "step2"})
    emitter.emit({"action": "step3"})

    contents = log.read_text(encoding="utf-8")
    lines = contents.strip().split("\n")
    assert len(lines) == 3
    actions = [json.loads(line)["action"] for line in lines]
    assert actions == ["step1", "step2", "step3"]


def test_emit_includes_timestamp_when_missing(tmp_path: Path) -> None:
    log = tmp_path / "ai-log.jsonl"
    emitter = AILogEmitter(str(log))

    before = datetime.now(timezone.utc)
    emitter.emit({"action": "x"})
    after = datetime.now(timezone.utc)

    record = json.loads(log.read_text(encoding="utf-8").strip())
    ts = record["timestamp"]
    # The emitter writes an ISO-8601 string; parse and compare bounds.
    parsed = datetime.fromisoformat(ts)
    assert before <= parsed <= after


def test_emit_preserves_caller_supplied_timestamp(tmp_path: Path) -> None:
    log = tmp_path / "ai-log.jsonl"
    emitter = AILogEmitter(str(log))

    fixed = "2026-07-16T10:00:00+00:00"
    emitter.emit({"action": "x", "timestamp": fixed})

    record = json.loads(log.read_text(encoding="utf-8").strip())
    assert record["timestamp"] == fixed


def test_emit_handles_missing_keys(tmp_path: Path) -> None:
    log = tmp_path / "ai-log.jsonl"
    emitter = AILogEmitter(str(log))

    emitter.emit({})  # no keys at all

    record = json.loads(log.read_text(encoding="utf-8").strip())
    for key in EXPECTED_KEYS:
        assert key in record
    assert record["journeyId"] is None
    assert record["stageId"] is None
    assert record["action"] is None
    assert record["prompt"] is None
    assert record["response"] is None
    assert record["latencyMs"] is None
    assert record["tokenCount"] is None
    assert record["correlationId"] is None


def test_emit_writes_to_custom_path(tmp_path: Path) -> None:
    log = tmp_path / "nested" / "deep" / "log.jsonl"
    emitter = AILogEmitter(str(log))

    emitter.emit({"action": "x"})

    assert log.exists()
    assert json.loads(log.read_text(encoding="utf-8").strip())["action"] == "x"


def test_emit_creates_parent_directory(tmp_path: Path) -> None:
    log = tmp_path / "missing-parent" / "log.jsonl"
    assert not log.parent.exists()

    emitter = AILogEmitter(str(log))
    emitter.emit({"action": "x"})

    assert log.parent.exists()
    assert log.exists()


def test_emit_unicode_chinese(tmp_path: Path) -> None:
    log = tmp_path / "ai-log.jsonl"
    emitter = AILogEmitter(str(log))

    payload = {
        "action": "chat",
        "prompt": "你好，世界",
        "response": "我是一个测试回复：今天天气很好。",
    }
    emitter.emit(payload)

    contents = log.read_text(encoding="utf-8")
    # ensure_ascii=False means raw UTF-8 characters appear in the file.
    assert "你好，世界" in contents
    assert "今天天气很好" in contents

    record = json.loads(contents.strip())
    assert record["prompt"] == payload["prompt"]
    assert record["response"] == payload["response"]


def test_emit_payload_shape_matches_electron_handler(tmp_path: Path) -> None:
    """Every key produced by the backend must exist in the Electron handler.

    Mirrors the field set defined in ``electron/main.ts`` ``ipcMain.handle(
    'ai-log:append', ...)``. Drift between the two would silently lose data.
    """
    log = tmp_path / "ai-log.jsonl"
    emitter = AILogEmitter(str(log))

    emitter.emit(
        {
            "journeyId": "j-1",
            "stageId": "s-1",
            "action": "generate",
            "prompt": "p",
            "response": "r",
            "latencyMs": 123,
            "tokenCount": 456,
            "correlationId": "c-1",
        }
    )

    record = json.loads(log.read_text(encoding="utf-8").strip())
    assert set(record.keys()) == EXPECTED_KEYS
    assert record["journeyId"] == "j-1"
    assert record["stageId"] == "s-1"
    assert record["action"] == "generate"
    assert record["latencyMs"] == 123
    assert record["tokenCount"] == 456
    assert record["correlationId"] == "c-1"


def test_emit_concurrent_writes(tmp_path: Path) -> None:
    """Multiple threads emitting simultaneously must produce N well-formed lines."""
    log = tmp_path / "ai-log.jsonl"
    emitter = AILogEmitter(str(log))

    n_threads = 8
    per_thread = 25

    def worker(tid: int) -> None:
        for i in range(per_thread):
            emitter.emit({"action": f"t{tid}-i{i}"})

    threads = [threading.Thread(target=worker, args=(t,)) for t in range(n_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    lines = log.read_text(encoding="utf-8").strip().split("\n")
    expected = n_threads * per_thread
    assert len(lines) == expected
    # Every line must parse; no partial writes from interleaving.
    for line in lines:
        record = json.loads(line)
        assert record["action"].startswith("t")


def test_get_emitter_returns_singleton(tmp_path: Path) -> None:
    log = tmp_path / "ai-log.jsonl"
    reset_emitter()
    # Replace the singleton with a custom-path emitter for the duration of the test.
    import app.services.ai_log_emitter as mod

    mod._default_emitter = AILogEmitter(str(log))  # type: ignore[attr-defined]

    a = get_emitter()
    b = get_emitter()
    assert a is b
    assert a.path == str(log)

    a.emit({"action": "shared"})
    record = json.loads(log.read_text(encoding="utf-8").strip())
    assert record["action"] == "shared"

    reset_emitter()


def test_reset_emitter_clears_singleton(tmp_path: Path) -> None:
    reset_emitter()
    first = get_emitter()
    first.emit({"action": "before"})

    reset_emitter()
    second = get_emitter()
    assert second is not first
"""US-019 polish — Per-journey DATABASE_URL env injection.

The Electron desktop launcher (``electron_launcher.py``) derives
``DATABASE_URL`` from the ``WRITER_DATA_DIR`` env var so each e2e journey
can mount an isolated SQLite file without leaking state between runs.

This test suite verifies the four contract guarantees:

  1. ``WRITER_DATA_DIR=/tmp/journey1`` -> ``DATABASE_URL=sqlite:////tmp/journey1/writer.db``
  2. Without ``WRITER_DATA_DIR`` set, the launcher falls back to its default
     ``<backend_dir>/data`` location.
  3. Setting ``WRITER_DATA_DIR`` is enough — no need to also set
     ``DATABASE_URL`` (sanity: ``configure_runtime_env`` is idempotent).
  4. If the caller has already set ``DATABASE_URL`` (e.g. for a Postgres
     integration test), the launcher's ``setdefault`` MUST NOT clobber it.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


# Always operate against the source tree, not any installed copy.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import electron_launcher  # noqa: E402  (sys.path adjusted above)


def _purge_env() -> None:
    """Strip every variable the launcher reads from the environment."""
    for key in ("WRITER_DATA_DIR", "DATABASE_URL", "WRITER_ELECTRON_MODE"):
        os.environ.pop(key, None)


def test_writer_data_dir_env_override(tmp_path: Path, monkeypatch) -> None:
    """WRITER_DATA_DIR=data/e2e/<id> -> DATABASE_URL=sqlite:///<id>/writer.db"""
    _purge_env()
    journey_dir = tmp_path / "data" / "e2e" / "journey1"
    monkeypatch.setenv("WRITER_DATA_DIR", str(journey_dir))

    resolved = electron_launcher.configure_runtime_env()

    expected = f"sqlite:///{journey_dir}/writer.db"
    assert resolved == expected, (
        f"WRITER_DATA_DIR={journey_dir!s} must derive DATABASE_URL={expected!r}, "
        f"got {resolved!r}"
    )
    assert os.environ["DATABASE_URL"] == expected
    # Side effect: the launcher also tags Electron-mode for downstream services.
    assert os.environ.get("WRITER_ELECTRON_MODE") == "1"

    _purge_env()


def test_default_data_dir_fallback(monkeypatch) -> None:
    """Without WRITER_DATA_DIR, fall back to <backend_dir>/data/writer.db."""
    _purge_env()

    resolved = electron_launcher.configure_runtime_env()

    default = BACKEND_DIR / "data"
    expected = f"sqlite:///{default}/writer.db"
    assert resolved == expected, (
        f"Default fallback must point at {expected!r}, got {resolved!r}"
    )
    assert os.environ["DATABASE_URL"] == expected

    _purge_env()


def test_per_journey_data_dir_creates_isolated_path(tmp_path: Path, monkeypatch) -> None:
    """Two journeys must each get a unique DATABASE_URL — verify by calling
    ``configure_runtime_env`` twice with different envs in the same process."""
    _purge_env()

    journey_a = tmp_path / "a"
    journey_b = tmp_path / "b"

    # Journey A
    monkeypatch.setenv("WRITER_DATA_DIR", str(journey_a))
    _purge_env()  # reset DATABASE_URL between journeys
    monkeypatch.setenv("WRITER_DATA_DIR", str(journey_a))
    url_a = electron_launcher.configure_runtime_env()
    assert url_a == f"sqlite:///{journey_a}/writer.db"

    # Journey B
    _purge_env()
    monkeypatch.setenv("WRITER_DATA_DIR", str(journey_b))
    url_b = electron_launcher.configure_runtime_env()
    assert url_b == f"sqlite:///{journey_b}/writer.db"

    assert url_a != url_b, "Two journeys must yield distinct DATABASE_URLs"

    _purge_env()


def test_database_url_not_overridden_if_set(monkeypatch) -> None:
    """If DATABASE_URL is already set (e.g. for tests against Postgres),
    the launcher's ``setdefault`` must leave it untouched."""
    _purge_env()
    explicit = "postgresql+psycopg://user:pwd@db.internal:5432/writer"
    monkeypatch.setenv("DATABASE_URL", explicit)
    monkeypatch.setenv("WRITER_DATA_DIR", "/tmp/should-be-ignored")

    resolved = electron_launcher.configure_runtime_env()

    assert resolved == explicit, (
        f"Launcher must not override a caller-supplied DATABASE_URL; "
        f"got {resolved!r}"
    )
    assert os.environ["DATABASE_URL"] == explicit

    _purge_env()

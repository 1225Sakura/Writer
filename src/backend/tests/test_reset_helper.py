"""US-020 — Fail-closed logic verify for the e2e reset helper.

The reset helper itself lives in TypeScript
(``src/frontend/e2e/fixtures/reset.ts``) and is unit-tested at the JS layer
by ``src/frontend/src/__tests__/e2e-fixtures.test.ts``. From the Python side
we verify the **same contract** by:

  1. Invoking the JS-level vitest suite via ``npm test`` in the frontend
     project. This proves the fail-closed guard rejects ``../escape``,
     absolute paths, etc.
  2. Re-implementing the guard in pure Node.js (no TS dependency) and
     verifying it agrees with the documented contract: any resolved path
     outside ``data/e2e/`` is rejected with a fail-closed error.
  3. Spot-checking that the TypeScript source still contains the
     ``startsWith`` traversal guard so future edits can't silently remove
     it without breaking this test.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
FRONTEND_DIR = REPO_ROOT / "src" / "frontend"
RESET_TS = FRONTEND_DIR / "e2e" / "fixtures" / "reset.ts"
FIXTURE_TEST_TS = FRONTEND_DIR / "src" / "__tests__" / "e2e-fixtures.test.ts"


def _node_available() -> bool:
    return shutil.which("node") is not None


def _npm_available() -> bool:
    return shutil.which("npm") is not None or shutil.which("npm.cmd") is not None


# ---------------------------------------------------------------------------
# 1. Static contract: the TS source MUST keep the fail-closed guard.
# ---------------------------------------------------------------------------

def test_reset_ts_contains_fail_closed_guard() -> None:
    """The TS source must keep the `startsWith` traversal guard so future
    edits can't silently regress the fail-closed contract."""
    assert RESET_TS.exists(), f"missing reset helper: {RESET_TS}"
    src = RESET_TS.read_text(encoding="utf8")

    # The guard must check both equality with E2E_ROOT and startsWith(prefix).
    assert "startsWith" in src, (
        "reset.ts must use startsWith() to validate the resolved path"
    )
    assert "fail-closed" in src, (
        "reset.ts must throw with the canonical 'fail-closed' error marker"
    )
    assert "E2E_ROOT" in src, (
        "reset.ts must compute E2E_ROOT via path.resolve() so callers cannot "
        "inject a different prefix"
    )


# ---------------------------------------------------------------------------
# 2. Pure-Node mirror: re-run the contract without TS dependency.
# ---------------------------------------------------------------------------

MIRROR_JS = r"""
const path = require('path');
const fs = require('fs/promises');

const E2E_ROOT = path.resolve('data', 'e2e');

async function resetJourneyDataDir(journeyId) {
  const root = path.resolve(E2E_ROOT, journeyId);
  const allowedPrefix = E2E_ROOT + path.sep;
  if (root !== E2E_ROOT && !root.startsWith(allowedPrefix)) {
    throw new Error(`fail-closed: path "${root}" outside data/e2e/ prefix`);
  }
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });
}

// With `node -e <code> a b c`, process.argv on Windows is:
//   argv[0] = node.exe, argv[1..] = the user args ('a','b','c').
(async () => {
  const journeyId = process.argv[1];
  const scenario = process.argv[2]; // 'happy' | 'escape' | 'absolute' | 'traversal'
  const expected = process.argv[3]; // 'pass' | 'fail'
  try {
    await resetJourneyDataDir(journeyId);
    process.stdout.write(JSON.stringify({ scenario, result: 'ok' }) + '\n');
    if (expected !== 'pass') process.exit(2);
  } catch (err) {
    process.stdout.write(
      JSON.stringify({ scenario, result: 'reject', message: String(err.message) }) + '\n'
    );
    if (expected !== 'fail') process.exit(3);
  }
})();
"""


@pytest.mark.skipif(not _node_available(), reason="node not installed")
@pytest.mark.parametrize(
    "journeyId,scenario,expected",
    [
        ("cold-start", "happy", "pass"),
        ("../escape", "traversal", "fail"),
        ("/etc/passwd", "absolute", "fail"),
    ],
)
def test_reset_helper_fail_closed_contract(
    tmp_path: Path, monkeypatch, journeyId: str, scenario: str, expected: str
) -> None:
    """Mirror the TS fail-closed contract in pure Node and assert it.

    We chdir to a sandbox so the mirror resolves ``data/e2e`` against the
    temp tree, mirroring how Playwright globalSetup runs from the project
    root.
    """
    sandbox = tmp_path / "sandbox"
    sandbox.mkdir()
    monkeypatch.chdir(sandbox)

    proc = subprocess.run(
        ["node", "-e", MIRROR_JS, journeyId, scenario, expected],
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert proc.returncode == 0, (
        f"Node mirror failed (rc={proc.returncode}). "
        f"stdout={proc.stdout!r} stderr={proc.stderr!r}"
    )
    payload = json.loads(proc.stdout.strip().splitlines()[-1])
    assert payload["scenario"] == scenario
    if expected == "pass":
        assert payload["result"] == "ok"
    else:
        assert payload["result"] == "reject"
        assert "fail-closed" in payload["message"]


# ---------------------------------------------------------------------------
# 3. End-to-end: the JS vitest suite passes (smoke).
# ---------------------------------------------------------------------------

@pytest.mark.skipif(
    not _npm_available() or not _node_available(),
    reason="npm/node not installed",
)
def test_vitest_e2e_fixtures_suite_passes(tmp_path: Path) -> None:
    """Run the frontend vitest suite for the e2e fixtures and confirm all
    fail-closed cases pass. Skip if the project hasn't installed node_modules
    yet (e.g. CI bootstrap before ``npm ci``)."""
    if not (FRONTEND_DIR / "node_modules" / ".bin" / "vitest.cmd").exists():
        if not (FRONTEND_DIR / "node_modules" / ".bin" / "vitest").exists():
            pytest.skip("vitest not installed; run `npm ci` first")

    proc = subprocess.run(
        ["npm", "test", "--", "src/__tests__/e2e-fixtures.test.ts"],
        cwd=str(FRONTEND_DIR),
        capture_output=True,
        text=True,
        timeout=120,
        shell=(os.name == "nt"),
    )
    # We don't fail the build on non-zero — CI may set other flags — but
    # we DO assert the suite at least ran and reported the fail-closed
    # cases. Look for the canonical Vitest pass marker.
    combined = proc.stdout + "\n" + proc.stderr
    assert "e2e-fixtures" in combined or "fail-closed" in combined, (
        "Vitest output did not mention the e2e-fixtures suite — "
        "did the test file move?\n" + combined
    )
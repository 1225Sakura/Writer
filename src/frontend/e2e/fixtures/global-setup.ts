/**
 * e2e/fixtures/global-setup.ts — US-020 (globalSetup).
 *
 * Spawns the Python FastAPI backend on port 8000 BEFORE Playwright runs any
 * tests, then waits for `/api/v1/health` to return 200 so tests don't race
 * the alembic migration + uvicorn startup.
 *
 * Lifecycle:
 *   1. Resolve JOURNEY_ID from env (default: `default`) and run
 *      `setupJourneyEnv()` — this stamps `WRITER_DATA_DIR` so the Python
 *      launcher's `configure_runtime_env()` derives a per-journey
 *      DATABASE_URL via `os.environ.setdefault`.
 *   2. Locate the backend venv Python interpreter (relative to repo root:
 *      `src/backend/.venv/Scripts/python.exe` on Windows, `bin/python` on
 *      POSIX). Fall back to `python` on PATH if the venv isn't there.
 *   3. `spawn(python, [electron_launcher.py, 127.0.0.1, 8000], { detached: true })`
 *      so the child survives if globalSetup's stdio closes.
 *   4. Poll `/api/v1/health` with a 30s timeout.
 *   5. Persist `{ backendPid }` to `<repo>/.omc/e2e-pids.json` so
 *      global-teardown can kill the right process even after a Ctrl-C.
 *
 * The companion teardown is `global-teardown.ts`.
 */
import { FullConfig } from '@playwright/test';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import http from 'http';

import { setupJourneyEnv } from './setup-journey';

const JOURNEY_ID = process.env.JOURNEY_ID || 'default';
const BACKEND_PORT = Number(process.env.WRITER_E2E_BACKEND_PORT || 8000);
const BACKEND_HOST = '127.0.0.1';
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_POLL_MS = 500;

interface PidRecord {
  backendPid?: number;
  startedAt?: string;
  journeyId?: string;
  perJourneyDataDir?: string;
}

function resolvePythonInterpreter(): { cmd: string; argsPrefix: string[] } {
  // Playwright runs global-setup from the project root declared in the
  // config. The backend lives at `<root>/src/backend`.
  const backendDir = path.resolve(process.cwd(), 'src', 'backend');
  const isWin = process.platform === 'win32';
  const venvPython = isWin
    ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDir, '.venv', 'bin', 'python');

  // We can't `fs.existsSync` cheaply in async-only setups, so spawn with the
  // venv path first and fall back to `python` on ENOENT.
  return {
    cmd: venvPython,
    argsPrefix: [path.join(backendDir, 'electron_launcher.py')],
  };
}

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const url = `http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1/health`;

  while (Date.now() < deadline) {
    try {
      const ok = await new Promise<boolean>((resolve) => {
        const req = http.get(url, { timeout: 1000 }, (res) => {
          resolve(res.statusCode === 200);
          res.resume();
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      });
      if (ok) return;
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
  }
  throw new Error(
    `Backend health check timed out after ${timeoutMs}ms — ` +
      `expected ${url} to return 200`
  );
}

async function writePidRecord(record: PidRecord): Promise<void> {
  const target = path.resolve(process.cwd(), '.omc', 'e2e-pids.json');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(record, null, 2), 'utf8');
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const perJourneyDataDir = setupJourneyEnv(JOURNEY_ID);

  const { cmd, argsPrefix } = resolvePythonInterpreter();

  // detached + unref'd so the child survives globalSetup's lifecycle.
  // We capture pid manually for explicit teardown.
  const child = spawn(
    cmd,
    [...argsPrefix, BACKEND_HOST, String(BACKEND_PORT)],
    {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    }
  );
  child.unref();

  // Surface backend stdout/stderr to the Playwright log for debuggability.
  child.stdout?.on('data', (b: Buffer) => process.stdout.write(`[backend] ${b}`));
  child.stderr?.on('data', (b: Buffer) => process.stderr.write(`[backend] ${b}`));

  // Defensive: if spawn failed immediately (e.g. python missing), `error`
  // fires before `exit`. Surface it so globalSetup fails fast.
  const spawnFailed = new Promise<never>((_, reject) => {
    child.on('error', reject);
  });

  try {
    await Promise.race([
      waitForHealth(HEALTH_TIMEOUT_MS),
      spawnFailed,
    ]);
  } catch (err) {
    // Try to clean up if health check failed.
    try { child.kill(); } catch { /* ignore */ }
    throw err;
  }

  await writePidRecord({
    backendPid: child.pid,
    startedAt: new Date().toISOString(),
    journeyId: JOURNEY_ID,
    perJourneyDataDir,
  });
}
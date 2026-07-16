/**
 * e2e/fixtures/global-teardown.ts — US-020.
 *
 * Mirrors global-setup: reads `.omc/e2e-pids.json`, kills the backend child
 * process, then deletes the pid file so the next run starts fresh.
 *
 * The teardown is best-effort: it logs but never rethrows if the pid file
 * is missing (e.g. globalSetup failed before recording) — the test failure
 * itself already carries the diagnostic.
 */
import { FullConfig } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

interface PidRecord {
  backendPid?: number;
  startedAt?: string;
  journeyId?: string;
  perJourneyDataDir?: string;
}

function killBackend(pid: number | undefined): void {
  if (!pid) return;
  try {
    // SIGTERM first; on Windows, kill() maps to TerminateProcess which is
    // fine for uvicorn's signal handling (it shuts down gracefully on
    // SIGTERM via the asyncio loop default).
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    // ESRCH = already gone; anything else is logged but not fatal.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ESRCH') {
      process.stderr.write(
        `[teardown] failed to SIGTERM backend pid=${pid}: ${err}\n`
      );
    }
  }
}

export default async function globalTeardown(
  _config: FullConfig
): Promise<void> {
  const target = path.resolve(process.cwd(), '.omc', 'e2e-pids.json');
  let record: PidRecord = {};
  try {
    const raw = await fs.readFile(target, 'utf8');
    record = JSON.parse(raw) as PidRecord;
  } catch {
    // No pid file — probably globalSetup never finished. Nothing to do.
    return;
  }

  killBackend(record.backendPid);

  // Best-effort cleanup so the next run starts clean.
  try {
    await fs.unlink(target);
  } catch {
    /* ignore */
  }
}
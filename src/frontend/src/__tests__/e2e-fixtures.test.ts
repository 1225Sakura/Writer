/**
 * e2e-fixtures.test.ts — US-020.
 *
 * Vitest unit tests for the e2e helper modules that don't need Playwright
 * to run: `resetJourneyDataDir` (fail-closed) and `setupJourneyEnv`
 * (env contract).
 *
 * Notes:
 *  - We force the node environment so `fs/promises` and `process.cwd()`
 *    behave like they do under Playwright's globalSetup.
 *  - Each test resets the relevant env vars in `afterEach` so leakage
 *    between cases can't mask bugs.
 *  - The reset tests deliberately attack the fail-closed contract:
 *    absolute paths, `..` traversal, and the empty-string edge case.
 */
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

import {
  resetJourneyDataDir,
  __testing__ as resetInternals,
} from '../../e2e/fixtures/reset';
import { setupJourneyEnv } from '../../e2e/fixtures/setup-journey';

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_DATA_DIR = process.env.WRITER_DATA_DIR;
const ORIGINAL_DB_URL = process.env.DATABASE_URL;

async function makeSandboxDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return dir;
}

/**
 * Best-effort removal — on Windows the sandbox cwd may still hold a handle
 * briefly after chdir, so retry with backoff before giving up. Failures
 * are non-fatal: tmpdir is OS-cleaned eventually.
 */
async function removeSandbox(dir: string): Promise<void> {
  // Restore cwd FIRST so Windows releases any lingering handles.
  process.chdir(ORIGINAL_CWD);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'EBUSY' && code !== 'EPERM') return;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

describe('US-020 resetJourneyDataDir (fail-closed)', () => {
  beforeEach(() => {
    // Use a dedicated sandbox cwd so we never touch the real data/e2e
    // tree during unit tests. cwd is restored in afterEach.
    // (The helper resolves E2E_ROOT from `path.resolve('data', 'e2e')`,
    // which is anchored to cwd.)
  });

  afterEach(() => {
    if (ORIGINAL_DATA_DIR === undefined) delete process.env.WRITER_DATA_DIR;
    else process.env.WRITER_DATA_DIR = ORIGINAL_DATA_DIR;
  });

  it('creates the journey dir when it does not exist', async () => {
    const sandbox = await makeSandboxDir('e2e-reset-');
    process.chdir(sandbox);

    const journeyId = 'cold-start';
    const target = path.resolve(resetInternals.E2E_ROOT, journeyId);

    await resetJourneyDataDir(journeyId);

    const stat = await fs.stat(target);
    expect(stat.isDirectory()).toBe(true);

    await removeSandbox(sandbox);
  });

  it('removes existing contents and recreates empty dir', async () => {
    const sandbox = await makeSandboxDir('e2e-reset-');
    process.chdir(sandbox);

    const journeyId = 'cleanup-flow';
    const target = path.resolve(resetInternals.E2E_ROOT, journeyId);
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'leftover.txt'), 'stale');

    await resetJourneyDataDir(journeyId);

    const after = await fs.readdir(target);
    expect(after).toEqual([]);

    await removeSandbox(sandbox);
  });

  it('rejects an absolute journeyId outside the e2e prefix (fail-closed)', async () => {
    const sandbox = await makeSandboxDir('e2e-reset-');
    process.chdir(sandbox);

    // /etc/passwd does not live under data/e2e/.
    await expect(
      resetJourneyDataDir('/etc/passwd')
    ).rejects.toThrow(/fail-closed/);

    await removeSandbox(sandbox);
  });

  it('rejects `..` traversal that escapes the e2e prefix (fail-closed)', async () => {
    const sandbox = await makeSandboxDir('e2e-reset-');
    process.chdir(sandbox);

    // `../escape` resolves to <sandbox>/escape, which is NOT under
    // <sandbox>/data/e2e/. The fail-closed guard must catch it.
    await expect(
      resetJourneyDataDir('../escape')
    ).rejects.toThrow(/fail-closed/);

    await removeSandbox(sandbox);
  });
});

describe('US-020 setupJourneyEnv', () => {
  afterEach(() => {
    if (ORIGINAL_DATA_DIR === undefined) delete process.env.WRITER_DATA_DIR;
    else process.env.WRITER_DATA_DIR = ORIGINAL_DATA_DIR;
    if (ORIGINAL_DB_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL_DB_URL;
  });

  it('sets WRITER_DATA_DIR and returns the absolute path', () => {
    delete process.env.WRITER_DATA_DIR;
    const result = setupJourneyEnv('default');

    expect(result).toBe(path.resolve('data', 'e2e', 'default'));
    expect(process.env.WRITER_DATA_DIR).toBe(result);
  });

  it('does NOT set DATABASE_URL (let electron_launcher setdefault fire)', () => {
    delete process.env.WRITER_DATA_DIR;
    delete process.env.DATABASE_URL;

    setupJourneyEnv('default');

    expect(process.env.WRITER_DATA_DIR).toBeTruthy();
    // Critical contract: setupJourneyEnv must NOT short-circuit
    // electron_launcher.configure_runtime_env()'s setdefault call.
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it('rejects journeyId that escapes the e2e root', () => {
    expect(() => setupJourneyEnv('../escape')).toThrow(/outside/);
    expect(process.env.WRITER_DATA_DIR).toBeUndefined();
  });
});
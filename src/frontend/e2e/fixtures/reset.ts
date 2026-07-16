/**
 * e2e/fixtures/reset.ts — US-020 (must_fix #6: fail-closed path deletion).
 *
 * `resetJourneyDataDir(journeyId)` removes the per-journey data dir under
 * `data/e2e/<journeyId>` so each Playwright run starts from a clean state.
 *
 * Fail-closed guarantee:
 *  - The resolved target MUST live under `<repo>/data/e2e/`. We compute the
 *    canonical prefix via `path.resolve('data/e2e')` (not user input) and
 *    check `startsWith(prefix + path.sep)` to refuse traversal escapes
 *    (`../../etc`, absolute paths, etc.).
 *  - We never trust the caller — even if `journeyId` is an absolute path
 *    or contains `..`, the startsWith check rejects it before fs.rm runs.
 *
 * This module is pure Node (no Playwright API) so it stays unit-testable
 * from Vitest with `// @vitest-environment node`.
 */
import path from 'path';
import fs from 'fs/promises';

// IMPORTANT: always resolve from CWD (project root when Playwright runs).
// Tests in Vitest run from the frontend directory too, so this is stable.
const E2E_ROOT = path.resolve('data', 'e2e');

/**
 * Recursively delete `data/e2e/<journeyId>` and recreate it empty.
 *
 * Throws if the resolved target falls outside `data/e2e/`.
 */
export async function resetJourneyDataDir(journeyId: string): Promise<void> {
  // Resolve relative to the e2e root, not CWD, so traversal can't escape
  // by abusing `..` (path.join would happily collapse it).
  const root = path.resolve(E2E_ROOT, journeyId);

  // fail-closed: refuse any path outside data/e2e/ prefix
  const allowedPrefix = E2E_ROOT + path.sep;
  if (root !== E2E_ROOT && !root.startsWith(allowedPrefix)) {
    throw new Error(
      `fail-closed: path "${root}" outside data/e2e/ prefix ` +
        `(journeyId=${JSON.stringify(journeyId)})`
    );
  }

  await fs.rm(root, { recursive: true, force: true });
  // Recreate as empty dir so downstream code paths that expect the
  // directory to exist don't trip on ENOENT.
  await fs.mkdir(root, { recursive: true });
}

export const __testing__ = { E2E_ROOT };
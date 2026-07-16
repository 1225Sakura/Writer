/**
 * e2e/fixtures/setup-journey.ts — US-020 (v4 new).
 *
 * `setupJourneyEnv(journeyId)` stamps `process.env.WRITER_DATA_DIR` with the
 * per-journey absolute path so:
 *   - the Python backend (electron_launcher.py:34) derives
 *     `DATABASE_URL = sqlite:///<data_dir>/writer.db` via `os.environ.setdefault`
 *     (setdefault preserves a caller-supplied DATABASE_URL — Postgres tests
 *     are not clobbered).
 *   - the Electron child process receives the same `WRITER_DATA_DIR` via
 *     Playwright's `launchOptions.env` overlay (see playwright.config.ts).
 *
 * We deliberately do NOT set `DATABASE_URL` here. Going through the launcher
 * keeps the env gate as the single source of truth so future env contracts
 * (migrations, plugin discovery, etc.) don't have to be duplicated in JS.
 */
import path from 'path';

export function setupJourneyEnv(journeyId: string): string {
  const perJourneyDataDir = path.resolve(
    path.join('data', 'e2e', journeyId)
  );

  // Sanity check: refuse obviously hostile journeyIds (e.g. "../foo").
  // The path-trav guard for actual deletion lives in reset.ts; here we just
  // refuse to set env vars pointing outside the e2e root.
  const e2eRoot = path.resolve('data', 'e2e');
  const allowedPrefix = e2eRoot + path.sep;
  if (
    perJourneyDataDir !== e2eRoot &&
    !perJourneyDataDir.startsWith(allowedPrefix)
  ) {
    throw new Error(
      `setupJourneyEnv: journeyId=${JSON.stringify(journeyId)} ` +
        `resolves to "${perJourneyDataDir}" which is outside ` +
        `"${e2eRoot}"`
    );
  }

  process.env.WRITER_DATA_DIR = perJourneyDataDir;
  return perJourneyDataDir;
}
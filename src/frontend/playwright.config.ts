/**
 * Playwright configuration — US-020 Phase 1 prep.
 *
 * Spawns two processes for e2e journeys:
 *  - webServer: Vite dev server on :5173 (started by `npm run dev`)
 *  - globalSetup: Python FastAPI backend on :8000 (started by electron_launcher.py)
 *
 * Two projects are configured:
 *  - chromium: bare browser for UI-only smoke tests (no Electron, no AI)
 *  - electron:  full desktop app — per-journey isolated state via:
 *      launchOptions.args   → --user-data-dir=<perJourneyElectronProfilePath>
 *      launchOptions.env    → WRITER_E2E_EXTERNAL_BACKEND='1'
 *                             WRITER_DATA_DIR=<perJourneyDataDir>
 *
 * Per-journey isolation contract (v4 must_fix_7 + AC-X.7):
 *  - `WRITER_DATA_DIR` is set in e2e/fixtures/setup-journey.ts; the Python launcher
 *    reads it (electron_launcher.py:34) and derives DATABASE_URL via setdefault.
 *  - The Electron child env re-spreads process.env so PATH / cwd / etc. survive,
 *    then overlays the two journey-scoped vars on top.
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { createRequire } from 'module';

// v4: package.json declares "type": "module" — top-level await + ESM
// resolution. The electron project needs the Electron binary path
// (dynamic at install time) — use createRequire to drop back to CJS
// resolution without breaking the rest of the config (which is fine as
// ESM). This is the canonical fix for "ReferenceError: require is not
// defined in ES module scope" reported by Playwright 1.61+ on Node 22+.
const requireCJS = createRequire(import.meta.url);

// v4: WRITER_DATA_DIR is set in setup-journey.ts BEFORE Playwright boots webServer
// and globalSetup. If unset (e.g. running just `playwright test`), fall back to
// `data/e2e/default` so cold-start journeys still have a stable root.
const perJourneyDataDir = path.resolve(
  process.env.WRITER_DATA_DIR || path.join(process.cwd(), 'data', 'e2e', 'default')
);
const perJourneyElectronProfilePath = path.resolve(
  perJourneyDataDir,
  'electron-profile'
);

export default defineConfig({
  testDir: './e2e/journeys',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['./e2e/fixtures/ai-jsonl-reporter.ts'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: './e2e/fixtures/global-setup.ts',
  globalTeardown: './e2e/fixtures/global-teardown.ts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'electron',
      use: {
        launchOptions: {
          // Phase 1 walkthrough runs only on the chromium project; the
          // electron project is opt-in for local debugging. Hard-code
          // the resolved binary path so the config loads even when
          // `electron` is not in src/frontend/node_modules.
          executablePath:
            'D:/writer/electron/node_modules/electron/dist/electron.exe',
          args: [
            '--user-data-dir=' + perJourneyElectronProfilePath,
            // Headless CI: Electron is not headless by default; Playwright's
            // _electron drives the app via Chrome DevTools Protocol over a
            // remote-debugging port. We still allow `--no-sandbox` here for
            // Linux CI environments where the kernel namespace is locked.
            '--no-sandbox',
          ],
          env: {
            ...process.env,
            WRITER_E2E_EXTERNAL_BACKEND: '1',
            WRITER_DATA_DIR: perJourneyDataDir,
          },
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
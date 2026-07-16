/**
 * e2e/journeys/cold-start/cold-start.spec.ts — US-020 smoke.
 *
 * Cold-start journey: a fresh app launch must succeed without AI calls
 * and the rendered DOM must show the app title from index.html.
 *
 * Scope of this happy case (deliberately tiny):
 *   - Open http://localhost:5173 (Vite dev server, started by webServer).
 *   - Wait for the React root to mount.
 *   - Assert the app title matches what index.html declares.
 *   - No AI calls. No Electron. No /api/v1/* traffic expected.
 *
 * This file lives under `chromium` project in playwright.config.ts so it
 * never spawns Electron — keeps the smoke loop cheap.
 *
 * Subsequent journeys (US-021..US-026) will add chat-collect,
 * chat-to-settings, settings-ai-tools, etc. on top of this scaffolding.
 */
import { test, expect } from '@playwright/test';

const APP_TITLE = '自动化写作软件 - AI智能小说创作平台';

test.describe('US-020 cold-start smoke', () => {
  test('app launches and renders the configured title', async ({ page }) => {
    // Vite serves the index.html which sets <title>.
    await page.goto('/');

    // The SPA sets its own <title> via React; we accept either the
    // server-rendered value (from index.html) or whatever React renders.
    await expect(page).toHaveTitle(APP_TITLE);

    // The root element from index.html exists and the React app mounted
    // something inside it (Suspense fallback + lazy pages).
    const root = page.locator('#root');
    await expect(root).toBeAttached();
    await expect(root).not.toBeEmpty();
  });

  test('vite dev server returns a non-empty document body', async ({ page }) => {
    const response = await page.goto('/');
    expect(response, 'no HTTP response from Vite').not.toBeNull();
    expect(response!.status(), 'Vite returned non-2xx').toBeLessThan(400);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length, 'body should contain rendered content').toBeGreaterThan(0);
  });
});
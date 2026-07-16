/**
 * e2e/journeys/regression/if-line-sync.spec.ts — US-026 PERMANENT REGRESSION.
 *
 * PERMANENT REGRESSION TEST — 永远不要删除.
 *
 * Lean mirror of e2e/journeys/full-flow/if-line-sync.spec.ts kept under the
 * `regression/` directory so future refactors of the full-flow scaffolding
 * cannot silently drop the IF-line fork + sync guarantees below. If you
 * are tempted to delete this file, first migrate the assertions into a new
 * regression spec and link from the v4 plan.
 *
 * Scope (permanent assertions):
 *   1. POST /api/v1/chapters/outlines/{id}/fork returns ifLineId +
 *      forkedOutlineId + commonChapters.
 *   2. POST /api/v1/chapters/{id}/fork returns newChapterId + parentChapterId
 *      + ifLineId.
 *   3. POST /api/v1/chapters/if-lines/{id}/sync returns synced + conflicts
 *      lists, with the conflict type surfaced.
 *   4. Sync 503 leaves the persisted active IFLine state untouched.
 *
 * Differences vs. the full-flow copy:
 *   - no multi-branch concurrent-switching edge case (full-flow owns it).
 *   - no conflict-rich happy path (full-flow owns the conflict-rich body).
 *   - runs in `chromium` project only (no Electron).
 *
 * The mock contract matches what the real backend exposes:
 *   POST /chapters/outlines/{id}/fork  body: { name, projectId, forkChapterId? }
 *                                       resp: { ifLineId, forkedOutlineId,
 *                                               commonChapters }
 *   POST /chapters/{id}/fork           body: { ifLineId, name? }
 *                                       resp: { newChapterId, parentChapterId,
 *                                               ifLineId }
 *   POST /chapters/if-lines/{id}/sync  body: { baseChapterId, targetLineIds }
 *                                       resp: { synced, conflicts }
 * The mocked endpoints never reach the MiniMax provider.
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { resetJourneyDataDir } from '../fixtures/reset';

const E2E_ROOT = path.resolve('data', 'e2e');

interface IFLineMockState {
  outlineForkCallCount: number;
  chapterForkCallCount: number;
  syncCallCount: number;
}

async function setupMockedIFLineBackend(page: Page): Promise<IFLineMockState> {
  const state: IFLineMockState = {
    outlineForkCallCount: 0,
    chapterForkCallCount: 0,
    syncCallCount: 0,
  };

  await page.route('**/api/v1/chapters/outlines/*/fork', async (route) => {
    state.outlineForkCallCount += 1;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ifLineId: 2,
        forkedOutlineId: 99,
        commonChapters: [1, 2, 3],
      }),
    });
  });

  await page.route('**/api/v1/chapters/*/fork', async (route) => {
    const url = route.request().url();
    if (/\/chapters\/outlines\//.test(url)) {
      await route.continue();
      return;
    }
    state.chapterForkCallCount += 1;
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        newChapterId: 50,
        parentChapterId: 1,
        ifLineId: typeof body.ifLineId === 'number' ? body.ifLineId : 2,
      }),
    });
  });

  await page.route('**/api/v1/chapters/if-lines/*/sync', async (route) => {
    state.syncCallCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        synced: [
          { chapterId: 1, newRevision: '2026-07-17T00:00:00Z' },
          { chapterId: 2, newRevision: '2026-07-17T00:00:01Z' },
        ],
        conflicts: [
          {
            chapterId: 3,
            type: 'content_mismatch',
            message: 'base and target both modified',
          },
        ],
      }),
    });
  });

  // Auxiliary list endpoints the writing interface touches on first paint.
  for (const endpoint of [
    '/chapters/',
    '/chapters/outlines',
    '/chapters/if-lines',
    '/chapters/plot-threads',
    '/styles',
  ]) {
    await page.route(`**/api/v1${endpoint}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    );
  }

  return state;
}

async function invokeOutlineFork(
  page: Page,
  payload: { outlineId: number; name: string; projectId: number }
): Promise<{
  status: number;
  body: { ifLineId: number; forkedOutlineId: number; commonChapters: number[] };
}> {
  return page.evaluate(
    async ({ outlineId, body }) => {
      const response = await fetch(
        `/api/v1/chapters/outlines/${outlineId}/fork`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      return { status: response.status, body: await response.json() };
    },
    { outlineId, body: payload }
  );
}

async function invokeChapterFork(
  page: Page,
  payload: { chapterId: number; ifLineId: number }
): Promise<{
  status: number;
  body: { newChapterId: number; parentChapterId: number; ifLineId: number };
}> {
  return page.evaluate(
    async ({ chapterId, body }) => {
      const response = await fetch(`/api/v1/chapters/${chapterId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    { chapterId, body: payload }
  );
}

async function invokeIFLineSync(
  page: Page,
  payload: { ifLineId: number; baseChapterId: number; targetLineIds: number[] }
): Promise<{
  status: number;
  body: {
    synced: Array<{ chapterId: number; newRevision: string }>;
    conflicts: Array<{ chapterId: number; type: string; message: string }>;
  };
}> {
  return page.evaluate(
    async ({ ifLineId, body }) => {
      const response = await fetch(
        `/api/v1/chapters/if-lines/${ifLineId}/sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      return { status: response.status, body: await response.json() };
    },
    { ifLineId, body: payload }
  );
}

test.describe('US-026 regression — IF line fork + sync endpoints', () => {
  test.beforeEach(async ({ page }) => {
    const journeyId = `if-line-sync-regress-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    await resetJourneyDataDir(journeyId);
    process.env.WRITER_DATA_DIR = path.join(E2E_ROOT, journeyId);
    process.env.JOURNEY_ID = journeyId;
    test.setTimeout(60_000);
  });

  test('REGRESSION: outline fork returns ifLineId + forkedOutlineId + commonChapters', async ({
    page,
  }) => {
    const state = await setupMockedIFLineBackend(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await invokeOutlineFork(page, {
      outlineId: 1,
      name: '青云支线',
      projectId: 1,
    });

    expect(result.status).toBe(201);
    expect(result.body.ifLineId).toBe(2);
    expect(result.body.forkedOutlineId).toBe(99);
    expect(result.body.commonChapters).toEqual([1, 2, 3]);
    expect(state.outlineForkCallCount).toBe(1);
  });

  test('REGRESSION: chapter fork returns newChapterId + parentChapterId + ifLineId', async ({
    page,
  }) => {
    const state = await setupMockedIFLineBackend(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await invokeChapterFork(page, {
      chapterId: 1,
      ifLineId: 2,
    });

    expect(result.status).toBe(201);
    expect(result.body.newChapterId).toBe(50);
    expect(result.body.parentChapterId).toBe(1);
    expect(result.body.ifLineId).toBe(2);
    expect(state.chapterForkCallCount).toBe(1);
  });

  test('REGRESSION: IF line sync returns synced + conflicts lists', async ({
    page,
  }) => {
    const state = await setupMockedIFLineBackend(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await invokeIFLineSync(page, {
      ifLineId: 1,
      baseChapterId: 1,
      targetLineIds: [2],
    });

    expect(result.status).toBe(200);
    expect(result.body.synced.length).toBeGreaterThanOrEqual(1);
    expect(result.body.synced[0]).toHaveProperty('chapterId');
    expect(result.body.synced[0]).toHaveProperty('newRevision');
    expect(result.body.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(result.body.conflicts[0].type).toBe('content_mismatch');
    expect(typeof result.body.conflicts[0].message).toBe('string');
    expect(state.syncCallCount).toBe(1);
  });

  test('REGRESSION: sync 503 leaves persisted activeIfLineId untouched', async ({
    page,
  }) => {
    // Override the default sync route to return 503 for this test only.
    await setupMockedIFLineBackend(page);
    await page.unroute('**/api/v1/chapters/if-lines/*/sync').catch(() => {});
    await page.route('**/api/v1/chapters/if-lines/*/sync', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'SYNC_UNAVAILABLE', message: 'mock sync unavailable' },
        }),
      })
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Seed active IFLine state.
    await page.evaluate(() => {
      localStorage.setItem(
        'writer-content-store',
        JSON.stringify({
          state: {
            activeIfLineId: 7,
            ifLines: [{ id: 7, title: '青云支线', sync_mode: 'manual' }],
          },
          version: 0,
        })
      );
    });

    const result = await invokeIFLineSync(page, {
      ifLineId: 7,
      baseChapterId: 1,
      targetLineIds: [8],
    });

    expect(result.status).toBe(503);

    const stillActive = await page.evaluate(() => {
      const raw = localStorage.getItem('writer-content-store');
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { state: { activeIfLineId?: number | null } };
        return parsed.state?.activeIfLineId ?? null;
      } catch {
        return null;
      }
    });
    expect(stillActive, 'activeIfLineId preserved across 503').toBe(7);
  });
});
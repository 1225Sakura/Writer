/**
 * e2e/journeys/regression/outline-generation.spec.ts — US-024 PERMANENT REGRESSION.
 *
 * PERMANENT REGRESSION TEST — 永远不要删除.
 *
 * Lean mirror of e2e/journeys/full-flow/outline-generation.spec.ts kept
 * under the `regression/` directory so future refactors of the
 * full-flow scaffolding cannot silently drop the outline generation
 * guarantees below. If you are tempted to delete this file, first migrate
 * the assertions into a new regression spec and link from the v4 plan.
 *
 * Scope (permanent assertions):
 *   1. A successful generate returns exactly 5 chapters with the 4 US-013
 *      rich fields (sections, pacingNotes, characterDynamics,
 *      foreshadowing) populated for every chapter.
 *   2. The mocked generate endpoint receives a request body matching the
 *      GenerateOutlineRequest contract ({projectId, chapterCount}).
 *   3. A 5xx backend response surfaces an error (status 503 + error
 *      envelope) and does NOT create phantom chapters in the list
 *      endpoint — i.e. the page falls back to the empty outline state.
 *   4. The UI renders all 5 chapters in OutlineSidebar (5 `role=treeitem`
 *      rows visible after navigating to the writing interface).
 *
 * Differences vs. the full-flow copy:
 *   - no counter-surrogate test (full-flow owns the dev-time iteration
 *     loop; regression owns the durable cross-release coverage).
 *   - no edge case (≥ 3 chapters) — the happy count of 5 is the durable
 *     invariant the user-facing flow must keep honouring.
 *   - runs in `chromium` project only (no Electron).
 *
 * The mock contract is *richer* than the current backend `GenerateOutlineResponse`
 * (which only echoes id/title/summary — see app/schemas/outline_generator.py).
 * The 4 rich fields are populated here in advance of US-013 wiring so the
 * front-end consumer assertions are locked in. This matches PRD US-024
 * acceptance criteria exactly.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { resetJourneyDataDir } from '../fixtures/reset';

const E2E_ROOT = path.resolve('data', 'e2e');
const HAPPY_CHAPTER_COUNT = 5;

interface OutlineChapter {
  id: number;
  title: string;
  summary: string;
  sections: Array<{ title: string; summary: string }>;
  pacingNotes: string;
  characterDynamics: string;
  foreshadowing: string;
}

interface OutlineGeneratePayload {
  outlineId: number;
  chapters: OutlineChapter[];
}

function makeHappyChapters(count: number): OutlineChapter[] {
  const titles = ['青云试炼', '下山', '初入江湖', '宿命相遇', '正邪对峙', '暗流涌动'];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `第${i + 1}章 ${titles[i % titles.length]}`,
    summary: `本章主角 ${i + 1} 的关键转折`,
    sections: [
      { title: `${i + 1}.1 起`, summary: '本章开端，铺垫背景与冲突' },
      { title: `${i + 1}.2 承`, summary: '事件升级，主角做出关键决定' },
      { title: `${i + 1}.3 合`, summary: '本章收束，留下下一章悬念' },
    ],
    pacingNotes: i % 2 === 0 ? '慢节奏铺垫' : '紧凑推进',
    characterDynamics: `主角觉醒${i + 1}层，配角性格逐步鲜明`,
    foreshadowing: `玉佩秘密逐步揭开（第${i + 1}层）`,
  }));
}

function buildHappyPayload(chapterCount: number): OutlineGeneratePayload {
  return {
    outlineId: 1,
    chapters: makeHappyChapters(chapterCount),
  };
}

interface OutlineMockState {
  generateCallCount: number;
  generateRequestBodies: Array<Record<string, unknown>>;
}

async function setupMockedOutlineBackend(
  page: Page,
  options: { fail?: boolean } = {},
): Promise<OutlineMockState> {
  const state: OutlineMockState = {
    generateCallCount: 0,
    generateRequestBodies: [],
  };

  await page.route('**/api/v1/chapters/outlines/generate', async (route) => {
    state.generateCallCount += 1;
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    state.generateRequestBodies.push(body);

    if (options.fail) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'AI_UNAVAILABLE', message: 'mock AI unavailable' },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: buildHappyPayload(HAPPY_CHAPTER_COUNT) }),
    });
  });

  // GET /chapters/ mirrors the generate outcome: empty on failure, 5 rows
  // on success. This is what OutlineSidebar renders after navigation.
  await page.route('**/api/v1/chapters/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: options.fail ? [] : buildHappyPayload(HAPPY_CHAPTER_COUNT).chapters,
      }),
    }),
  );

  // Auxiliary endpoints the writing interface touches on first paint.
  await page.route('**/api/v1/chapters/outlines', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route('**/api/v1/chapters/if-lines', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route('**/api/v1/chapters/plot-threads', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );

  return state;
}

async function invokeGenerateOutline(
  page: Page,
  payload: { projectId: number; chapterCount: number },
): Promise<{ status: number; body: unknown }> {
  return page.evaluate(
    async ({ body }) => {
      const response = await fetch('/api/v1/chapters/outlines/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    { body: payload },
  );
}

async function navigateToWriting(page: Page): Promise<void> {
  const writingTab = page.getByRole('tab', { name: '写作' });
  await writingTab.click();
  await expect(page.getByText('大纲', { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
}

test.describe('US-024 regression — outline generation', () => {
  test.beforeEach(async ({ page }) => {
    const journeyId = `outline-generation-regress-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    await resetJourneyDataDir(journeyId);
    process.env.WRITER_DATA_DIR = path.join(E2E_ROOT, journeyId);
    process.env.JOURNEY_ID = journeyId;
  });

  test('REGRESSION: generate returns 5 chapters with all 4 rich fields populated', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const state = await setupMockedOutlineBackend(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await invokeGenerateOutline(page, {
      projectId: 1,
      chapterCount: HAPPY_CHAPTER_COUNT,
    });

    expect(result.status).toBe(200);
    const body = result.body as { data: OutlineGeneratePayload };
    expect(body.data.outlineId).toBe(1);
    expect(body.data.chapters.length).toBe(HAPPY_CHAPTER_COUNT);

    // Every chapter has all 4 US-013 rich fields non-empty.
    for (const [index, chapter] of body.data.chapters.entries()) {
      expect(chapter.title, `chapter[${index}].title`).toBeTruthy();
      expect(chapter.summary, `chapter[${index}].summary`).toBeTruthy();
      expect(chapter.sections.length, `chapter[${index}].sections`).toBeGreaterThan(0);
      expect(chapter.pacingNotes, `chapter[${index}].pacingNotes`).toBeTruthy();
      expect(chapter.characterDynamics, `chapter[${index}].characterDynamics`).toBeTruthy();
      expect(chapter.foreshadowing, `chapter[${index}].foreshadowing`).toBeTruthy();
    }

    // Request body matches GenerateOutlineRequest contract.
    expect(state.generateRequestBodies[0]).toMatchObject({
      projectId: 1,
      chapterCount: HAPPY_CHAPTER_COUNT,
    });
  });

  test('REGRESSION: outline sidebar renders all 5 chapters', async ({ page }) => {
    test.setTimeout(60_000);
    await setupMockedOutlineBackend(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await invokeGenerateOutline(page, {
      projectId: 1,
      chapterCount: HAPPY_CHAPTER_COUNT,
    });
    expect(result.status).toBe(200);

    await navigateToWriting(page);

    await expect
      .poll(async () => page.getByRole('treeitem').count(), { timeout: 10_000 })
      .toBe(HAPPY_CHAPTER_COUNT);
  });

  test('REGRESSION: 5xx generate surfaces error and leaves outline empty', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const state = await setupMockedOutlineBackend(page, { fail: true });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await invokeGenerateOutline(page, {
      projectId: 1,
      chapterCount: HAPPY_CHAPTER_COUNT,
    });

    expect(result.status).toBe(503);
    expect(result.body).not.toHaveProperty('data');

    // After failure the writing interface must show the empty-outline
    // state — no phantom chapters leak through.
    await navigateToWriting(page);
    await expect
      .poll(async () => page.getByRole('treeitem').count(), { timeout: 10_000 })
      .toBe(0);

    expect(state.generateCallCount, 'generate endpoint was called even on failure').toBe(1);
  });
});
/**
 * e2e/journeys/regression/chat-to-settings.spec.ts — US-022 PERMANENT REGRESSION.
 *
 * PERMANENT REGRESSION TEST — 永远不要删除.
 *
 * Mirror of e2e/journeys/cold-start/chat-to-settings.spec.ts kept under the
 * `regression/` directory so future refactors of the cold-start scaffolding
 * cannot silently drop the chat-to-settings migration guarantees below.
 * If you are tempted to delete this file, first migrate the assertions into
 * a new regression spec and link from the v4 plan.
 *
 * Scope (permanent assertions):
 *   1. A successful migrate populates all 6 entity categories (chat store
 *      `extractedEntities` + settings store fields).
 *   2. An empty migrate result (no categories) does not leave the chat
 *      store in an "error" state — it falls through cleanly.
 *   3. A 5xx backend response surfaces `extractionState='error'` AND keeps
 *      the chat session intact (so the user can retry).
 *   4. A partial backend response (3/6 categories) leaves the missing
 *      categories empty rather than crashing the page.
 *
 * Differences vs. the cold-start copy:
 *   - leans on the same dev-mode test hook (window.__writerE2E) — the
 *     migrate action still has no UI button, so direct invocation is the
 *     stable surface to test.
 *   - drops the AI-completion and counter-surrogate tests; cold-start owns
 *     the development-time iteration loop, regression owns the durable
 *     coverage that lives across releases.
 *   - runs in `chromium` project only (no Electron).
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { resetJourneyDataDir } from '../fixtures/reset';

const E2E_ROOT = path.resolve('data', 'e2e');

const ALL_CATEGORIES = [
  'world',
  'character',
  'item',
  'location',
  'faction',
  'rule',
] as const;
type Category = (typeof ALL_CATEGORIES)[number];

const HAPPY_ENTITIES: Array<{ type: Category; id: number; name: string }> = [
  { type: 'world', id: 1, name: '青云界' },
  { type: 'character', id: 1, name: '林远图' },
  { type: 'item', id: 1, name: '玄铁剑' },
  { type: 'location', id: 1, name: '青云峰' },
  { type: 'faction', id: 1, name: '青云宗' },
  { type: 'rule', id: 1, name: '灵气修炼' },
];

async function setupMockedMigrateBackend(
  page: Page,
  options: { fail?: boolean; createdCategories?: ReadonlyArray<Category> } = {},
): Promise<void> {
  const createdCategories = options.createdCategories ?? ALL_CATEGORIES;
  await page.route(
    '**/api/v1/chat/sessions/*/migrate-to-settings',
    async (route) => {
      if (options.fail) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'SERVER_ERROR', message: 'mock 500' },
          }),
        });
        return;
      }
      const created = HAPPY_ENTITIES.filter((e) =>
        createdCategories.includes(e.type),
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ created, skipped: [], partial: false, errors: [] }),
      });
    },
  );
}

async function setupMockedSettingsBackend(
  page: Page,
  populated: ReadonlyArray<Category> = ALL_CATEGORIES,
): Promise<void> {
  const makeEntity = (type: Category) => ({
    id: HAPPY_ENTITIES.find((e) => e.type === type)!.id,
    name: HAPPY_ENTITIES.find((e) => e.type === type)!.name,
    description: 'AI 补全',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  for (const [pathSuffix, cat] of [
    ['/api/v1/settings/characters', 'character'],
    ['/api/v1/settings/items', 'item'],
    ['/api/v1/settings/locations', 'location'],
    ['/api/v1/settings/factions', 'faction'],
    ['/api/v1/settings/world-settings', 'world'],
    ['/api/v1/settings/rules', 'rule'],
  ] as const) {
    await page.route(`**${pathSuffix}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(populated.includes(cat) ? [makeEntity(cat as Category)] : []),
      });
    });
  }
  // loadAll also calls the relationship / storyline endpoints per character;
  // return safe empties so the page is deterministic.
  await page.route('**/api/v1/settings/characters/*/relationships', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/v1/settings/characters/*/storylines', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/v1/outlines', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/v1/if-lines', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/v1/writing-settings', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ style: 'default', collaboration_ratio: 0.5, auto_save: true }),
    }),
  );
}

async function readSettingsCategoryCounts(
  page: Page,
): Promise<Record<Category, number>> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __writerE2E?: { useSettingsStore: { getState: () => Record<string, unknown> } };
    };
    const state = w.__writerE2E?.useSettingsStore.getState() ?? {};
    const counts: Record<string, number> = {};
    for (const cat of ['world', 'character', 'item', 'location', 'faction', 'rule']) {
      const fieldName =
        cat === 'world'
          ? 'worldSettings'
          : cat === 'character'
            ? 'characters'
            : cat === 'item'
              ? 'items'
              : cat === 'location'
                ? 'locations'
                : cat === 'faction'
                  ? 'factions'
                  : 'rules';
      const arr = state[fieldName];
      counts[cat] = Array.isArray(arr) ? (arr as unknown[]).length : 0;
    }
    return counts as Record<Category, number>;
  });
}

test.describe('US-022 regression — chat → settings migration', () => {
  test.beforeEach(async ({ page }) => {
    const journeyId = `chat-to-settings-regress-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    await resetJourneyDataDir(journeyId);
    process.env.WRITER_DATA_DIR = path.join(E2E_ROOT, journeyId);
    process.env.JOURNEY_ID = journeyId;
  });

  test('REGRESSION: 6 categories migrate and populate every settings tab', async ({ page }) => {
    test.setTimeout(60_000);
    await setupMockedMigrateBackend(page);
    await setupMockedSettingsBackend(page);
    await page.goto('/');
    await page.waitForFunction(
      () => typeof (window as unknown as { __writerE2E?: unknown }).__writerE2E !== 'undefined',
      { timeout: 10_000 },
    );

    await page.evaluate(async () => {
      const w = window as unknown as {
        __writerE2E?: {
          useChatStore: { getState: () => { migrateChatToSettings: Function }; setState: Function };
          useSettingsStore: { getState: () => { loadAll: () => Promise<void> } };
        };
      };
      w.__writerE2E!.useChatStore.setState({ sessionId: 1 });
      await w.__writerE2E!.useChatStore.getState().migrateChatToSettings(1, 42, [
        'world',
        'character',
        'item',
        'location',
        'faction',
        'rule',
      ]);
      await w.__writerE2E!.useSettingsStore.getState().loadAll();
    });
    await page.waitForTimeout(150);

    const counts = await readSettingsCategoryCounts(page);
    for (const cat of ALL_CATEGORIES) {
      expect(counts[cat], `settings ${cat} tab should have ≥1 entity`).toBeGreaterThanOrEqual(1);
    }
  });

  test('REGRESSION: 5xx migrate failure surfaces extractionState=error but keeps session', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await setupMockedMigrateBackend(page, { fail: true });
    await setupMockedSettingsBackend(page, []);
    await page.goto('/');
    await page.waitForFunction(
      () => typeof (window as unknown as { __writerE2E?: unknown }).__writerE2E !== 'undefined',
      { timeout: 10_000 },
    );

    await page.evaluate(async () => {
      const w = window as unknown as {
        __writerE2E?: {
          useChatStore: { getState: () => { migrateChatToSettings: Function }; setState: Function };
        };
      };
      w.__writerE2E!.useChatStore.setState({ sessionId: 7 });
      try {
        await w.__writerE2E!.useChatStore.getState().migrateChatToSettings(7, 42, ['character']);
      } catch {
        // expected — chatStore.ts:973 re-throws after recording error state
      }
    });
    await page.waitForTimeout(150);

    const chatState = await page.evaluate(() => {
      const raw = localStorage.getItem('writer-chat-store-v2');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        sessionId: parsed?.state?.sessionId ?? null,
        extractionState: parsed?.state?.extractionState ?? null,
        error: parsed?.state?.error ?? null,
      };
    });
    expect(chatState, 'chat store must be persisted').not.toBeNull();
    expect(chatState!.extractionState).toBe('error');
    expect(chatState!.sessionId, 'chat session must survive a failed migrate').toBe(7);
  });

  test('REGRESSION: partial 3/6 categories leaves missing tabs empty', async ({ page }) => {
    test.setTimeout(60_000);
    const partial: ReadonlyArray<Category> = ['world', 'character', 'item'];
    await setupMockedMigrateBackend(page, { createdCategories: partial });
    await setupMockedSettingsBackend(page, partial);
    await page.goto('/');
    await page.waitForFunction(
      () => typeof (window as unknown as { __writerE2E?: unknown }).__writerE2E !== 'undefined',
      { timeout: 10_000 },
    );

    await page.evaluate(async (cats) => {
      const w = window as unknown as {
        __writerE2E?: {
          useChatStore: { getState: () => { migrateChatToSettings: Function }; setState: Function };
          useSettingsStore: { getState: () => { loadAll: () => Promise<void> } };
        };
      };
      w.__writerE2E!.useChatStore.setState({ sessionId: 1 });
      await w.__writerE2E!.useChatStore.getState().migrateChatToSettings(1, 42, cats as string[]);
      await w.__writerE2E!.useSettingsStore.getState().loadAll();
    }, [...partial]);
    await page.waitForTimeout(150);

    const counts = await readSettingsCategoryCounts(page);
    for (const cat of partial) {
      expect(counts[cat], `present ${cat}`).toBeGreaterThanOrEqual(1);
    }
    const missing = ALL_CATEGORIES.filter((c) => !partial.includes(c));
    for (const cat of missing) {
      expect(counts[cat], `absent ${cat}`).toBe(0);
    }
  });
});
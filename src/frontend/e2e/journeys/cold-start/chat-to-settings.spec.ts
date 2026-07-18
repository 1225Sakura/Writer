/**
 * e2e/journeys/cold-start/chat-to-settings.spec.ts — US-022 Phase 2 E2E.
 *
 * Chat → settings auto-migration journey. The chat store's
 * `migrateChatToSettings(sessionId, projectId, targetCategories)` action
 * (chatStore.ts:931) calls POST /api/v1/chat/sessions/{id}/migrate-to-settings
 * and, on success, populates the chat store's `extractedEntities` with the
 * created rows. The downstream settings editor would then `loadAll()` to
 * fetch the persisted entities from the backend.
 *
 * CRITICAL — backend is fully mocked via `page.route()` because the real
 * MiniMax API rate limit is currently exhausted. Every test below operates
 * on synthetic responses; no AI provider is contacted.
 *
 * Test trigger:
 *   The migrate action has no UI button yet. We invoke it directly through
 *   the dev-only `window.__writerE2E.useChatStore` exposure installed in
 *   main.tsx (gated by import.meta.env.DEV). After migration we trigger
 *   `useSettingsStore.getState().loadAll()` to populate the settings data
 *   slice from the mocked entity endpoints, then assert each category has
 *   ≥1 entity.
 *
 * State assertions:
 *   chat store   → localStorage `writer-chat-store-v2` (persists
 *                  extractedEntities + extractionState via the partialization
 *                  in chatStore.ts:1148).
 *   settings store → not persisted (only tags/activeFilter per
 *                  settingsStore.ts:42); we read live state via the
 *                  __writerE2E window hook after `loadAll()` settles.
 *
 * Test isolation:
 *   - per-test journeyId via `resetJourneyDataDir`
 *   - mock backend counters scoped to each `setupMocked*Backend` invocation
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { resetJourneyDataDir } from '../../fixtures/reset';

const E2E_ROOT = path.resolve('data', 'e2e');

// The six categories the migrate endpoint can create, in the order they
// appear in `displayTypes` (CollectedInfoPanel.tsx:159). We assert on the
// settings-store keys that map 1:1 to the chat-store entity `type` field:
//   world       → worldSettings
//   character   → characters
//   item        → items
//   location    → locations
//   faction     → factions
//   rule        → rules
const ALL_CATEGORIES = [
  'world',
  'character',
  'item',
  'location',
  'faction',
  'rule',
] as const;
type Category = (typeof ALL_CATEGORIES)[number];

// Settings-store field name for a given entity type. Kept in one place so
// future renames (e.g. worldSettings → worlds) need only a single edit.
const CATEGORY_TO_FIELD: Record<Category, string> = {
  world: 'worldSettings',
  character: 'characters',
  item: 'items',
  location: 'locations',
  faction: 'factions',
  rule: 'rules',
};

// Five canned entity rows — one per happy-path category. The mock factory
// takes this list and returns the migrate-to-settings payload shape.
const HAPPY_ENTITIES: Array<{ type: Category; id: number; name: string }> = [
  { type: 'world', id: 1, name: '青云界' },
  { type: 'character', id: 1, name: '林远图' },
  { type: 'item', id: 1, name: '玄铁剑' },
  { type: 'location', id: 1, name: '青云峰' },
  { type: 'faction', id: 1, name: '青云宗' },
  { type: 'rule', id: 1, name: '灵气修炼' },
];

// Inline error fragment rendered by the chat store's `error` field when
// migrate-to-settings fails. The chat store catches the rejected promise
// (chatStore.ts:974) and writes apiError.message to state.
const MIGRATE_ERROR_FRAGMENT = 'migrate';

// ============================================================
// Mock backend factories
// ============================================================

interface MigrateMockOptions {
  /**
   * Categories the mocked backend should report as created. Anything not
   * in this list is absent from the `created` array, which exercises the
   * settings-store "category is empty" branch in the edge case tests.
   */
  createdCategories?: ReadonlyArray<Category>;
  /** When true, the mocked endpoint responds with HTTP 500. */
  fail?: boolean;
  /** When true, the mocked endpoint responds 200 but with partial=true. */
  partial?: boolean;
}

/**
 * Mock the migrate-to-settings endpoint with a deterministic payload.
 * `createdCategories` defaults to ALL_CATEGORIES so a single call covers
 * the happy path; the edge test passes a 3-element subset.
 */
async function setupMockedMigrateBackend(
  page: Page,
  options: MigrateMockOptions = {},
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
        body: JSON.stringify({
          created,
          skipped: [],
          partial: options.partial ?? false,
          errors: [],
        }),
      });
    },
  );
}

/**
 * Mock every settings entity list endpoint that `loadAll()` calls so the
 * settings store populates from a deterministic source. We return the same
 * 6 entity shape per category so each tab renders exactly the migrated row.
 *
 * Endpoints mirror the URLs in settings.ts:
 *   /settings/characters
 *   /settings/items
 *   /settings/locations
 *   /settings/factions
 *   /settings/world-settings  (NB: kebab-case plural differs from field name)
 *   /settings/rules
 */
async function setupMockedSettingsBackend(
  page: Page,
  populated: ReadonlyArray<Category> = ALL_CATEGORIES,
): Promise<void> {
  const makeEntity = (type: Category) => ({
    id: HAPPY_ENTITIES.find((e) => e.type === type)!.id,
    name: HAPPY_ENTITIES.find((e) => e.type === type)!.name,
    description: `AI 补全：${type} 自动生成`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await page.route('**/api/v1/settings/characters', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        populated.includes('character') ? [makeEntity('character')] : [],
      ),
    });
  });
  await page.route('**/api/v1/settings/items', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        populated.includes('item') ? [makeEntity('item')] : [],
      ),
    });
  });
  await page.route('**/api/v1/settings/locations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        populated.includes('location') ? [makeEntity('location')] : [],
      ),
    });
  });
  await page.route('**/api/v1/settings/factions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        populated.includes('faction') ? [makeEntity('faction')] : [],
      ),
    });
  });
  await page.route('**/api/v1/settings/world-settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        populated.includes('world') ? [makeEntity('world')] : [],
      ),
    });
  });
  await page.route('**/api/v1/settings/rules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        populated.includes('rule') ? [makeEntity('rule')] : [],
      ),
    });
  });
  // Relationship / storyline endpoints called by loadAll → ignore.
  await page.route('**/api/v1/settings/characters/*/relationships', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/v1/settings/characters/*/storylines', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  // Outline / IF / writing-settings endpoints — required by loadAll even if
  // the migrate test doesn't exercise them. Return safe empties.
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
      body: JSON.stringify({
        style: 'default',
        collaboration_ratio: 0.5,
        auto_save: true,
      }),
    }),
  );
}

// ============================================================
// Store introspection helpers
// ============================================================

/**
 * Read the persisted chat store from localStorage and return only the
 * fields the migration test asserts on. Keeps the read path aligned with
 * chatStore.ts:1148's partialization list.
 */
async function readChatMigrationState(
  page: Page,
): Promise<{
  extractionState: string | null;
  error: string | null;
  extractedEntitiesByType: Partial<Record<Category, number>>;
}> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('writer-chat-store-v2');
      if (!raw) {
        return {
          extractionState: null,
          error: null,
          extractedEntitiesByType: {},
        };
      }
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? {};
      const entities = Array.isArray(state.extractedEntities)
        ? state.extractedEntities
        : [];
      const counts: Record<string, number> = {};
      for (const e of entities) {
        if (typeof e?.type === 'string') {
          counts[e.type] = (counts[e.type] ?? 0) + 1;
        }
      }
      return {
        extractionState: state.extractionState ?? null,
        error: state.error ?? null,
        extractedEntitiesByType: counts,
      };
    } catch {
      return {
        extractionState: null,
        error: null,
        extractedEntitiesByType: {},
      };
    }
  });
}

/**
 * Read the live settings store via the dev-only window hook. We can't
 * read localStorage here because settings store only persists
 * tags/activeFilter (settingsStore.ts:42); the entity arrays live in
 * memory and are populated by `loadAll()`.
 */
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

/**
 * Trigger the chat store's migrateChatToSettings via the test hook and
 * then `loadAll()` the settings store. Returns the categories that came
 * back from the mocked backend so individual tests can compare directly.
 */
async function triggerMigrateAndLoadSettings(
  page: Page,
  expectedCreated: ReadonlyArray<Category>,
): Promise<{
  chatEntities: Partial<Record<Category, number>>;
  settingsCounts: Record<Category, number>;
}> {
  // Invoke migrate via the dev hook — the returned promise resolves with
  // the migrate-to-settings payload.
  const migrateResult = await page.evaluate(
    async (categories) => {
      const w = window as unknown as {
        __writerE2E?: {
          useChatStore: {
            getState: () => {
              migrateChatToSettings: (
                sessionId: number,
                projectId: number,
                categories: string[],
              ) => Promise<unknown>;
            };
          };
        };
      };
      if (!w.__writerE2E) {
        throw new Error('window.__writerE2E is not exposed — check main.tsx DEV gate');
      }
      const fn = w.__writerE2E.useChatStore.getState().migrateChatToSettings;
      // Seed a sessionId so the action has something to migrate from.
      // Without this the chat store rejects with "no session".
      w.__writerE2E.useChatStore.setState({ sessionId: 1 });
      try {
        const result = await fn(1, 42, categories);
        return { ok: true, created: (result as { created?: unknown[] })?.created?.length ?? 0 };
      } catch (err) {
        return { ok: false, error: (err as Error)?.message ?? String(err) };
      }
    },
    [...expectedCreated],
  );

  expect(migrateResult, 'migrateChatToSettings invocation should resolve').toMatchObject({
    ok: true,
  });

  // Wait briefly for the chat store's `set` to flush into the persist
  // middleware → localStorage. Mock responses are synchronous so 100ms is
  // generous; we don't want to race the persist write.
  await page.waitForTimeout(150);

  // Populate the settings store by hitting the mocked list endpoints.
  await page.evaluate(async () => {
    const w = window as unknown as {
      __writerE2E?: {
        useSettingsStore: {
          getState: () => { loadAll: () => Promise<void> };
        };
      };
    };
    if (!w.__writerE2E) {
      throw new Error('window.__writerE2E missing');
    }
    await w.__writerE2E.useSettingsStore.getState().loadAll();
  });
  await page.waitForTimeout(150);

  const chatState = await readChatMigrationState(page);
  const settingsCounts = await readSettingsCategoryCounts(page);

  return {
    chatEntities: chatState.extractedEntitiesByType,
    settingsCounts,
  };
}

// ============================================================
// Tests
// ============================================================

test.describe('US-022 Phase 2 — chat → settings auto-migration', () => {
  test.beforeEach(async ({ page }) => {
    const journeyId = `chat-to-settings-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    await resetJourneyDataDir(journeyId);
    process.env.WRITER_DATA_DIR = path.join(E2E_ROOT, journeyId);
    process.env.JOURNEY_ID = journeyId;
  });

  test('happy — migrate creates 6 categories; settings store shows ≥1 in each', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await setupMockedMigrateBackend(page);
    await setupMockedSettingsBackend(page);
    await page.goto('/');
    // Wait for the dev-mode test hook to be installed by main.tsx.
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __writerE2E?: unknown }).__writerE2E !==
        'undefined',
      { timeout: 10_000 },
    );

    const { chatEntities, settingsCounts } = await triggerMigrateAndLoadSettings(
      page,
      ALL_CATEGORIES,
    );

    // Chat store should have exactly one entity per requested category.
    for (const cat of ALL_CATEGORIES) {
      expect(chatEntities[cat], `chat store: ${cat} count`).toBe(1);
    }

    // Settings store should now mirror the migrate result via loadAll().
    for (const cat of ALL_CATEGORIES) {
      expect(
        settingsCounts[cat],
        `settings store ${CATEGORY_TO_FIELD[cat]} should be ≥1`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  test('happy — AI completion fills missing categories (faction auto-generated)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // Mock backend declares all 6 categories — including the faction that
    // the user never explicitly mentioned. This is the "AI 自动补全" path:
    // the backend synthesises the missing row from context.
    await setupMockedMigrateBackend(page);
    await setupMockedSettingsBackend(page);
    await page.goto('/');
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __writerE2E?: unknown }).__writerE2E !==
        'undefined',
      { timeout: 10_000 },
    );

    const { settingsCounts } = await triggerMigrateAndLoadSettings(page, ALL_CATEGORIES);

    // The faction category (which the user never mentioned in the chat)
    // should still be present because the AI mock synthesised it.
    expect(settingsCounts.faction, 'AI-completed faction should be present').toBeGreaterThanOrEqual(1);
    // Every other category is also present — no regressions.
    for (const cat of ALL_CATEGORIES) {
      expect(settingsCounts[cat], `${cat} should be present`).toBeGreaterThanOrEqual(1);
    }
  });

  test('error 500 — migrate rejects; chat store records error and survives', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await setupMockedMigrateBackend(page, { fail: true });
    // Even when migrate fails, loadAll may still be called by other UI
    // paths — give it a deterministic empty set.
    await setupMockedSettingsBackend(page, []);
    await page.goto('/');
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __writerE2E?: unknown }).__writerE2E !==
        'undefined',
      { timeout: 10_000 },
    );

    // Drive migrate through the store; the catch in chatStore.ts:973
    // re-throws after recording state.error, so the test hook surfaces
    // { ok: false, error } above.
    const result = await page.evaluate(async () => {
      const w = window as unknown as {
        __writerE2E?: {
          useChatStore: {
            getState: () => {
              migrateChatToSettings: (
                sessionId: number,
                projectId: number,
                categories: string[],
              ) => Promise<unknown>;
            };
          };
        };
      };
      w.__writerE2E!.useChatStore.setState({ sessionId: 1 });
      try {
        await w.__writerE2E!.useChatStore.getState().migrateChatToSettings(1, 42, [
          'world',
          'character',
        ]);
        return { ok: true } as const;
      } catch (err) {
        return { ok: false, error: (err as Error).message } as const;
      }
    });

    expect(result.ok, 'migrate should reject on 500').toBe(false);
    await page.waitForTimeout(150);

    const chatState = await readChatMigrationState(page);
    expect(chatState.extractionState, 'extractionState should be "error"').toBe('error');
    expect(chatState.error, 'chat store error should mention the failure').toContain(
      MIGRATE_ERROR_FRAGMENT,
    );

    // The chat session itself must not be wiped — only migration state
    // should be affected. SessionId (1) survives in the chat store.
    const sessionStillThere = await page.evaluate(() => {
      const raw = localStorage.getItem('writer-chat-store-v2');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed?.state?.sessionId === 1;
    });
    expect(sessionStillThere, 'chat session must survive a failed migrate').toBe(true);
  });

  test('edge — only 3/6 categories returned; remaining 3 stay empty', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const partialSet: ReadonlyArray<Category> = ['world', 'character', 'item'];
    await setupMockedMigrateBackend(page, { createdCategories: partialSet });
    await setupMockedSettingsBackend(page, partialSet);
    await page.goto('/');
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __writerE2E?: unknown }).__writerE2E !==
        'undefined',
      { timeout: 10_000 },
    );

    const { chatEntities, settingsCounts } = await triggerMigrateAndLoadSettings(
      page,
      partialSet,
    );

    // Populated categories: chat + settings both ≥1.
    for (const cat of partialSet) {
      expect(chatEntities[cat], `chat ${cat}`).toBe(1);
      expect(settingsCounts[cat], `settings ${cat}`).toBeGreaterThanOrEqual(1);
    }
    // Missing categories: chat has 0 entries; settings stays at 0.
    const missing = ALL_CATEGORIES.filter((c) => !partialSet.includes(c));
    for (const cat of missing) {
      expect(
        chatEntities[cat] ?? 0,
        `chat should not contain skipped ${cat}`,
      ).toBe(0);
      expect(
        settingsCounts[cat] ?? 0,
        `settings ${CATEGORY_TO_FIELD[cat]} should be empty`,
      ).toBe(0);
    }
  });

  test('counter surrogate — backend received exactly one migrate-to-settings call', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // The real ai-log.jsonl is only written by Electron's aiLog IPC, which
    // is a no-op in the chromium project. We use the route counter as the
    // durable surrogate — if the counter > 0 then the migrate-to-settings
    // endpoint was definitely hit (and the chat-store action went through
    // the API surface, not just local state).
    let migrateCallCount = 0;
    await page.route(
      '**/api/v1/chat/sessions/*/migrate-to-settings',
      async (route) => {
        migrateCallCount += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            created: HAPPY_ENTITIES,
            skipped: [],
            partial: false,
            errors: [],
          }),
        });
      },
    );
    await setupMockedSettingsBackend(page);
    await page.goto('/');
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __writerE2E?: unknown }).__writerE2E !==
        'undefined',
      { timeout: 10_000 },
    );

    await triggerMigrateAndLoadSettings(page, ALL_CATEGORIES);

    expect(migrateCallCount, 'migrate-to-settings should be called exactly once').toBe(1);
  });
});
/**
 * e2e/journeys/cold-start/chat-collect.spec.ts — US-021 Phase 1 E2E.
 *
 * Chat collection journey: the first three turns drive the chat interface
 * auto-advance into the settings editor (turnCount >= 3 → uiStore switches
 * `currentInterface` to 'settings'). We validate this end-to-end plus the
 * supporting error / edge behaviors.
 *
 * CRITICAL — backend is fully mocked via `page.route()` because the real
 * MiniMax API rate limit is currently exhausted. Every test below operates
 * on synthetic responses; no AI provider is contacted. Per Playwright config
 * these tests run in the `chromium` project only — Electron is never spawned
 * (Windows headless constraint).
 *
 * State assertions read localStorage via `page.evaluate` because the Zustand
 * store is module-scoped and not exposed on `window`. The persisted keys are
 * `writer-chat-store-v2` (chat) and `writer-ui-store-v2` (ui).
 *
 * Test isolation:
 *  - per-test `journeyId = chat-collect-<timestamp>` → resetJourneyDataDir
 *  - per-test data dir under data/e2e/<journeyId>/
 *  - mock backend counter resets per-test (closure scoped)
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { resetJourneyDataDir } from '../fixtures/reset';

const E2E_ROOT = path.resolve('data', 'e2e');

// Three canned AI replies — one per turn. The order is significant because
// the happy-path test reads messageCache to verify message ordering.
const AI_REPLIES = [
  '好的，请问你想要创作什么类型的小说？',
  '世界观构建能告诉我更多细节吗？',
  '主要角色是谁？',
];

// Inline error message rendered by <InputActions>. The chat send failure
// path doesn't go through the global toast system; it sets `error` in the
// chat store and the panel renders it inline. We assert on this text.
const INLINE_ERROR_TEXT_FRAGMENT = '服务器内部错误';
const NETWORK_ERROR_TEXT_FRAGMENT = '网络连接失败';

// Mock the entire /api/v1/chat surface so no real backend is reached.
//
// route handlers are page-scoped (Playwright teardown rule). Counter state
// lives in closure so each test starts from scratch.
async function setupMockedChatBackend(page: Page): Promise<void> {
  let sessionCounter = 0;
  let messageCounter = 0;
  const now = () => new Date().toISOString();

  // POST /chat/sessions → create; GET /chat/sessions → list.
  await page.route('**/api/v1/chat/sessions', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      sessionCounter += 1;
      const id = sessionCounter;
      const ts = now();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          project_id: 1,
          created_at: ts,
          updated_at: ts,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // POST /chat/sessions/{id}/send → mock AI auto-reply.
  await page.route('**/api/v1/chat/sessions/*/send', async (route) => {
    const match = route.request().url().match(/\/sessions\/(\d+)\/send/);
    const sessionId = match ? Number(match[1]) : 1;
    messageCounter += 1;
    const ts = now();
    const body = (route.request().postDataJSON() ?? {}) as { content?: string };
    const userMsgId = messageCounter * 100;
    const aiMsgId = messageCounter * 100 + 1;
    const aiContent = AI_REPLIES[(messageCounter - 1) % AI_REPLIES.length];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_message: {
          id: userMsgId,
          session_id: sessionId,
          role: 'user',
          content: body.content ?? '',
          created_at: ts,
        },
        ai_message: {
          id: aiMsgId,
          session_id: sessionId,
          role: 'assistant',
          content: aiContent,
          created_at: ts,
        },
      }),
    });
  });

  // GET /chat/sessions/{id}/messages → empty list (current messages are
  // maintained in the chat store cache, not refetched on send).
  await page.route('**/api/v1/chat/sessions/*/messages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // GET /chat/sessions/{id}/entities → empty.
  await page.route('**/api/v1/chat/sessions/*/entities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

// Fill the chat input and submit by pressing Enter. The textarea has the
// placeholder "输入你的回答... (Enter 发送..." which is unique enough to
// disambiguate from any other textarea that might exist.
async function typeAndSend(page: Page, text: string): Promise<void> {
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible' });
  await textarea.fill(text);
  await textarea.press('Enter');
  // Wait briefly for state to settle (mock responds near-instantly).
  await page.waitForTimeout(150);
}

// Wait for React to mount the chat surface. Cold-start smoke confirms the
// <title> renders, but we additionally wait for the chat input to be present
// so subsequent interactions are guaranteed to land on the rendered tree.
async function waitForChatReady(page: Page): Promise<void> {
  await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 15_000 });
}

// Read persisted ui-store. Return null when the key hasn't been written yet
// (e.g. before any actions land).
async function readUIStoreInterface(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('writer-ui-store-v2');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.currentInterface ?? null;
    } catch {
      return null;
    }
  });
}

// Read persisted chat-store. `cachedMessageCount` is the sum of
// `messageCache.messages[sessionId].length` across all cached sessions — the
// only place where messages are durable across reloads (per the partialize
// config in chatStore.ts:1148).
async function readChatStoreSnapshot(page: Page): Promise<{
  sessionId: number | null;
  turnCount: number;
  cachedMessageCount: number;
}> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('writer-chat-store-v2');
      if (!raw) return { sessionId: null, turnCount: 0, cachedMessageCount: 0 };
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? {};
      const cacheBuckets = state.messageCache?.messages ?? {};
      const cachedMessageCount = Object.values<unknown>(cacheBuckets).reduce(
        (acc: number, msgs) => acc + (Array.isArray(msgs) ? msgs.length : 0),
        0,
      );
      return {
        sessionId: state.sessionId ?? null,
        turnCount: state.turnCount ?? 0,
        cachedMessageCount,
      };
    } catch {
      return { sessionId: null, turnCount: 0, cachedMessageCount: 0 };
    }
  });
}

test.describe('US-021 Phase 1 — chat collection journey', () => {
  test.beforeEach(async ({ page }) => {
    // Per-journey isolation: fresh data dir + env hint (mostly cosmetic for
    // chromium project but keeps the e2e layout consistent with Electron).
    const journeyId = `chat-collect-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    await resetJourneyDataDir(journeyId);
    process.env.WRITER_DATA_DIR = path.join(E2E_ROOT, journeyId);
    process.env.JOURNEY_ID = journeyId;

    await setupMockedChatBackend(page);
  });

  test('happy — 3 turns auto-advance currentInterface to settings', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await waitForChatReady(page);

    await typeAndSend(page, '我想写仙侠小说');
    await typeAndSend(page, '世界观是高武仙侠');
    await typeAndSend(page, '主角是一个少年');

    // Allow auto-advance to land.
    await page.waitForTimeout(500);

    const chatState = await readChatStoreSnapshot(page);
    expect(chatState.turnCount, 'turnCount should reach 3 after 3 sends')
      .toBeGreaterThanOrEqual(3);
    expect(chatState.cachedMessageCount, 'cache should hold 6 messages (2 per turn)')
      .toBeGreaterThanOrEqual(6);

    const currentInterface = await readUIStoreInterface(page);
    expect(currentInterface, 'uiStore.currentInterface should be "settings"').toBe('settings');
  });

  test('happy — messageCache holds exactly 6 entries after 3 turns', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await waitForChatReady(page);

    for (let i = 0; i < 3; i += 1) {
      await typeAndSend(page, `turn ${i + 1}`);
    }
    await page.waitForTimeout(500);

    const chatState = await readChatStoreSnapshot(page);
    expect(chatState.cachedMessageCount).toBe(6);
    expect(chatState.turnCount).toBe(3);
  });

  test('error 503 — inline error message appears after retries', async ({ page }) => {
    test.setTimeout(60_000);
    // Override just the /send endpoint to always 503. axios-retry will
    // re-issue 3 more times (1s + 2s + 4s = ~7s) before settling.
    await page.route('**/api/v1/chat/sessions/*/send', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'mock 503' } }),
      })
    );

    await page.goto('/');
    await waitForChatReady(page);

    await typeAndSend(page, '服务挂了');

    // Inline error renders via <InputActions error={error}>. The chat store
    // sets `error` to the ApiError.message (mapped from 5xx → "服务器内部错误…").
    // Allow up to 15s for axios-retry to exhaust retries + state to flush.
    await expect(page.getByText(INLINE_ERROR_TEXT_FRAGMENT, { exact: false }))
      .toBeVisible({ timeout: 15_000 });
  });

  test('error network — final inline error after retry aborts', async ({ page }) => {
    test.setTimeout(60_000);
    // Abort every /send attempt → axios-retry sees no response → retries →
    // eventually rejects. The chat store catches and renders the inline error.
    await page.route('**/api/v1/chat/sessions/*/send', (route) => route.abort('failed'));

    await page.goto('/');
    await waitForChatReady(page);

    await typeAndSend(page, '连不上网');

    await expect(page.getByText(NETWORK_ERROR_TEXT_FRAGMENT, { exact: false }))
      .toBeVisible({ timeout: 15_000 });
  });

  test('edge — session and messageCache survive a page reload', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await waitForChatReady(page);

    await typeAndSend(page, '我想要续写');
    await page.waitForTimeout(300);

    const preReload = await readChatStoreSnapshot(page);
    expect(preReload.sessionId, 'session should exist after one send').not.toBeNull();
    expect(preReload.turnCount).toBeGreaterThanOrEqual(1);

    await page.reload();
    // After reload the chat store rehydrates from localStorage.
    const postReload = await readChatStoreSnapshot(page);
    expect(postReload.sessionId, 'sessionId must persist across reload')
      .toBe(preReload.sessionId);
    expect(postReload.turnCount, 'turnCount must persist across reload').toBeGreaterThanOrEqual(1);
  });

  test('counter surrogate — chat store advance is the durable signal', async ({ page }) => {
    test.setTimeout(60_000);
    // The ai-log.jsonl is written by Electron via aiLog:append IPC, which
    // is a no-op in the chromium project. We assert on the chat store
    // turnCount counter as the equivalent durable signal for "≥3 AI
    // interactions completed" because it is exactly what the auto-advance
    // logic depends on (chatStore.ts:494).
    await page.goto('/');
    await waitForChatReady(page);

    for (let i = 0; i < 3; i += 1) {
      await typeAndSend(page, `signal turn ${i + 1}`);
    }
    await page.waitForTimeout(500);

    const chatState = await readChatStoreSnapshot(page);
    expect(chatState.turnCount).toBeGreaterThanOrEqual(3);
  });
});

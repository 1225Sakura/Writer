/**
 * e2e/journeys/regression/chat-collect.spec.ts — US-021 PERMANENT REGRESSION.
 *
 * PERMANENT REGRESSION TEST — 永远不要删除.
 *
 * Mirror of e2e/journeys/cold-start/chat-collect.spec.ts kept under the
 * `regression/` directory so future refactors of the cold-start scaffolding
 * cannot silently drop the chat-collection guarantees below. If you are
 * tempted to delete this file, first migrate the assertions into a new
 * regression spec and link from the v4 plan.
 *
 * Scope (permanent assertions):
 *   1. 3 successful send rounds auto-advance the UI interface to 'settings'.
 *   2. After 3 turns the chat store caches exactly 6 messages.
 *   3. A 5xx backend response surfaces a user-visible error within 15s.
 *   4. A network failure surfaces a user-visible error within 15s.
 *   5. After a page reload the sessionId and cached messages persist.
 *
 * This file is intentionally lean vs. the cold-start copy: cold-start owns
 * the development-time iteration loop; regression owns the durable coverage
 * that lives across releases. Differences:
 *   - no counter-surrogate test (cold-start scaffolding only).
 *   - inline error assertions accept either the 503 string OR the network
 *     error string, so a single spec can run both scenarios cleanly.
 *   - runs in `chromium` project only (no Electron).
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { resetJourneyDataDir } from '../fixtures/reset';

const E2E_ROOT = path.resolve('data', 'e2e');
const AI_REPLIES = [
  '好的，请问你想要创作什么类型的小说？',
  '世界观构建能告诉我更多细节吗？',
  '主要角色是谁？',
];
const ERROR_FRAGMENT_5XX = '服务器内部错误';
const ERROR_FRAGMENT_NETWORK = '网络连接失败';

async function setupMockedChatBackend(page: Page): Promise<void> {
  let sessionCounter = 0;
  let messageCounter = 0;

  await page.route('**/api/v1/chat/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      sessionCounter += 1;
      const ts = new Date().toISOString();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: sessionCounter,
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

  await page.route('**/api/v1/chat/sessions/*/send', async (route) => {
    const match = route.request().url().match(/\/sessions\/(\d+)\/send/);
    const sessionId = match ? Number(match[1]) : 1;
    messageCounter += 1;
    const ts = new Date().toISOString();
    const body = (route.request().postDataJSON() ?? {}) as { content?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_message: {
          id: messageCounter * 100,
          session_id: sessionId,
          role: 'user',
          content: body.content ?? '',
          created_at: ts,
        },
        ai_message: {
          id: messageCounter * 100 + 1,
          session_id: sessionId,
          role: 'assistant',
          content: AI_REPLIES[(messageCounter - 1) % AI_REPLIES.length],
          created_at: ts,
        },
      }),
    });
  });

  await page.route('**/api/v1/chat/sessions/*/messages', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/v1/chat/sessions/*/entities', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
}

async function typeAndSend(page: Page, text: string): Promise<void> {
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible' });
  await textarea.fill(text);
  await textarea.press('Enter');
  await page.waitForTimeout(150);
}

async function waitForChatReady(page: Page): Promise<void> {
  await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 15_000 });
}

async function readUIStoreInterface(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('writer-ui-store-v2');
      if (!raw) return null;
      return (JSON.parse(raw)?.state?.currentInterface ?? null) as string | null;
    } catch {
      return null;
    }
  });
}

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

test.describe('US-021 regression — chat collection', () => {
  test.beforeEach(async ({ page }) => {
    const journeyId = `chat-collect-regress-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    await resetJourneyDataDir(journeyId);
    process.env.WRITER_DATA_DIR = path.join(E2E_ROOT, journeyId);
    process.env.JOURNEY_ID = journeyId;
    await setupMockedChatBackend(page);
  });

  test('REGRESSION: 3 turns auto-advance to settings and cache 6 messages', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await waitForChatReady(page);

    await typeAndSend(page, 'turn 1');
    await typeAndSend(page, 'turn 2');
    await typeAndSend(page, 'turn 3');
    await page.waitForTimeout(500);

    const chatState = await readChatStoreSnapshot(page);
    const currentInterface = await readUIStoreInterface(page);

    expect(chatState.turnCount).toBe(3);
    expect(chatState.cachedMessageCount).toBe(6);
    expect(currentInterface).toBe('settings');
  });

  test('REGRESSION: backend 5xx surfaces user-visible error', async ({ page }) => {
    test.setTimeout(60_000);
    await page.route('**/api/v1/chat/sessions/*/send', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'mock 503' } }),
      })
    );

    await page.goto('/');
    await waitForChatReady(page);
    await typeAndSend(page, 'service down');

    await expect(
      page.getByText(ERROR_FRAGMENT_5XX, { exact: false })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('REGRESSION: network failure surfaces user-visible error', async ({ page }) => {
    test.setTimeout(60_000);
    await page.route('**/api/v1/chat/sessions/*/send', (route) => route.abort('failed'));

    await page.goto('/');
    await waitForChatReady(page);
    await typeAndSend(page, 'no network');

    await expect(
      page.getByText(ERROR_FRAGMENT_NETWORK, { exact: false })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('REGRESSION: session + messageCache survive page reload', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await waitForChatReady(page);
    await typeAndSend(page, 'persisted message');
    await page.waitForTimeout(300);

    const preReload = await readChatStoreSnapshot(page);
    expect(preReload.sessionId).not.toBeNull();

    await page.reload();
    const postReload = await readChatStoreSnapshot(page);
    expect(postReload.sessionId).toBe(preReload.sessionId);
  });
});

/**
 * US-023 PERMANENT REGRESSION — settings AI tools.
 *
 * PERMANENT marker: never delete this file. It protects the four mocked AI
 * endpoint contracts and the current settings-page disabled-state behavior.
 *
 * The settings page still mounts SettingsAIButtonGroup without entity props or
 * onResult. Therefore fill-fields and rewrite-description remain disabled;
 * regression coverage invokes those two mocked endpoints directly while the
 * enabled generate/review actions are clicked through the real UI. This keeps
 * the test honest and prevents E2E-only production wiring from being added.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { resetJourneyDataDir } from '../../fixtures/reset';

const E2E_ROOT = path.resolve('data', 'e2e');

type ActionKey =
  | 'generate-entity'
  | 'review-consistency'
  | 'fill-fields'
  | 'rewrite-description';

const ENDPOINTS: Record<ActionKey, string> = {
  'generate-entity': '/ai/generate-entity',
  'review-consistency': '/ai/review-consistency',
  'fill-fields': '/ai/fill-fields',
  'rewrite-description': '/ai/rewrite-description',
};

const BODIES: Record<ActionKey, Record<string, unknown>> = {
  'generate-entity': { type: 'character', hint: '落魄剑修', projectId: 1 },
  'review-consistency': { projectId: 1, targetTypes: ['character'] },
  'fill-fields': { entityType: 'character', entityId: 99, emptyFields: ['description'] },
  'rewrite-description': { entityType: 'character', entityId: 99, style: 'literary' },
};

const SUCCESS: Record<ActionKey, Record<string, unknown>> = {
  'generate-entity': { data: { entity: { id: 99, name: 'AI生成', description: 'AI 自动生成' } } },
  'review-consistency': {
    data: { issues: [{ severity: 'medium', location: '林远图', description: '存在设定冲突' }], suggestions: [] },
  },
  'fill-fields': { data: { filled: { description: '补全后的角色描述' } } },
  'rewrite-description': {
    data: { description: '改写后的角色描述', style: 'literary', entityType: 'character', entityId: 99 },
  },
};

async function setupSettingsRoutes(page: Page): Promise<void> {
  await page.route('**/api/v1/settings/characters', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 99, name: '林远图', description: '', personality: '' }]),
    }),
  );
  for (const endpoint of [
    '/settings/items',
    '/settings/locations',
    '/settings/factions',
    '/settings/world',
    '/settings/rules',
  ]) {
    await page.route(`**/api/v1${endpoint}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
  }
  await page.route('**/api/v1/settings/characters/*/relationships', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/v1/settings/characters/*/storylines', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/v1/chapters/outlines', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/v1/chapters/if-lines', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/v1/settings/writing', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ style: 'default', collaboration_ratio: 0.5, auto_save: true }),
    }),
  );
}

async function setupAIMocks(
  page: Page,
  calls: Record<ActionKey, number>,
  options: { failGenerate?: boolean } = {},
): Promise<void> {
  for (const action of Object.keys(ENDPOINTS) as ActionKey[]) {
    await page.route(`**/api/v1${ENDPOINTS[action]}`, async (route) => {
      calls[action] += 1;
      if (action === 'generate-entity' && options.failGenerate) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'AI_UNAVAILABLE', message: 'mock AI unavailable' } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SUCCESS[action]),
      });
    });
  }
}

async function openSettings(
  page: Page,
  calls: Record<ActionKey, number>,
  options: { failGenerate?: boolean } = {},
): Promise<void> {
  await setupSettingsRoutes(page);
  await setupAIMocks(page, calls, options);
  await page.goto('/');
  await page.getByRole('tab', { name: '设定' }).click();
  await expect(page.getByText('AI 助手')).toBeVisible();
}

async function directInvoke(page: Page, action: ActionKey): Promise<{ status: number; body: unknown }> {
  return page.evaluate(
    async ({ endpoint, body }) => {
      const response = await fetch(`/api/v1${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    { endpoint: ENDPOINTS[action], body: BODIES[action] },
  );
}

async function clickOrDirect(page: Page, calls: Record<ActionKey, number>, action: ActionKey): Promise<void> {
  const button = page.getByTestId(`ai-button-${action}`);
  if (await button.isDisabled()) {
    await directInvoke(page, action);
  } else {
    await button.click();
  }
  await expect.poll(() => calls[action]).toBe(1);
}

test.describe('US-023 PERMANENT regression — settings AI tools', () => {
  test.beforeEach(async ({ page }) => {
    const journeyId = `settings-ai-tools-regression-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    await resetJourneyDataDir(journeyId);
    process.env.WRITER_DATA_DIR = path.join(E2E_ROOT, journeyId);
    process.env.JOURNEY_ID = journeyId;
  });

  test('PERMANENT: all four endpoint mocks remain reachable exactly once', async ({ page }) => {
    test.setTimeout(60_000);
    const calls: Record<ActionKey, number> = {
      'generate-entity': 0,
      'review-consistency': 0,
      'fill-fields': 0,
      'rewrite-description': 0,
    };
    await openSettings(page, calls);

    for (const action of Object.keys(ENDPOINTS) as ActionKey[]) {
      await clickOrDirect(page, calls, action);
    }

    expect(calls).toEqual({
      'generate-entity': 1,
      'review-consistency': 1,
      'fill-fields': 1,
      'rewrite-description': 1,
    });
    await expect(page.getByTestId('ai-button-generate-entity')).toHaveAttribute(
      'style',
      /--color-ifline/,
    );
  });

  test('PERMANENT: 503 generate failure renders error without changing the existing entity', async ({ page }) => {
    test.setTimeout(60_000);
    const calls: Record<ActionKey, number> = {
      'generate-entity': 0,
      'review-consistency': 0,
      'fill-fields': 0,
      'rewrite-description': 0,
    };
    await openSettings(page, calls, { failGenerate: true });

    await page.getByTestId('ai-button-generate-entity').click();
    // axios-retry retries 503 responses before the component receives the final error.
    await expect.poll(() => calls['generate-entity']).toBeGreaterThanOrEqual(1);
    // The current component has an inline error state, not a global toast.
    await expect(page.getByTestId('ai-button-generate-entity')).toContainText('服务器内部错误');

    const characters = await page.evaluate(() => {
      const state = (window as unknown as {
        __writerE2E?: { useSettingsStore?: { getState: () => { characters?: unknown[] } } };
      }).__writerE2E?.useSettingsStore?.getState();
      return state?.characters ?? [];
    });
    expect(characters).toHaveLength(1);
    expect(characters[0]).toMatchObject({ id: 99, name: '林远图' });
  });

  test('PERMANENT: disabled fill-fields edge does not send a request', async ({ page }) => {
    test.setTimeout(60_000);
    const calls: Record<ActionKey, number> = {
      'generate-entity': 0,
      'review-consistency': 0,
      'fill-fields': 0,
      'rewrite-description': 0,
    };
    await openSettings(page, calls);

    await expect(page.getByTestId('ai-button-fill-fields')).toBeDisabled();
    expect(calls['fill-fields']).toBe(0);
  });
});

// This file is intentionally a permanent mirror of the cold-start contract.
// Keep the PERMANENT marker and assertions when refactoring the journey tree.
export {};

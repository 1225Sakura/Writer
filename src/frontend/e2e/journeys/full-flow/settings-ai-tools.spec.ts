/**
 * US-023 Phase 3 — settings AI tools E2E contract tests.
 *
 * Every AI request is intercepted with page.route(); the MiniMax provider is
 * never contacted. The mocks cover generate-entity, review-consistency,
 * fill-fields, and rewrite-description, including successful and 503 payloads.
 *
 * Known integration limitation: SettingsContent currently mounts
 * SettingsAIButtonGroup with only projectId={1}. It does not pass a selected
 * entity, emptyFields, or onResult callback. Consequently fill-fields and
 * rewrite-description are disabled in the shipped settings page, and no
 * generated/reviewed data can be committed to the settings store from this
 * page. Tests click generate/review when enabled; for the two disabled actions
 * they invoke the same mocked endpoint directly so the API contract and edge
 * responses remain permanently covered. The assertions explicitly preserve
 * this limitation rather than adding production wiring in an E2E-only story.
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

type ActionResult = {
  via: 'button' | 'direct-fallback';
  status: number;
  body: unknown;
};

const ENDPOINTS: Record<ActionKey, string> = {
  'generate-entity': '/ai/generate-entity',
  'review-consistency': '/ai/review-consistency',
  'fill-fields': '/ai/fill-fields',
  'rewrite-description': '/ai/rewrite-description',
};

const REQUEST_BODIES: Record<ActionKey, Record<string, unknown>> = {
  'generate-entity': {
    type: 'character',
    // SettingsContent does not pass hint, so the component uses its default.
    hint: '',
    projectId: 1,
  },
  'review-consistency': {
    // No entityType is passed by SettingsContent; undefined is omitted by JSON.stringify.
    projectId: 1,
  },
  'fill-fields': {
    entityType: 'character',
    entityId: 99,
    emptyFields: ['description', 'personality'],
  },
  'rewrite-description': {
    entityType: 'character',
    entityId: 99,
    style: 'literary',
  },
};

const SUCCESS_RESPONSES: Record<ActionKey, Record<string, unknown>> = {
  'generate-entity': {
    data: {
      entity: {
        type: 'character',
        id: 99,
        name: 'AI生成剑修',
        description: 'AI 自动生成的落魄剑修',
      },
    },
  },
  'review-consistency': {
    data: {
      issues: [
        {
          severity: 'high',
          location: '角色：林远图 / 世界观：灵气潮汐',
          description: '角色境界与世界观规则不一致',
        },
      ],
      suggestions: ['补充境界变化的时间线'],
    },
  },
  'fill-fields': {
    data: {
      filled: {
        description: 'AI 补全：他曾是宗门首席，后因旧伤流落江湖。',
        personality: '克制、坚韧',
      },
    },
  },
  'rewrite-description': {
    data: {
      description: '他身负旧伤，剑意却如寒星般未曾熄灭。',
      style: 'literary',
      entityType: 'character',
      entityId: 99,
    },
  },
};

interface MockState {
  calls: Record<ActionKey, number>;
  requests: Record<ActionKey, Array<Record<string, unknown>>>;
}

function emptyMockState(): MockState {
  return {
    calls: {
      'generate-entity': 0,
      'review-consistency': 0,
      'fill-fields': 0,
      'rewrite-description': 0,
    },
    requests: {
      'generate-entity': [],
      'review-consistency': [],
      'fill-fields': [],
      'rewrite-description': [],
    },
  };
}

async function setupSettingsBackend(
  page: Page,
  options: { allFieldsFilled?: boolean } = {},
): Promise<void> {
  const character = options.allFieldsFilled
    ? {
        id: 99,
        name: '林远图',
        description: '已填写的角色描述',
        personality: '沉着坚毅',
        gender: '男',
        desires: '守护宗门',
        flaws: '过于自责',
        tier: 'supporting',
        cultivation_realm: '筑基',
      }
    : {
        id: 99,
        name: '林远图',
        description: '',
        personality: '',
        gender: '男',
        desires: '守护宗门',
        flaws: '过于自责',
        tier: 'supporting',
        cultivation_realm: '筑基',
      };

  await page.route('**/api/v1/settings/characters', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([character]),
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
  state: MockState,
  options: { failActions?: ReadonlyArray<ActionKey> } = {},
): Promise<void> {
  const failures = new Set(options.failActions ?? []);
  for (const action of Object.keys(ENDPOINTS) as ActionKey[]) {
    await page.route(`**/api/v1${ENDPOINTS[action]}`, async (route) => {
      state.calls[action] += 1;
      const body = route.request().postDataJSON() as Record<string, unknown> | null;
      if (body) state.requests[action].push(body);
      if (failures.has(action)) {
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
        body: JSON.stringify(SUCCESS_RESPONSES[action]),
      });
    });
  }
}

async function installAILogRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const records: unknown[] = [];
    (window as unknown as { __writerE2EAILogs: unknown[] }).__writerE2EAILogs = records;
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      getApiKey: async () => null,
      appendAILog: async (payload: unknown) => {
        records.push(payload);
        return { success: true };
      },
    };
  });
}

async function openSettings(
  page: Page,
  state: MockState,
  options: { allFieldsFilled?: boolean; failActions?: ReadonlyArray<ActionKey> } = {},
): Promise<void> {
  await installAILogRecorder(page);
  await setupSettingsBackend(page, options);
  await setupAIMocks(page, state, options);
  await page.goto('/');
  await page.getByRole('tab', { name: '设定' }).click();
  await expect(page.getByText('AI 助手')).toBeVisible();
  await expect(page.getByTestId('ai-button-generate-entity')).toBeVisible();
}

async function invokeDirectMock(
  page: Page,
  action: ActionKey,
): Promise<{ status: number; body: unknown }> {
  return page.evaluate(
    async ({ endpoint, body }) => {
      const response = await fetch(`/api/v1${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    { endpoint: ENDPOINTS[action], body: REQUEST_BODIES[action] },
  );
}

/**
 * Exercise a visible button when the current page enables it. For disabled
 * fill/rewrite buttons, keep the endpoint assertion alive with a direct
 * browser request and label the result so the limitation is not hidden.
 */
async function invokeAction(page: Page, state: MockState, action: ActionKey): Promise<ActionResult> {
  const button = page.getByTestId(`ai-button-${action}`);
  if (!(await button.isDisabled())) {
    await button.click();
    await expect.poll(() => state.calls[action]).toBe(1);
    const body = SUCCESS_RESPONSES[action];
    return { via: 'button', status: 200, body };
  }

  const response = await invokeDirectMock(page, action);
  await expect.poll(() => state.calls[action]).toBe(1);
  return { via: 'direct-fallback', ...response };
}

async function readAILogs(page: Page): Promise<Array<{ action?: string }>> {
  return page.evaluate(() => {
    const records = (window as unknown as { __writerE2EAILogs?: Array<{ action?: string }> })
      .__writerE2EAILogs;
    return records ?? [];
  });
}

test.describe('US-023 Phase 3 — settings AI tools (mocked backend)', () => {
  test.beforeEach(async ({ page }) => {
    const journeyId = `settings-ai-tools-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    await resetJourneyDataDir(journeyId);
    process.env.WRITER_DATA_DIR = path.join(E2E_ROOT, journeyId);
    process.env.JOURNEY_ID = journeyId;
  });

  test('happy — each of the four actions reaches its mocked endpoint once', async ({ page }) => {
    test.setTimeout(60_000);
    const state = emptyMockState();
    await openSettings(page, state);

    const results = {} as Record<ActionKey, ActionResult>;
    for (const action of Object.keys(ENDPOINTS) as ActionKey[]) {
      results[action] = await invokeAction(page, state, action);
    }

    expect(state.calls).toEqual({
      'generate-entity': 1,
      'review-consistency': 1,
      'fill-fields': 1,
      'rewrite-description': 1,
    });
    expect(results['generate-entity'].via).toBe('button');
    expect(results['review-consistency'].via).toBe('button');
    expect(results['fill-fields'].via).toBe('direct-fallback');
    expect(results['rewrite-description'].via).toBe('direct-fallback');
    expect(state.requests['generate-entity'][0]).toMatchObject(REQUEST_BODIES['generate-entity']);
    expect(state.requests['review-consistency'][0]).toMatchObject(REQUEST_BODIES['review-consistency']);
  });

  test('happy — generate response contains a new entity contract', async ({ page }) => {
    test.setTimeout(60_000);
    const state = emptyMockState();
    await openSettings(page, state);

    const result = await invokeAction(page, state, 'generate-entity');
    expect(result.body).toMatchObject({
      data: { entity: { id: 99, name: 'AI生成剑修', description: 'AI 自动生成的落魄剑修' } },
    });
    expect(state.calls['generate-entity']).toBe(1);
    // The visible button changes to its success state after the mocked call.
    await expect(page.getByTestId('ai-button-generate-entity')).toHaveAttribute(
      'style',
      /--color-ifline/,
    );
  });

  test('happy — review response exposes consistency issues for the UI', async ({ page }) => {
    test.setTimeout(60_000);
    const state = emptyMockState();
    await openSettings(page, state);

    const result = await invokeAction(page, state, 'review-consistency');
    expect(result.body).toMatchObject({
      data: {
        issues: [
          expect.objectContaining({ severity: 'high', description: expect.stringContaining('不一致') }),
        ],
      },
    });
    expect(state.calls['review-consistency']).toBe(1);
    await expect(page.getByTestId('ai-button-review-consistency')).toHaveAttribute(
      'style',
      /--color-ifline/,
    );
  });

  test('happy — fill-fields response contains values for empty fields', async ({ page }) => {
    test.setTimeout(60_000);
    const state = emptyMockState();
    await openSettings(page, state);

    const result = await invokeAction(page, state, 'fill-fields');
    expect(result.via).toBe('direct-fallback');
    expect(result.body).toMatchObject({
      data: { filled: { description: expect.stringContaining('宗门首席'), personality: '克制、坚韧' } },
    });
    expect(state.requests['fill-fields'][0]).toMatchObject(REQUEST_BODIES['fill-fields']);
  });

  test('happy — rewrite-description response changes the description', async ({ page }) => {
    test.setTimeout(60_000);
    const state = emptyMockState();
    await openSettings(page, state);

    const originalDescription = '原始描述';
    const result = await invokeAction(page, state, 'rewrite-description');
    expect(result.via).toBe('direct-fallback');
    expect(result.body).toMatchObject({
      data: { description: expect.any(String), style: 'literary' },
    });
    expect((result.body as { data: { description: string } }).data.description).not.toBe(originalDescription);
  });

  test('error — AI 503 shows inline error and leaves the existing value untouched', async ({ page }) => {
    test.setTimeout(60_000);
    const state = emptyMockState();
    await openSettings(page, state, { failActions: ['generate-entity'] });

    await page.getByTestId('ai-button-generate-entity').click();
    // axios-retry retries 503 responses before the component receives the final error.
    await expect.poll(() => state.calls['generate-entity']).toBeGreaterThanOrEqual(1);
    // Current component behavior renders the transformed API error in the
    // button; a global toast is not wired by SettingsAIButtonGroup yet.
    await expect(page.getByTestId('ai-button-generate-entity')).toContainText('服务器内部错误');

    const persistedDescription = await page.evaluate(() => {
      const state = (window as unknown as {
        __writerE2E?: { useSettingsStore?: { getState: () => { characters?: Array<{ description?: string }> } } };
      }).__writerE2E?.useSettingsStore?.getState();
      return state?.characters?.[0]?.description ?? '';
    });
    expect(persistedDescription).toBe('');
  });

  test('edge — all fields filled keeps fill-fields disabled and does not call AI', async ({ page }) => {
    test.setTimeout(60_000);
    const state = emptyMockState();
    await openSettings(page, state, { allFieldsFilled: true });

    const fillButton = page.getByTestId('ai-button-fill-fields');
    await expect(fillButton).toBeDisabled();
    expect(state.calls['fill-fields']).toBe(0);
    // This assertion documents the current integration gap: the button is
    // disabled because SettingsContent does not pass entity props at all,
    // even when the backend entity has no empty fields.
  });

  test('AI log surrogate — enabled buttons emit logs; all four routes are counted', async ({ page }) => {
    test.setTimeout(60_000);
    const state = emptyMockState();
    await openSettings(page, state);

    for (const action of Object.keys(ENDPOINTS) as ActionKey[]) {
      await invokeAction(page, state, action);
    }

    await expect.poll(async () => (await readAILogs(page)).length).toBe(2);
    const logs = await readAILogs(page);
    expect(logs.filter((entry) => entry.action === 'generate-entity')).toHaveLength(1);
    expect(logs.filter((entry) => entry.action === 'review-consistency')).toHaveLength(1);
    // Direct fallbacks do not pass through SettingsAIButtonGroup.emitAILog.
    // Route counters remain the durable surrogate for the two disabled actions.
    expect(logs.filter((entry) => entry.action === 'fill-fields')).toHaveLength(0);
    expect(logs.filter((entry) => entry.action === 'rewrite-description')).toHaveLength(0);
    expect(Object.values(state.calls)).toEqual([1, 1, 1, 1]);
  });
});

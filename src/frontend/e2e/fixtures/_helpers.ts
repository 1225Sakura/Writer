/**
 * e2e/fixtures/_helpers.ts — shared helpers for the cold-start / full-flow /
 * regression journey specs (US-021..US-026).
 *
 * This file collects duplicated patterns that appeared in every spec:
 *   - E2E_ROOT path constant
 *   - setupJourneyEnv: per-journey id, data dir reset, env stamping
 *   - writing-interface helpers: navigateToWriting, pressBodyShortcut,
 *     setEditorContentAndSelectAll, readUIStore, SIX_OPS, SAMPLE_TEXT
 *
 * Mock backend factories (setupMockedChatBackend / setupMockedSettingsBackend /
 * setupMockedMigrateBackend / setupMockedAIBackend / setupMockedOutlineBackend
 * / setupMockedIFLineBackend) intentionally stay per-spec because their
 * response payloads differ between cold-start/full-flow and the leaner
 * regression mirrors — extracting them would risk drift against the locked
 * PRD contract.
 */
import path from 'path';
import { expect, type Page } from '@playwright/test';
import { setupJourneyEnv as stampWriterDataDir } from './setup-journey';
import { resetJourneyDataDir } from './reset';

export const E2E_ROOT = path.resolve('data', 'e2e');

/**
 * Mint a unique journeyId, reset its data dir, and stamp the WRITER_DATA_DIR
 * + JOURNEY_ID env vars the Electron / Python backend reads at startup.
 *
 * Replaces the 4-line beforeEach block that every spec used to inline:
 *   const journeyId = `<name>-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
 *   await resetJourneyDataDir(journeyId);
 *   process.env.WRITER_DATA_DIR = path.join(E2E_ROOT, journeyId);
 *   process.env.JOURNEY_ID = journeyId;
 */
export async function setupJourneyEnv(journeyName: string): Promise<string> {
  const journeyId = `${journeyName}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  await resetJourneyDataDir(journeyId);
  const dir = stampWriterDataDir(journeyId);
  process.env.JOURNEY_ID = journeyId;
  return dir;
}

// ============================================================
// Writing-interface helpers (US-025 / US-026)
// ============================================================

/** AI shortcut matrix the editor's ShortcutListener binds. */
export interface ShortcutOp {
  /** Upper-case letter (matches the key=Key${k} dispatch below). */
  key: string;
  /** aiStore action name (= /ai/generate body.operation). */
  operation: string;
  /** Drawer button label (Chinese). */
  label: string;
}

export const SIX_OPS: ReadonlyArray<ShortcutOp> = [
  { key: 'O', operation: 'optimize', label: '优化' },
  { key: 'E', operation: 'expand',   label: '扩写' },
  { key: 'S', operation: 'condense', label: '缩写' },
  { key: 'R', operation: 'rewrite',  label: '改写' },
  { key: 'W', operation: 'continue', label: '续写' },
  { key: 'P', operation: 'polish',   label: '润色' },
];

/** Seed text for editor + selection in shortcut tests. */
export const SAMPLE_TEXT = '少年握紧了手中的玉佩，灵气在经脉中缓缓流转。';

/**
 * Wait for the TipTap editor to mount. Used by both navigateToWriting and
 * any spec that needs the editor without wanting the full tab-click helper.
 */
export async function expectProseMirror(page: Page): Promise<void> {
  await expect(page.locator('.ProseMirror').first()).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Click the 写作 tab and wait for ProseMirror to mount. Used by every
 * writing-interface spec to land on currentInterface === 'writing' before
 * dispatching shortcuts or asserting on sidebar treeitems.
 */
export async function navigateToWriting(page: Page): Promise<void> {
  const writingTab = page.getByRole('tab', { name: '写作' });
  await writingTab.click();
  await expectProseMirror(page);
}

/**
 * Dispatch a Ctrl+Shift+<key> (or any letter / path char) keydown on
 * document.body. We dispatch on body so the ShortcutListener's `isInput`
 * guard returns false and the AI handler reaches getEditorInstance().
 *
 * `key` accepts single letters ('O', 'E', '/', '\\') — the synthetic
 * event fills code / keyCode / which from the char.
 */
export async function pressBodyShortcut(page: Page, key: string): Promise<void> {
  await page.evaluate((k) => {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: k,
        code: `Key${k}`,
        keyCode: k.charCodeAt(0),
        which: k.charCodeAt(0),
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, key);
}

/**
 * Dispatch a function-key (F11 etc.) keydown on document.body. Function
 * keys have no character codepoint so keyCode is supplied explicitly.
 */
export async function pressBodyFunctionKey(
  page: Page,
  key: string,
  keyCode: number,
): Promise<void> {
  await page.evaluate(
    ({ k, c }) => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: k,
          code: k,
          keyCode: c,
          which: c,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { k: key, c: keyCode },
  );
}

/**
 * Seed the TipTap editor with selectable text: click into .ProseMirror,
 * discard any pre-existing paragraph, type the sample, Ctrl+A to select
 * all, then blur so the global keydown dispatched from body is unambiguous.
 */
export async function setEditorContentAndSelectAll(
  page: Page,
  content: string,
): Promise<void> {
  const editor = page.locator('.ProseMirror').first();
  await editor.click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.type(content, { delay: 4 });
  await page.keyboard.press('Control+a');
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
}

/**
 * Read the persisted ui-store (writer-ui-store-v2) as a plain record.
 * Returns {} when the key hasn't been written yet (e.g. before any action
 * has flushed through the persist middleware).
 */
export async function readUIStore(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('writer-ui-store-v2');
    return raw ? (JSON.parse(raw).state as Record<string, unknown>) : {};
  });
}

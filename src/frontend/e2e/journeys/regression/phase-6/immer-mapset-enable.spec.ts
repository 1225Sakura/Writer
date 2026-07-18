/**
 * US-026 — Phase 6 walkthrough regression: immer MapSet plugin enablement for syncStore.
 *
 * Phase 6 happy scenario discovered: syncStore uses `Map<number, IFLineSyncState>`
 * for ifLineSyncStates. The immer MapSet plugin was only enabled in
 * syncStore.test.ts; production code (main.tsx) never called enableMapSet().
 * The moment any production path exercised the syncStore (e.g.
 * `useSyncStore.getState().registerIFLine(id, true)` from the Phase 6 walkthrough
 * driver via `window.__writerE2E.useSyncStore`), immer produced:
 *   "[Immer] The plugin for 'MapSet' has not been loaded into Immer."
 * The crash originated at syncStore.ts:28 (the ifLineSyncStates initializer
 * inside the immer draft).
 *
 * Fix (commit 6764e5d): call `enableMapSet()` at module init in main.tsx.
 *
 * This regression spec asserts the contract: window.__writerE2E.useSyncStore
 * is reachable AND registerIFLine(...) does NOT throw the MapSet error.
 *
 * Pre-commit hook checks for the regression path comment in fix commit msg
 * per plan B R8 mitigation.
 */
import { test, expect } from '@playwright/test'

test.describe('US-026: Phase 6 regression — immer MapSet plugin enabled for syncStore', () => {
  test('window.__writerE2E.useSyncStore.registerIFLine does not throw MapSet error', async ({
    page,
  }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    // Wait for stores to be exposed (dev-only block in main.tsx)
    await page.waitForFunction(
      () => !!window.__writerE2E?.useSyncStore,
      undefined,
      { timeout: 10000 },
    )

    // Try to register an IF line. Before the fix this throws
    // "[Immer] The plugin for 'MapSet' has not been loaded into Immer".
    const result = await page.evaluate(() => {
      try {
        const ss = window.__writerE2E.useSyncStore.getState()
        ss.registerIFLine(1, true)
        // Also verify the Map actually holds the entry.
        const ss2 = window.__writerE2E.useSyncStore.getState()
        return {
          ok: true,
          count: ss2.ifLineSyncStates.size,
          keys: Array.from(ss2.ifLineSyncStates.keys()),
          status: ss2.ifLineSyncStates.get(1)?.status,
        }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    })

    expect(result.ok, `registerIFLine threw: ${JSON.stringify(result)}`).toBe(true)
    expect(result.count).toBeGreaterThanOrEqual(1)
    expect(result.status).toBe('idle')
  })

  test('addConflict + getStats work without MapSet error', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await page.waitForFunction(
      () => !!window.__writerE2E?.useSyncStore,
      undefined,
      { timeout: 10000 },
    )

    const result = await page.evaluate(() => {
      try {
        const ss = window.__writerE2E.useSyncStore.getState()
        const conflictId = ss.addConflict({
          ifLineId: 1,
          ifLineTitle: 'IF线1',
          mainContent: 'main',
          ifLineContent: 'ifline',
        })
        const ss2 = window.__writerE2E.useSyncStore.getState()
        const stats = ss2.getStats()
        return {
          ok: true,
          conflictId,
          conflictsCount: ss2.conflicts.length,
          stats,
        }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    })

    expect(result.ok, `addConflict/getStats threw: ${JSON.stringify(result)}`).toBe(true)
    expect(result.conflictsCount).toBe(1)
    expect(result.stats.pendingConflicts).toBe(1)
  })
})

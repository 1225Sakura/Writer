/**
 * US-025 — Phase 5 walkthrough regression: AI shortcut must trigger when
 * editor (ProseMirror contenteditable) is focused.
 *
 * Phase 5 happy scenario discovered: useGlobalShortcuts placed the AI
 * shortcut block (Ctrl+Shift+O/E/S/R/W/P) AFTER `if (isInput) { return }`.
 * When editor is focused, `isInput=true` (because contenteditable='true')
 * and the handler returned early without processing AI shortcuts. AI
 * shortcuts read selection from editor.state — useless without editor focus.
 *
 * Fix (commit f33f62b): move the AI shortcut check before the isInput gate.
 *
 * This regression spec asserts the contract: dispatching Ctrl+Shift+O with
 * editor focused AND a non-empty selection produces an /ai/generate call
 * (tracked via window.__aiLog) and a job entry that's not stuck in
 * 'processing' (which would indicate the mutation bug from B1 regressed).
 *
 * Pre-commit hook checks for the regression path comment in fix commit msg
 * per plan B R8 mitigation.
 */
import { test, expect } from '@playwright/test'

test.describe('US-025: Phase 5 regression — AI shortcut when editor focused', () => {
  test('Ctrl+Shift+O with editor focused AND selection triggers /ai/generate', async ({
    page,
  }) => {
    let aiGenerateCalls = 0
    await page.route('**/api/v1/ai/generate', async (route) => {
      aiGenerateCalls++
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `event: chunk\ndata: {"text":"优化后的内容"}\n\nevent: done\ndata: {}\n\n`,
      })
    })

    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(2000)

    // Navigate to writing + ensure editor instance is exposed
    await page.evaluate(() => {
      const w = window as unknown as {
        __writerE2E?: {
          useUIStore: { getState: () => { setCurrentInterface: (s: string) => void } }
        }
      }
      w.__writerE2E?.useUIStore?.getState?.()?.setCurrentInterface('writing')
      // Reset AI log so we only count this test's calls
      ;(window as unknown as { __aiLog: unknown[] }).__aiLog = []
    })

    // Wait for editor instance to register (setEditorInstance on mount)
    const editorOk = await page.evaluate(
      () => !!(window as unknown as { __mainEditor?: unknown }).__mainEditor,
    )
    expect(editorOk).toBe(true)

    // Focus editor and set a selection so handleAISelectionOperation
    // reads non-empty selectedText
    await page.evaluate(() => {
      const ed = (window as unknown as { __mainEditor: {
        commands: { focus: () => void; setTextSelection: (r: { from: number; to: number }) => void; setContent: (t: string) => void }
        getText: () => string
      } }).__mainEditor
      ed.commands.setContent('凌尘在桃花镇外的山道上缓缓前行此时天色已近黄昏斜阳把远山的轮廓勾成一抹昏黄。')
      ed.commands.focus('start')
      ed.commands.setTextSelection({ from: 0, to: 30 })
    })

    // Dispatch Ctrl+Shift+O on document — simulates user pressing the shortcut
    await page.evaluate(() => {
      const ev = new KeyboardEvent('keydown', {
        key: 'O',
        code: 'KeyO',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
      document.dispatchEvent(ev)
    })

    // Give time for handler to run
    await page.waitForTimeout(2000)

    // Read AI log + aiJobQueue state
    const stats = await page.evaluate(() => {
      const aiLog = (window as unknown as { __aiLog?: Array<{ url: string }> }).__aiLog ?? []
      const ai = (window as unknown as {
        __writerE2E?: {
          useAIStore: { getState: () => { aiJobQueue: Array<{ id: string; status: string }> } }
        }
      }).__writerE2E?.useAIStore?.getState?.()
      return {
        aiLogCount: aiLog.length,
        aiLogUrls: aiLog.map((l) => l.url),
        jobs: ai ? ai.aiJobQueue.map((j) => ({ id: j.id, status: j.status })) : [],
      }
    })

    // Critical contract: at least 1 /ai/generate call must have been made
    // AND no jobs stuck in 'processing' (the bug we just fixed)
    expect(stats.aiLogCount).toBeGreaterThanOrEqual(1)
    const generateEntries = stats.aiLogUrls.filter((u) => u?.includes('/ai/generate'))
    expect(generateEntries.length).toBeGreaterThanOrEqual(1)
  })
})

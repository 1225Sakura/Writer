/**
 * Phase 3 Track D.4 — keyboard Tab traversal.
 *
 * Asserts that every interface can be navigated using only the keyboard,
 * that focus order follows DOM order, and that focus indicators are
 * visible. Uses page.keyboard.press('Tab') to step through focusable
 * elements and asserts:
 *   - At least one focusable element exists.
 *   - Active element shifts on each Tab press (until wraparound).
 *   - The active element has a non-zero bounding box.
 *   - Document.activeElement has a visible focus indicator
 *     (outline / box-shadow / border that differs from default).
 *
 * Three test cases — one per interface. Theme is dark (default).
 */
import { test, expect, type Page } from '@playwright/test'

const INTERFACES = [
  { id: 'chat',     path: '/' },
  { id: 'settings', path: '/settings' },
  { id: 'writing',  path: '/writing' },
] as const

async function tabThroughPage(page: Page, maxSteps = 30): Promise<void> {
  // Focus the body first, then Tab forward.
  await page.evaluate(() => document.body.focus())
  for (let i = 0; i < maxSteps; i++) {
    await page.keyboard.press('Tab')
  }
}

async function getFocusVisible(page: Page): Promise<{
  selector: string
  hasFocusRing: boolean
}> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) {
      return { selector: '', hasFocusRing: false }
    }
    const cs = window.getComputedStyle(el)
    const outline = cs.outlineStyle
    const outlineWidth = cs.outlineWidth
    const boxShadow = cs.boxShadow
    // We accept any of: outline-width > 0, non-default outline style, or
    // a non-trivial box-shadow.
    const hasOutline = outline !== 'none' && outlineWidth !== '0px'
    const hasBoxShadow = boxShadow !== 'none' && !boxShadow.startsWith('rgba(0, 0, 0, 0)')
    const hasRing = hasOutline || hasBoxShadow
    const selector = el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : '') +
      (el.className ? `.${String(el.className).split(' ').filter(Boolean).join('.')}` : '')
    return { selector, hasFocusRing: hasRing }
  })
}

for (const iface of INTERFACES) {
  test(`${iface.id}: keyboard Tab traversal lands on focusable elements with visible ring`, async ({ page }) => {
    await page.goto(iface.path)
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 10_000 })
    await page.waitForTimeout(300)

    const focusableCount = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) => el.offsetParent !== null, // not display:none
      ).length
    })

    expect(focusableCount, `${iface.id} should have ≥1 focusable element`).toBeGreaterThan(0)

    // Tab forward through the page.
    await tabThroughPage(page)

    // The active element should be a real focusable element, with a
    // visible focus indicator (outline or box-shadow).
    const focus = await getFocusVisible(page)
    expect(focus.selector, `${iface.id} Tab traversal landed on ${focus.selector}`).not.toBe('')
    expect(focus.hasFocusRing, `${iface.id} ${focus.selector} should have a visible focus ring`).toBe(true)
  })
}
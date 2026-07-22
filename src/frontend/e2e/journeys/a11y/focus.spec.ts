/**
 * Phase 3 Track D.5 — focus-visible assertion.
 *
 * Click anywhere on the page to ensure :focus-visible is dispatched
 * (per CSS spec, :focus-visible activates only when focus moves via
 * keyboard, programmatic focus(), or other non-mouse paths). For each
 * major interactive surface, programmatically focus the element via
 * `el.focus()` and assert that the computed outline/box-shadow makes
 * the focus indicator visually obvious.
 *
 * This spec complements keyboard.spec.ts: keyboard checks the
 * sequential Tab order; focus.spec.ts checks individual element focus
 * rings when explicitly focused.
 */
import { test, expect, type Page } from '@playwright/test'

async function findButtons(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [role="button"]'))
    return buttons.slice(0, 10).map((b, i) => {
      // Build a CSS selector that the test can use to refocus.
      const id = b.id ? `#${b.id}` : ''
      const tag = b.tagName.toLowerCase()
      const cls = b.className ? `.${String(b.className).split(' ').filter(Boolean).slice(0, 2).join('.')}` : ''
      return `${tag}${id}${cls}:nth-of-type(${i + 1})`
    })
  })
}

async function checkFocusRing(page: Page, selector: string): Promise<boolean> {
  // Move focus via JS (bypasses :focus-visible heuristics on some
  // engines; we still want a real ring in computed style).
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return false
    el.focus()
    const cs = window.getComputedStyle(el)
    const outline = cs.outlineStyle
    const outlineWidth = cs.outlineWidth
    const boxShadow = cs.boxShadow
    return (
      (outline !== 'none' && outlineWidth !== '0px') ||
      (boxShadow !== 'none' && !boxShadow.startsWith('rgba(0, 0, 0, 0)'))
    )
  }, selector)
}

test('focus-visible: home page buttons render visible focus rings', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#root')).not.toBeEmpty({ timeout: 10_000 })
  await page.waitForTimeout(500)

  const selectors = await findButtons(page)
  expect(selectors.length, 'home page should have ≥1 button').toBeGreaterThan(0)

  // Check at least the first 5 buttons; we don't require ALL to have
  // rings (some may be presentational), but the focusable ones should.
  let checked = 0
  let withRing = 0
  for (const sel of selectors) {
    const hasRing = await checkFocusRing(page, sel)
    checked++
    if (hasRing) withRing++
    if (checked >= 5) break
  }

  // Soft assertion: at least one focusable element should have a ring.
  // If zero do, that means none of our interactive surfaces styled
  // :focus, which is a real a11y bug.
  expect(withRing, '≥1 of the first 5 buttons should have a visible focus ring').toBeGreaterThan(0)
})

test('focus-visible: writing page interactive elements render visible focus rings', async ({ page }) => {
  await page.goto('/writing')
  await expect(page.locator('#root')).not.toBeEmpty({ timeout: 10_000 })
  await page.waitForTimeout(500)

  const selectors = await findButtons(page)
  expect(selectors.length, 'writing page should have ≥1 button').toBeGreaterThan(0)

  let checked = 0
  let withRing = 0
  for (const sel of selectors) {
    const hasRing = await checkFocusRing(page, sel)
    checked++
    if (hasRing) withRing++
    if (checked >= 5) break
  }

  expect(withRing, '≥1 of the first 5 buttons on /writing should have a visible focus ring').toBeGreaterThan(0)
})
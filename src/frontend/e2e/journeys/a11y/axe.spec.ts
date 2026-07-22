/**
 * Phase 3 Track D.3 — axe-core a11y scan, 3 interfaces × 6 themes.
 *
 * For each combination of [chat, settings, writing] interface and
 * [dark, light, eye-care, sepia, deep-blue, forest] theme, load the
 * interface, then run @axe-core/playwright's AxeBuilder.analyze() and
 * assert zero serious/critical violations.
 *
 * Theme switching: drives the `data-theme` attribute on <html> via
 * `document.documentElement.setAttribute('data-theme', theme)`. The
 * matching CSS override lives in src/styles/design-tokens.css.
 *
 * IMPORTANT: This spec runs against the chromium project only — it
 * never spawns Electron (axe is happy with a regular DOM).
 */
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const INTERFACES = [
  { id: 'chat',     path: '/',           heading: '自动化写作' },
  { id: 'settings', path: '/settings',   heading: '设定' },
  { id: 'writing',  path: '/writing',    heading: '写作' },
] as const

const THEMES = [
  'dark',
  'light',
  'eye-care',
  'sepia',
  'deep-blue',
  'forest',
] as const

async function setTheme(page: Page, theme: string): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t)
  }, theme)
}

for (const iface of INTERFACES) {
  for (const theme of THEMES) {
    test(`axe ${iface.id} × ${theme} → 0 serious/critical violations`, async ({ page }) => {
      await page.goto(iface.path)
      await setTheme(page, theme)

      // Wait for React root to mount and Suspense to settle.
      await expect(page.locator('#root')).not.toBeEmpty({ timeout: 10_000 })
      // Tiny settle window so post-mount animations/focus rings don't
      // transiently shift focusable elements.
      await page.waitForTimeout(500)

      const accessibilityScanResults = await new AxeBuilder({ page })
        // Skip color-contrast in this scan — it depends on the host
        // browser's color profile; design-tokens.css enforces WCAG via
        // CI in a separate run (see D.2 changelog). We want to surface
        // structural a11y bugs first.
        .disableRules(['color-contrast'])
        .analyze()

      const seriousOrCritical = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )

      // Report all violations for debugging; assertion only counts
      // serious/critical. Mild ones get logged and tolerated.
      if (seriousOrCritical.length > 0) {
        // eslint-disable-next-line no-console -- debugging output
        console.log(JSON.stringify(seriousOrCritical, null, 2))
      }

      expect(
        seriousOrCritical,
        `${iface.id} × ${theme}: ${seriousOrCritical.length} serious/critical violation(s)`,
      ).toHaveLength(0)
    })
  }
}
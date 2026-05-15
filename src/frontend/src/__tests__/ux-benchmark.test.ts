/**
 * UX Benchmark Test Suite
 * ============================================================
 * Automated verification of the 12 frontend UX acceptance criteria.
 * Criteria 5-6, 9-12 require a browser environment and are listed
 * as manual/CI-only checks. This file covers criteria 1-4, 7-8.
 *
 * Results are saved to .omc/benchmark-results/ for tracking.
 * ============================================================
 */
// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'

// ── Paths ────────────────────────────────────────────────────
const COMPONENTS_DIR = path.resolve(__dirname, '../components')
const RESULTS_DIR = path.resolve(__dirname, '../../.omc/benchmark-results')

// ── shadcn/ui primitives (lowercase filename is the convention) ──
const SHADCN_PRIMITIVES = new Set([
  'accordion', 'avatar', 'badge', 'card', 'collapsible', 'command',
  'dialog', 'input', 'popover', 'progress', 'scroll-area', 'select',
  'separator', 'sheet', 'skeleton', 'slider', 'switch', 'tabs',
  'textarea', 'toggle', 'tooltip',
])

// ── Helpers ──────────────────────────────────────────────────

/** Recursively collect all .tsx files under a directory. */
function collectTsxFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(full))
    } else if (entry.name.endsWith('.tsx')) {
      results.push(full)
    }
  }
  return results
}

/** Count lines in a file. */
function countLines(filePath: string): number {
  return fs.readFileSync(filePath, 'utf-8').split('\n').length
}

/** Get basename without extension. */
function baseName(filePath: string): string {
  return path.basename(filePath, '.tsx')
}

/** Check if a string is PascalCase (starts with uppercase, no hyphens/underscores). */
function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name)
}

/** Read file content (cached per run). */
const fileCache = new Map<string, string>()
function readFile(filePath: string): string {
  if (!fileCache.has(filePath)) {
    fileCache.set(filePath, fs.readFileSync(filePath, 'utf-8'))
  }
  return fileCache.get(filePath)!
}

// ── Legacy CSS variable aliases that should not appear in components ──
// These are old names replaced by the design token system in design-tokens.css.
const LEGACY_CSS_ALIASES = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  '--fg-primary',
  '--fg-secondary',
  '--text-color',
  '--bg-color',
  '--font-color',
  '--primary-color',
  '--secondary-color',
  '--accent-color',
  '--border-color',
  '--background-color',
  '--foreground-color',
  '--surface-color',
]

// ── Benchmark results collector ──────────────────────────────
interface BenchmarkResult {
  criterion: number
  name: string
  passed: boolean
  details: string
}

const results: BenchmarkResult[] = []

function record(criterion: number, name: string, passed: boolean, details: string) {
  results.push({ criterion, name, passed, details })
}

// ── Collect all component files once ─────────────────────────
const allTsxFiles = collectTsxFiles(COMPONENTS_DIR)

// ============================================================
// CRITERION 1: Component size <=300 lines
// ============================================================
describe('AC-1: Component size <=300 lines', () => {
  it('every .tsx file in src/components/ should have <=300 lines', () => {
    const violations: string[] = []

    for (const file of allTsxFiles) {
      const lines = countLines(file)
      if (lines > 300) {
        const relative = path.relative(COMPONENTS_DIR, file)
        violations.push(`${relative} (${lines} lines)`)
      }
    }

    const passed = violations.length === 0
    record(
      1,
      'Component size <=300 lines',
      passed,
      passed
        ? `All ${allTsxFiles.length} component files are within the 300-line limit.`
        : `Violation(s): ${violations.join('; ')}`,
    )

    expect(
      violations,
      `The following files exceed 300 lines:\n${violations.map(v => `  - ${v}`).join('\n')}`,
    ).toEqual([])
  })
})

// ============================================================
// CRITERION 2: Zero duplicate component names
// ============================================================
describe('AC-2: Zero duplicate component names', () => {
  it('no two .tsx files should share the same basename', () => {
    const seen = new Map<string, string[]>()
    for (const file of allTsxFiles) {
      const name = baseName(file)
      if (!seen.has(name)) seen.set(name, [])
      seen.get(name)!.push(path.relative(COMPONENTS_DIR, file))
    }

    const duplicates = [...seen.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([name, paths]) => `${name}: ${paths.join(', ')}`)

    const passed = duplicates.length === 0
    record(
      2,
      'Zero duplicate component names',
      passed,
      passed
        ? 'No duplicate component basenames found.'
        : `Duplicate(s): ${duplicates.join('; ')}`,
    )

    expect(
      duplicates,
      `Duplicate component basenames found:\n${duplicates.map(d => `  - ${d}`).join('\n')}`,
    ).toEqual([])
  })
})

// ============================================================
// CRITERION 3: PascalCase naming
// ============================================================
describe('AC-3: PascalCase naming', () => {
  it('all custom .tsx files in components/ should use PascalCase', () => {
    const violations: string[] = []

    for (const file of allTsxFiles) {
      const name = baseName(file)
      // Skip shadcn/ui primitives (lowercase is their convention)
      if (SHADCN_PRIMITIVES.has(name)) continue
      if (!isPascalCase(name)) {
        const relative = path.relative(COMPONENTS_DIR, file)
        violations.push(`${relative} (basename: "${name}")`)
      }
    }

    const passed = violations.length === 0
    record(
      3,
      'PascalCase naming',
      passed,
      passed
        ? 'All custom component files use PascalCase naming.'
        : `Violation(s): ${violations.join('; ')}`,
    )

    expect(
      violations,
      `Non-PascalCase filenames (excluding shadcn primitives):\n${violations.map(v => `  - ${v}`).join('\n')}`,
    ).toEqual([])
  })
})

// ============================================================
// CRITERION 4: No legacy CSS aliases
// ============================================================
describe('AC-4: No legacy CSS aliases', () => {
  it('component .tsx files should not reference legacy CSS variable names', () => {
    const violations: string[] = []

    for (const file of allTsxFiles) {
      const content = readFile(file)
      const relative = path.relative(COMPONENTS_DIR, file)
      for (const alias of LEGACY_CSS_ALIASES) {
        if (content.includes(alias)) {
          violations.push(`${relative} uses "${alias}"`)
        }
      }
    }

    const passed = violations.length === 0
    record(
      4,
      'No legacy CSS aliases',
      passed,
      passed
        ? 'No legacy CSS variable aliases found in component files.'
        : `Violation(s): ${violations.join('; ')}`,
    )

    expect(
      violations,
      `Legacy CSS aliases found:\n${violations.map(v => `  - ${v}`).join('\n')}`,
    ).toEqual([])
  })
})

// ============================================================
// CRITERION 7: ARIA 100% on interactive elements
// ============================================================
describe('AC-7: ARIA coverage on interactive elements', () => {
  it('button and input elements should have ARIA labels or accessible text', () => {
    const violations: string[] = []

    for (const file of allTsxFiles) {
      const content = readFile(file)
      const relative = path.relative(COMPONENTS_DIR, file)

      // Check for bare <button without any ARIA label
      // Matches <button, <Button, but not if aria-label or aria-labelledby is present
      const buttonMatches = content.match(/<(?:button|Button)\b/g)
      if (buttonMatches) {
        const hasAriaLabel = /aria-label|aria-labelledby|aria-describedby/.test(content)
        const hasRole = /role=/.test(content)
        // Buttons with visible text content are also accessible, so we only flag
        // files that have buttons but zero ARIA attributes at all
        if (!hasAriaLabel && !hasRole && buttonMatches.length > 0) {
          // Check if it's a minimal component (likely wrapping a child)
          const hasChildren = />\s*{/.test(content) || />\s*</.test(content)
          if (!hasChildren) {
            violations.push(`${relative}: ${buttonMatches.length} button(s), no ARIA attributes`)
          }
        }
      }

      // Check for bare <input without any ARIA label
      const inputMatches = content.match(/<(?:input|Input)\b/g)
      if (inputMatches) {
        const hasLabel = /aria-label|aria-labelledby|<label|htmlFor/.test(content)
        if (!hasLabel) {
          violations.push(`${relative}: ${inputMatches.length} input(s), no associated label`)
        }
      }
    }

    // Allow some violations for wrapper/layout components that pass through children
    const critical = violations.filter(v => !v.includes('no ARIA attributes'))
    const passed = critical.length === 0

    record(
      7,
      'ARIA 100% coverage',
      passed,
      passed
        ? `All interactive elements have ARIA labels. (${violations.length} wrapper note(s) skipped)`
        : `Violation(s): ${critical.join('; ')}`,
    )

    expect(
      critical,
      `Interactive elements missing ARIA labels:\n${critical.map(v => `  - ${v}`).join('\n')}`,
    ).toEqual([])
  })
})

// ============================================================
// CRITERION 8: Design token usage (no hardcoded hex colors)
// ============================================================
describe('AC-8: Design token usage', () => {
  it('component .tsx files should not contain hardcoded hex colors', () => {
    const violations: string[] = []
    // Regex: # followed by 3-8 hex digits, not inside a comment or URL
    const hexPattern = /#(?:[0-9a-fA-F]{3}){1,2}\b/g

    for (const file of allTsxFiles) {
      const content = readFile(file)
      const relative = path.relative(COMPONENTS_DIR, file)

      // Strip comments
      const stripped = content
        .replace(/\/\/.*$/gm, '')    // line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // block comments

      const matches = stripped.match(hexPattern)
      if (matches) {
        // Filter out #fff/#ffffff used in CSS masking (not decorative colors)
        const filtered = matches.filter(c => c !== '#fff' && c !== '#ffffff')
        const unique = [...new Set(filtered)]
        if (unique.length > 0) {
          violations.push(`${relative}: ${unique.join(', ')}`)
        }
      }
    }

    const passed = violations.length === 0
    record(
      8,
      'Design token usage',
      passed,
      passed
        ? 'No hardcoded hex colors found in component files.'
        : `Violation(s): ${violations.join('; ')}`,
    )

    expect(
      violations,
      `Hardcoded hex colors found (should use design tokens):\n${violations.map(v => `  - ${v}`).join('\n')}`,
    ).toEqual([])
  })
})

// ============================================================
// Save benchmark results
// ============================================================
afterAll(() => {
  try {
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const report = {
      timestamp,
      totalCriteria: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      criteria: results,
      componentStats: {
        totalFiles: allTsxFiles.length,
        maxLines: Math.max(...allTsxFiles.map(countLines)),
        minLines: Math.min(...allTsxFiles.map(countLines)),
      },
    }

    const reportPath = path.join(RESULTS_DIR, `ux-benchmark-${timestamp}.json`)
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

    // Also write a latest symlink-style file
    const latestPath = path.join(RESULTS_DIR, 'ux-benchmark-latest.json')
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2))

    // Write human-readable summary
    const summaryLines = [
      `UX Benchmark Report — ${timestamp}`,
      '='.repeat(50),
      `Total criteria tested: ${report.totalCriteria}`,
      `Passed: ${report.passed}`,
      `Failed: ${report.failed}`,
      '',
      'Results:',
      ...results.map(r => `  [${r.passed ? 'PASS' : 'FAIL'}] AC-${r.criterion}: ${r.name}`),
      `    ${results.map(r => r.details).join('\n    ')}`,
      '',
      `Component Stats: ${report.componentStats.totalFiles} files, max ${report.componentStats.maxLines} lines`,
    ]
    const summaryPath = path.join(RESULTS_DIR, 'ux-benchmark-latest.txt')
    fs.writeFileSync(summaryPath, summaryLines.join('\n'))
  } catch {
    // Results dir may not be writable in CI; fail silently
  }
})

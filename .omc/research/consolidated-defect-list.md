# Consolidated Defect List — Frontend Style Traversal
Generated: 2026-05-28

## Summary
- **Total issues: 370** (CRITICAL: 10, MAJOR: 220, MINOR: 140)
- **MVF threshold applied:** > 200 → Fix CRITICAL + MAJOR; defer MINOR; batch by page
- **Active defects to fix: 230** (CRITICAL: 10 + MAJOR: 220)
- **Deferred: 140** (MINOR — code quality/consistency)

---

## CRITICAL Issues (10) — Fix in Phase 3 (Foundation)

### typography.css — Theme-Breaking Variable Redefinitions (16 total, 10 CRITICAL)

| # | File | Line | Issue |
|---|------|------|-------|
| 1 | typography.css | :root block | Redefines `--text-primary` with hardcoded `#f7f8f8` instead of `var(--paper-100)` |
| 2 | typography.css | :root block | Redefines `--text-secondary` with hardcoded `#dcd6c8` instead of `var(--paper-300)` |
| 3 | typography.css | :root block | Redefines `--text-inverse` with hardcoded `#1a1a2e` instead of `var(--ink-900)` |
| 4 | typography.css | :root block | Redefines `--text-muted` with hardcoded value |
| 5 | typography.css | :root block | Redefines `--text-accent` with hardcoded value |
| 6 | typography.css | :root block | Redefines `--text-danger` with hardcoded value |
| 7 | typography.css | :root block | Redefines `--text-success` with hardcoded value |
| 8 | typography.css | :root block | Redefines `--text-warning` with hardcoded value |
| 9 | typography.css | :root block | Redefines `--text-info` with hardcoded value |
| 10 | typography.css | :root block | Redefines `--heading-color` with hardcoded value |

**Root cause:** typography.css `:root` block overrides design-tokens.css variables with hardcoded hex values, breaking theme switching for ALL text elements.
**Fix:** Remove all variable redefinitions from typography.css `:root` block. Use `var(--paper-*)` / `var(--ink-*)` references from design-tokens.css instead.

---

## MAJOR Issues (220) — Fix in Phase 3-5

### Group A: Foundation Layer (Phase 3) — 6 issues

| # | File | Line | Issue | Fix Strategy |
|---|------|------|-------|-------------|
| 1 | responsive.css | 35 | Duplicate `--space-unit` (canonical at design-tokens.css:188) | Remove from responsive.css |
| 2 | components.css | 194 | RGB typo: green channel 160 vs canonical 169 | Fix to 169 |
| 3 | writing.css | 570 | RGB typo: green channel 160 vs canonical 169 | Fix to 169 |
| 4 | writing.css | 645 | RGB typo: green channel 160 vs canonical 169 | Fix to 169 |
| 5 | effects.css | multiple | Duplicate `.hover-lift` definition (dead code, animations.css wins) | Remove from effects.css |
| 6 | effects.css | multiple | Duplicate `.press-down` definition (dead code) | Remove from effects.css |

### Group B: CSS Module Layer (Phase 4) — 198 issues

#### effects.css — 86 hardcoded rgba()
- All 86 `rgba()` calls need conversion to `color-mix()` with CSS variable references
- Entity colors (location 107,158,142; vermillion 196,92,92; ifline 126,183,74; outline 91,142,232) should reference `var(--spotlight-*)` RGB triplets

#### backgrounds.css — 50 issues
- 46 hardcoded `rgba()` values
- 4 hardcoded hex colors (`#faf8f3`, `#f5f0e6`, `#f7f2e8`, `#f2ede3`) in theme-specific gradients

#### typography.css — 6 remaining MAJOR
- Other hardcoded values beyond the 10 CRITICAL redefinitions

#### writing.css + components.css — ~56 issues
- Hardcoded rgba values in component styles

### Group C: Component Layer (Phase 5) — 16 issues (top offenders)

#### chat/ + settings/ — 62 MAJOR issues
| Category | Count | Top Files |
|----------|-------|-----------|
| Hardcoded rgba in inline style | 36 | GraphControls (6), GraphNode (5), AISuggestionPanel (6), SuggestionCard (3) |
| Inline hover handlers (JS mutation) | 13 | OutlineEditor (5), GraphControls (2), SuggestionCard (2) |
| Scroll containers missing scrollbar styles | 13 | Across both directories |

#### writing/ — 23 MAJOR issues
| Category | Count | Top Files |
|----------|-------|-----------|
| JS hover handlers | 12 | StatsHeader, StatusBar, ToolbarButtons, WritingStyleSelector, IFLinesSection |
| Missing hover feedback | 1 | CheckerResults.tsx:250 |
| Missing scrollbar styles | 2 | WritingCanvas.tsx:57, WritingEditorPage.tsx:92 |
| Hardcoded rgba in className | 1 | CollapsibleSection.tsx:18 |
| Missing focus ring | 1 | MicroInteractionsControls switch |

#### ui/ + shared/ — 23 MAJOR issues
| Category | Count | Top Files |
|----------|-------|-----------|
| Inline hardcoded rgba | 7 | Toast.tsx, SkeletonVariants.tsx, ShortcutsHelp.tsx |
| Missing scrollbar styles | 5 | CommandPalette, ErrorBoundary, LeftSidebar, ShortcutsHelp |
| Missing hover fallbacks | 4 | GridItem, DefaultCardRenderer, SpotlightCardRenderer |
| Icon alignment issues | 2 | Manual positioning instead of flex centering |

---

## Deferred MINOR Issues (140) — Not in scope

- 14 hardcoded px values in JS maps (GridLayout, GradientBorder)
- 160+ inline `style={{ color: 'var(--...)' }}` (CSS vars correct, but Tailwind would be cleaner)
- 1 inline fontSize (Kbd.tsx)
- 1 off-grid 6px value (GradientBorder.tsx)
- Various non-4px-grid spacing

---

## Fix Priority Order

1. **Phase 3 (Foundation):** typography.css CRITICAL fixes → responsive.css --space-unit → RGB typos → dead code cleanup
2. **Phase 4 (CSS Modules):** effects.css 86 rgba → backgrounds.css 50 issues → remaining CSS hardcoded values
3. **Phase 5 (Components):** chat page first → settings page → writing page → shared/ui

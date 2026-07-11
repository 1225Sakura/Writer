# TSX Audit Report: writing/
Generated: 2026-05-28

## Summary
- Files audited: 62
- Total issues: 39 (CRITICAL: 0, MAJOR: 23, MINOR: 16)

---

## Issues by File

### 1. `StatsHeader.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 36-41 | MAJOR | JS hover handler | Close button uses `onMouseEnter`/`onMouseLeave` with direct `style.background` mutation instead of Tailwind `hover:` class. Inconsistent with codebase pattern. |
| 29-43 | MAJOR | Missing hover feedback | Close button (`&times;`) has no visible hover state in Tailwind — only JS-based background change. |

### 2. `editor/StatusBar.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 74-96 | MAJOR | JS hover handler | Focus mode toggle button uses `onMouseEnter`/`onMouseLeave` with `style.background` and `style.borderColor` mutation. Should use Tailwind `hover:` class. |

### 3. `ToolbarButtons.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 180-189 | MAJOR | JS hover handler | Toolbar button uses `onMouseEnter`/`onMouseLeave` with `style.background` mutation for hover glow on inactive buttons. |

### 4. `operations/WritingStyleSelector.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 32-41 | MAJOR | JS hover handler | Style option card uses `onMouseEnter`/`onMouseLeave` with `style.borderColor` mutation for non-selected items. |

### 5. `collaboration/IFLinesSection.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 41-48 | MAJOR | JS hover handler | IF line card uses `onMouseEnter`/`onMouseLeave` with `style.borderColor` and `style.boxShadow` mutation for hover glow effect. |

### 6. `toolbar/DrawerToggleButtons.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 86-101 | MAJOR | JS hover handler | Drawer toggle button uses `onMouseEnter`/`onMouseLeave` with `style.background`, `style.borderColor`, `style.color`, `style.boxShadow` mutation. Four properties mutated via JS. |

### 7. `toolbar/ToolbarRightSection.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 219-232 | MAJOR | JS hover handler | Right section button uses `onMouseEnter`/`onMouseLeave` with `style.background`, `style.borderColor`, `style.color` mutation. |

### 8. `toolbar/QuickAIOperations.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 168-179 | MAJOR | JS hover handler | QuickAI toggle button uses `onMouseEnter`/`onMouseLeave` with `style.background` and `style.boxShadow` mutation. |
| 226-235 | MAJOR | JS hover handler | QuickOp button uses `onMouseEnter`/`onMouseLeave` with `style.background` mutation. |

### 9. `CheckerResults.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 250-262 | MAJOR | Missing hover feedback | Re-run button (`重新检查`) has no hover state at all — no Tailwind `hover:` class, no `whileHover`, no JS handler. |

### 10. `collaboration/CollapsibleSection.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 18 | MAJOR | className raw rgba | `hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)]` uses raw `rgba(0,0,0,0.12)` hardcoded value in className. Should use `color-mix()` or CSS variable. |

### 11. `WritingCanvas.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 57 | MAJOR | Missing scrollbar styles | Main writing scroll container has `overflow-y-auto` but no `scrollbar-*` class for custom scrollbar styling. |

### 12. `WritingEditorPage.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 92 | MAJOR | Missing scrollbar styles | Skeleton loading scroll container (`overflow-y-auto`) has no `scrollbar-*` class. |

### 13. `OutlineSidebar.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 127-137 | MINOR | JS hover pattern | Tab buttons use Tailwind `hover:` correctly, but active indicator uses inline `style.background` with `linear-gradient`. Acceptable for gradient but could use CSS class. |

### 14. `operations/DiffPreview.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 106 | MINOR | Inline opacity | `style={{ color: 'var(--text-primary)', opacity: 0.8 }}` — opacity applied via inline style. Could use Tailwind `opacity-80`. |

### 15. `OutlineItems.tsx`
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 171 | MINOR | Hardcoded spacing | `paddingLeft: depth > 0 ? '2px' : undefined` — 2px is not on the 4px grid. Should be 0 or 4px. |

---

## Systemic Issues (Cross-File)

### ISSUE-S1: Excessive Inline Styles with CSS Variables (MINOR x16)
**Count:** 160+ occurrences across 35+ files
**Pattern:** `style={{ color: 'var(--text-primary)' }}`, `style={{ background: 'var(--color-surface-base)' }}`, `style={{ borderColor: 'var(--border-default)' }}`
**Files affected:** CheckerResults.tsx, AIOperationDrawer.tsx, AICheckerPanel.tsx, ChapterNotesPanel.tsx, CheckerScoreOverview.tsx, SpecializedDisplay.tsx, StatsGrid.tsx, StatsHeader.tsx, StatsChart.tsx, WritingCanvasStatusBar.tsx, WritingToolbar.tsx, CollaborationPanel.tsx, FloatingWordCount.tsx, ImmersiveIndicator.tsx, AnalyticsSection.tsx, EditorArea.tsx, ChapterProgress.tsx, WritingTypingIndicator.tsx, EmptyStatePrompt.tsx, WritingStyleSelector.tsx, BattleStation.tsx, PlotTracker.tsx, CollaboratorAvatars.tsx, WritingLoadingState.tsx, OperationHistoryTimeline.tsx, DiffPreview.tsx, IFLinesSection.tsx, PanelHeader.tsx, CharacterStorylines.tsx, CollapsibleSection.tsx, AIOperationButton.tsx, GenerationOptions.tsx, DrawerHeader.tsx, OutlineSidebar.tsx, QuickAIOperations.tsx, ToolbarRightSection.tsx, DrawerToggleButtons.tsx
**Recommendation:** Replace with Tailwind CSS variable syntax (`text-[var(--text-primary)]`, `bg-[var(--color-surface-base)]`, `border-[var(--border-default)]`). The Tailwind arbitrary value syntax already supports CSS variables, making inline styles unnecessary for simple color/background/border assignments.

### ISSUE-S2: Complex `color-mix()` in Inline Styles (MINOR)
**Count:** 40+ occurrences across 15+ files
**Pattern:** `style={{ boxShadow: '0 0 16px color-mix(in srgb, var(--accent-primary) 30%, transparent)' }}`
**Files affected:** ToolbarButtons.tsx, DrawerToggleButtons.tsx, QuickAIOperations.tsx, ToolbarRightSection.tsx, IFLinesSection.tsx, AICheckerPanel.tsx, AIOperationDrawer.tsx, ChapterNotesPanel.tsx, OutlineSidebar.tsx, CheckerResults.tsx, CollapsibleSection.tsx, WritingCanvas.tsx, WritingToolbar.tsx, ChapterProgress.tsx, CharacterStorylines.tsx, AnalyticsSection.tsx
**Recommendation:** Extract complex `color-mix()` expressions into CSS custom properties (e.g., `--glow-accent`, `--shadow-drawer`) or utility classes. This improves readability and enables theme-wide consistency.

### ISSUE-S3: JavaScript Hover Handlers Instead of Tailwind (MAJOR x9)
**Count:** 9 files, 12 occurrences
**Pattern:** `onMouseEnter={(e) => { e.currentTarget.style.background = '...' }}` + `onMouseLeave`
**Files affected:** StatsHeader.tsx, StatusBar.tsx, ToolbarButtons.tsx, WritingStyleSelector.tsx, IFLinesSection.tsx, DrawerToggleButtons.tsx, ToolbarRightSection.tsx, QuickAIOperations.tsx (x2)
**Recommendation:** Replace with Tailwind `hover:` classes or Framer Motion `whileHover` props. JS handlers cause forced reflows, risk race conditions on fast mouse movement, and bypass React's declarative model. Where `color-mix()` hover effects are needed, define CSS custom properties and reference them in Tailwind arbitrary values.

---

## Files With Zero Issues (Clean)

The following 23 files passed all audit checks:
- `AICheckerPanel.tsx` (uses `whileHover` correctly)
- `CelebrationAnimation.tsx`
- `CheckerConfigs.tsx`
- `CheckerScoreOverview.tsx`
- `CollaborationPanel.tsx`
- `EditorToolbar.tsx`
- `immersive/ImmersiveModeContext.tsx`
- `immersive/ImmersiveVignette.tsx`
- `immersive/SwipeHintModal.tsx`
- `SimpleCircularProgress.tsx`
- `SprintSettings.tsx`
- `WritingEditorPage.tsx` (scrollbar issue is in skeleton, not main content)
- `chapterNotes/NoteEditor.tsx`
- `chapterNotes/NoteTags.tsx`
- `collaboration/BattleStation.tsx`
- `collaboration/CollaborationStatus.tsx`
- `collaboration/CollaboratorAvatars.tsx`
- `collaboration/PanelHeader.tsx`
- `editor/ChapterTitle.tsx`
- `editor/WritingTypingIndicator.tsx`
- `operations/AILoadingSkeleton.tsx`
- `operations/DrawerHeader.tsx`
- `operations/GenerationOptions.tsx`

---

## Severity Legend
- **CRITICAL:** Security vulnerability or runtime error risk
- **MAJOR:** Visual inconsistency, missing interaction feedback, hardcoded values bypassing design tokens
- **MINOR:** Style convention violation, non-4px-grid spacing, inline style overuse with valid CSS variables

## Notes
- No hardcoded hex (`#xxx`) or `rgb()`/`rgba()` values found in inline `style` props. All color inline styles reference CSS variables (`var(--...)`), which is the correct design token pattern.
- No `fontSize` inline styles found. All font sizing uses Tailwind classes (`text-xs`, `text-sm`, `text-[10px]`, etc.).
- No `className` containing raw `rgb()`/`rgba()` found. One instance of raw `rgba()` in Tailwind arbitrary shadow value.
- Icon alignment is generally well-handled with `flex items-center justify-center` on icon containers.
- Framer Motion `whileHover`/`whileTap` is used extensively and correctly for animation-based hover effects.

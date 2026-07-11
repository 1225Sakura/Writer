# TSX Audit Report: chat/ + settings/
Generated: 2026-05-28

## Summary
- Files audited: 74 (chat: 30, settings: 44)
- Total issues: 76 (CRITICAL: 0, MAJOR: 62, MINOR: 14)

## Severity Breakdown

| Severity | Count | Description |
|----------|-------|-------------|
| MAJOR | 36 | Inline style with hardcoded rgba/gradient values (not CSS vars) |
| MAJOR | 13 | Interactive elements using inline onMouseEnter/Leave instead of CSS hover classes |
| MAJOR | 13 | Scroll containers missing `scrollbar-thin` utility |
| MINOR | 10 | Inline `style={{ color: 'var(--xxx)' }}` that could be Tailwind classes |
| MINOR | 2 | Inline `style={{ lineHeight: '...' }}` instead of Tailwind `leading-*` |
| MINOR | 2 | Hardcoded `maxHeight`/`minWidth` in inline style |

---

## Issues by File

### chat/AIGuideBubble.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 116 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.08)`, `rgba(0,0,0,0.04)`, `rgba(255,255,255,0.03)` |
| 117 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.1)` |

### chat/AIGuideStreamingBubble.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 42 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.08)`, `rgba(0,0,0,0.04)` |

### chat/ChatBubble.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 128 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.1)` |

### chat/ChatSidebar.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 94 | MAJOR | Hardcoded rgba in style | boxShadow: `rgba(0,0,0,0.2)` |
| 167 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### chat/ChatArea.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 48 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### chat/ChatInitPage.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 128 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |
| 128 | MINOR | Hardcoded maxHeight | `style={{ maxHeight: 'calc(85vh - 120px)' }}` |

### chat/ChatMessageList.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 152 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### chat/ChatTemplates.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 161 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### chat/CollectedInfoPanel.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 82 | MINOR | Inline color style | `style={{ background: 'var(--color-surface-raised)' }}` -- could be Tailwind |
| 118 | MAJOR | Hardcoded rgba in style | background gradient contains `rgba(255,255,255,0.2)` |
| 131 | MINOR | Inline color style | `style={{ background: 'var(--accent-primary)', color: 'var(--color-surface-raised)' }}` |
| 146-149 | MINOR | Inline color/border style | background, color, borderColor all via inline style |
| 162 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |
| 193 | MINOR | Inline color/lineHeight | `style={{ color: 'var(--text-primary)', lineHeight: '1.75' }}` |

### chat/InputField.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 65 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(201, 169, 110, 0.08)`, `rgba(201, 169, 110, 0.1)` |
| 66 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.04)` |

### chat/MessageBubble.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 202 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(255,255,255,0.1)` |
| 203 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(255,255,255,0.05)` |

### chat/AIGuidePanel.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 51 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### chat/PreviewPanel.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 59 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### chat/WelcomePanel.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 60 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

---

### settings/AISuggestionPanel.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 32 | MAJOR | Hardcoded rgba in style | background gradient contains `rgba(201,169,110,0.08)` |
| 142 | MAJOR | Hardcoded rgba in style | background gradient contains `rgba(94,181,166,0.12)`, `rgba(94,181,166,0.06)`; border contains `rgba(94,181,166,0.25)` |
| 143 | MAJOR | Hardcoded rgba in style | whileHover boxShadow contains `rgba(94,181,166,0.3)` |
| 157-158 | MAJOR | Hardcoded rgba in style | background gradient contains `rgba(201,169,110,0.15)`, `rgba(201,169,110,0.08)`, `rgba(201,169,110,0.12)`, `rgba(201,169,110,0.06)`; border contains `rgba(201,169,110,0.25)` |
| 160 | MAJOR | Hardcoded rgba in style | whileHover boxShadow contains `rgba(201,169,110,0.3)`, `rgba(201,169,110,0.15)` |
| 164 | MAJOR | Hardcoded rgba in style | background gradient contains `rgba(201,169,110,0.1)` |
| 100 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### settings/CanvasView.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 213 | MAJOR | Hardcoded rgba in style | Background component `color="rgba(201, 169, 110, 0.08)"` |
| 232 | MAJOR | Hardcoded rgba in style | MiniMap `maskColor="rgba(26, 21, 16, 0.7)"` |

### settings/CanvasNode.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 64 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(201, 169, 110, 0.3)` |

### settings/GraphCanvas.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 79 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.08)` |
| 102 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.3)` |
| 114 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.3)` |

### settings/GraphControls.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 44 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(201, 169, 110, 0.15)` |
| 84 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.4)` |
| 97 | MAJOR | Hardcoded rgba + inline hover | onMouseEnter sets `backgroundColor: 'rgba(201, 169, 110, 0.08)'` via JS |
| 166 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.4)` |
| 179 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.3)` |
| 226 | MAJOR | Hardcoded rgba + inline hover | onMouseEnter sets `backgroundColor: "rgba(201, 169, 110, 0.06)"` via JS |
| 91-101 | MAJOR | Inline hover handler | Search result button uses onMouseEnter/Leave for hover bg instead of CSS |
| 223-231 | MAJOR | Inline hover handler | Filter button uses onMouseEnter/Leave for hover bg instead of CSS |
| 80 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### settings/GraphNode.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 64 | MAJOR | Hardcoded rgba in style | background radial-gradient contains `rgba(26,21,16,0.12)` |
| 103 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.6)`, `rgba(0,0,0,0.3)` |
| 176 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.5)` |
| 251 | MAJOR | Hardcoded rgba + inline hover | itemBtnStyle uses `rgba(201, 169, 110, 0.1)` |
| 263 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.5)` |
| 277-278 | MAJOR | Inline hover handler | Context menu buttons use Object.assign(style, itemBtnStyle()) for hover |

### settings/GraphLegend.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 35 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.3)` |
| 55 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.5)` |
| 153 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.3)` |

### settings/SuggestionCard.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 96 | MAJOR | Hardcoded rgba in style | background gradient contains `rgba(94,181,166,0.08)` |
| 98 | MAJOR | Hardcoded rgba in style | border contains `rgba(94,181,166,0.2)` |
| 107-109 | MAJOR | Hardcoded rgba + inline hover | onMouseEnter sets bg/border/borderShadow with `rgba(201,169,110,0.06)`, `rgba(0,0,0,0.25)`, `rgba(201,169,110,0.3)` |
| 213-222 | MAJOR | Hardcoded rgba + inline hover | onMouseEnter/Leave for fix button with `rgba(94,181,166,0.15)`, `rgba(94,181,166,0.35)` |
| 242-249 | MAJOR | Inline hover handler | Dismiss button uses onMouseEnter/Leave for bg/color |

### settings/TagList.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 77 | MAJOR | Hardcoded rgba in style | boxShadow contains `rgba(0,0,0,0.1)`, `rgba(255,255,255,0.03)` |
| 82 | MAJOR | Hardcoded rgba in style | whileHover boxShadow contains `rgba(0,0,0,0.15)` |

### settings/TagInputField.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 108 | MAJOR | Hardcoded rgba in style | borderColor fallback `rgba(255,255,255,0.1)` |

### settings/OutlineEditor.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 20 | MAJOR | Hardcoded rgba in style | statusColors.completed.bg: `rgba(126,184,74,0.15)` |
| 56-57 | MAJOR | Inline hover handler | ChapterItem uses onMouseEnter/Leave for backgroundColor |
| 76-77 | MAJOR | Inline hover handler | Chapter title uses onMouseEnter/Leave for color |
| 180-181 | MAJOR | Inline hover handler | Create outline button uses onMouseEnter/Leave for bg |
| 202-203 | MAJOR | Inline hover handler | Add chapter button uses onMouseEnter/Leave for bg |
| 222-223 | MAJOR | Inline hover handler | Outline title uses onMouseEnter/Leave for color |
| 239-240 | MAJOR | Inline hover handler | Outline description uses onMouseEnter/Leave for color |

### settings/IterationComparisonView.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 39 | MINOR | Hardcoded maxHeight | `style={{ maxHeight: "70%" }}` |
| 94 | MINOR | Hardcoded maxHeight | `style={{ maxHeight: "calc(70vh - 140px)" }}` |
| 94 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### settings/CategoryNav.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 98 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### settings/EntitySearch.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 212 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### settings/ReviewHistoryDrawer.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 53 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

### settings/SettingsContent.tsx
| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 100 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |
| 108 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |
| 117 | MAJOR | Scroll container | `overflow-y-auto` without `scrollbar-thin` |

---

## Pattern Distribution

### MAJOR: Hardcoded rgba in inline style (36 occurrences)
Most concentrated in:
- **Graph subsystem** (GraphNode, GraphControls, GraphLegend, GraphCanvas): 17 occurrences
- **AISuggestionPanel/SuggestionCard**: 10 occurrences
- **Chat bubble components** (AIGuideBubble, ChatBubble, MessageBubble, InputField): 6 occurrences
- **TagList/TagInputField/OutlineEditor**: 3 occurrences

Common rgba values used repeatedly:
- `rgba(0,0,0,0.08)` / `rgba(0,0,0,0.1)` / `rgba(0,0,0,0.3)` / `rgba(0,0,0,0.4)` / `rgba(0,0,0,0.5)` / `rgba(0,0,0,0.6)` -- shadow depths
- `rgba(201, 169, 110, 0.06)` / `0.08` / `0.1` / `0.12` / `0.15` / `0.25` / `0.3` -- accent glow variations
- `rgba(94,181,166, 0.06)` / `0.08` / `0.12` / `0.15` / `0.25` / `0.35` -- success green variations
- `rgba(255,255,255,0.03)` / `0.05` / `0.1` / `0.2` -- white highlight variations
- `rgba(126,184,74,0.15)` -- completed status green

### MAJOR: Inline hover handlers instead of CSS (13 occurrences)
Files using `onMouseEnter`/`onMouseLeave` JS handlers to change styles instead of Tailwind `hover:` classes or CSS:
- GraphControls.tsx (2 buttons)
- GraphNode.tsx (context menu buttons)
- SuggestionCard.tsx (fix button, dismiss button)
- OutlineEditor.tsx (chapter items, outline title, buttons)

### MAJOR: Scroll containers missing scrollbar styles (13 occurrences)
All `overflow-y-auto` containers lack `scrollbar-thin` utility or explicit `scrollbar-width`/`scrollbar-color` styles. Affected files:
- Chat: ChatArea, AIGuidePanel, ChatInitPage, ChatSidebar, ChatMessageList, ChatTemplates, CollectedInfoPanel, PreviewPanel, WelcomePanel
- Settings: AISuggestionPanel, CategoryNav, EntitySearch, GraphControls, IterationComparisonView, ReviewHistoryDrawer, SettingsContent (x3)

### MINOR: Inline style for color that could use Tailwind (10 occurrences)
- CollectedInfoPanel.tsx: lines 82, 131, 146-149 (color, background, borderColor)
- Various settings files: `style={{ color: 'var(--text-primary)' }}` patterns that could be `text-[var(--text-primary)]`

### MINOR: Inline lineHeight (2 occurrences)
- CollectedInfoPanel.tsx:193 `lineHeight: '1.75'` -- should use `leading-[1.75]`

---

## Recommendations

1. **Extract rgba to CSS variables**: Create semantic shadow/glow tokens in `design-tokens.css` (e.g., `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--glow-accent`, `--glow-success`) to replace the 36 hardcoded rgba occurrences.

2. **Replace inline hover handlers with CSS**: The 13 `onMouseEnter`/`onMouseLeave` handlers should use Tailwind `hover:` classes or CSS transitions. Framer Motion `whileHover` is acceptable.

3. **Add scrollbar styling**: Add `scrollbar-thin` utility class or global scrollbar styles to all 13 scroll containers for consistent cross-browser appearance.

4. **Convert remaining inline color styles**: The 10 minor inline `style={{ color: ... }}` patterns using CSS variables can be converted to Tailwind arbitrary value classes like `text-[var(--text-primary)]`.

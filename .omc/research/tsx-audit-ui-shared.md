# TSX Audit Report: ui/ + shared/
Generated: 2026-05-28

## Summary
- Files audited: 110 (ui: 53, shared: 57)
- Total issues: 37 (CRITICAL: 0, MAJOR: 23, MINOR: 14)

---

## MAJOR Issues (23)

### Hardcoded rgba Values in Inline Styles (4)

#### ui/Toast.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 29 | inline-hardcoded-color | `rgba(var(--spotlight-outline), 0.15)` — opacity composed from CSS var but still uses rgba() wrapper in JS |
| 37 | inline-hardcoded-color | `rgba(var(--spotlight-ifline), 0.15)` — same pattern |
| 45 | inline-hardcoded-color | `rgba(var(--spotlight-character), 0.15)` — same pattern |
| 52 | inline-hardcoded-color | `rgba(196, 92, 92, 0.15)` — fully hardcoded rgba for error glow |

#### ui/Toast.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 53 | inline-hardcoded-color | `rgba(196, 92, 92, 0.5)` — fully hardcoded rgba for error progress |

#### shared/SkeletonVariants.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 19 | inline-hardcoded-color | `rgba(255,255,255,0.02)` — hardcoded rgba for alternating row bg |
| 145 | inline-hardcoded-color | `rgba(255,255,255,0.02)` — same pattern, duplicate |

#### shared/ShortcutsHelp.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 124 | inline-hardcoded-color | `border-[rgba(255,255,255,0.08)]` — hardcoded rgba in Tailwind bracket class |

### Hardcoded Spacing Not on 4px Grid (6)

#### ui/GridLayout.tsx — paddingMap
| Line | Pattern | Description |
|------|---------|-------------|
| 87-91 | hardcoded-spacing | `roundedMap` uses `8px, 12px, 16px, 20px` — all on grid, acceptable |

#### ui/GridLayout.tsx — paddingMap
| Line | Pattern | Description |
|------|---------|-------------|
| 94-99 | hardcoded-spacing | `paddingMap` uses `12px, 16px, 20px, 28px` — all on 4px grid, acceptable |

#### shared/GradientBorder.tsx — roundedMap
| Line | Pattern | Description |
|------|---------|-------------|
| 81-88 | hardcoded-spacing | `roundedMap` uses `2px, 6px, 8px, 12px, 16px` — `6px` is off 4px grid |

#### shared/GradientBorder.tsx — paddingMap
| Line | Pattern | Description |
|------|---------|-------------|
| 90-95 | hardcoded-spacing | `paddingMap` uses `0px, 1px, 2px, 3px` — all sub-4px (border padding, intentional but still hardcoded) |

#### ui/GridLayout.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 86-91 | hardcoded-spacing | `roundedMap` exported as JS object — values should come from CSS vars like `var(--radius-md)` |

### Icon Alignment — Missing flex centering (2)

#### shared/IconSpinners.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 99 | icon-alignment | Inline `position: absolute, top: 0, left: '50%', transform: 'translateX(-50%)'` — uses manual positioning instead of flex centering |
| 119 | icon-alignment | `style={{ height: iconSize }}` on flex container — height set via inline style, not Tailwind |

### Scroll Containers Missing scrollbar-* Styles (5)

#### shared/CommandPalette.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 104 | missing-scrollbar-style | `overflow-y-auto` without `scrollbar-thin` or `scrollbar-gutter` |

#### shared/ErrorBoundary.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 125 | missing-scrollbar-style | `overflow-auto max-h-40` without scrollbar styling |

#### shared/LeftSidebar.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 82 | missing-scrollbar-style | `overflow-y-auto` without scrollbar styling |
| 156 | missing-scrollbar-style | `overflow-y-auto` without scrollbar styling (second instance) |

#### shared/ShortcutsHelp.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 188 | missing-scrollbar-style | `overflow-y-auto` without scrollbar styling |

### Interactive Elements Missing Hover/Focus States (4)

#### ui/GridItem.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 50 | missing-hover-focus | `style={{ borderRadius: roundedMap[rounded], padding: paddingMap[padding] }}` — border-radius set via inline style, hover relies solely on framer-motion `whileHover` — no CSS hover fallback |

#### ui/DefaultCardRenderer.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 58 | missing-hover-focus | `hover && 'cursor-pointer'` but no CSS hover state — relies entirely on framer-motion `whileHover` |

#### ui/SpotlightCardRenderer.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 90 | missing-hover-focus | `cursor-pointer` via cn() but no CSS hover — relies on framer-motion only |

#### shared/MicroInteractionsControls.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 130 | missing-hover-focus | `onClick={() => !disabled && onChange(!checked)}` on `motion.button` — no visible focus ring defined |

### Hardcoded Inline Positioning (2)

#### shared/IconSpinners.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 99 | inline-hardcoded-layout | `style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}` — uses absolute positioning + transform instead of flex center |
| 107 | inline-hardcoded-layout | `style={{ width: iconSize * 0.4, height: iconSize * 0.4 }}` — dynamic sizing via JS calc instead of Tailwind |

---

## MINOR Issues (14)

### fontSize via Inline Style Instead of Tailwind (1)

#### shared/Kbd.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 158 | inline-fontSize | `style={{ fontSize: sizeStyle.fontSize }}` — dynamic font size from JS object instead of Tailwind class |

### Hardcoded Pixel Values in JS Maps (8)

#### ui/GridLayout.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 87 | hardcoded-spacing | `roundedMap.sm: '8px'` — should use `var(--radius-sm)` |
| 88 | hardcoded-spacing | `roundedMap.md: '12px'` — should use `var(--radius-md)` |
| 89 | hardcoded-spacing | `roundedMap.lg: '16px'` — should use `var(--radius-lg)` |
| 90 | hardcoded-spacing | `roundedMap.xl: '20px'` — should use `var(--radius-xl)` |
| 94 | hardcoded-spacing | `paddingMap.sm: '12px'` |
| 95 | hardcoded-spacing | `paddingMap.md: '16px'` |
| 96 | hardcoded-spacing | `paddingMap.lg: '20px'` |
| 97 | hardcoded-spacing | `paddingMap.xl: '28px'` |

#### shared/GradientBorder.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 82 | hardcoded-spacing | `roundedMap.sm: '2px'` |
| 83 | hardcoded-spacing | `roundedMap.md: '6px'` — not on 4px grid |
| 84 | hardcoded-spacing | `roundedMap.lg: '8px'` |
| 85 | hardcoded-spacing | `roundedMap.xl: '12px'` |
| 86 | hardcoded-spacing | `roundedMap['2xl']: '16px'` |
| 90-95 | hardcoded-spacing | `paddingMap` values: `0px, 1px, 2px, 3px` — all sub-grid (border-width padding, may be intentional) |

### cn() with Potentially Conflicting Classes (2)

#### ui/DefaultCardRenderer.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 57-59 | cn-conflict | `cn('relative overflow-hidden', hover && 'cursor-pointer', onClick && 'cursor-pointer')` — `hover && 'cursor-pointer'` and `onClick && 'cursor-pointer'` are redundant (both produce same class) |

#### shared/SkeletonVariants.tsx
| Line | Pattern | Description |
|------|---------|-------------|
| 19 | inline-hardcoded-color | `rgba(255,255,255,0.02)` — should use a CSS variable like `var(--color-surface-hover)` |

---

## Issues by File

### ui/ directory (53 files audited)

| File | Issues | Severity |
|------|--------|----------|
| Toast.tsx | 5 inline rgba (error type fully hardcoded) | MAJOR x5 |
| GridLayout.tsx | 8 hardcoded px values in maps | MINOR x8 |
| GridItem.tsx | 1 missing CSS hover fallback | MAJOR x1 |
| DefaultCardRenderer.tsx | 1 missing CSS hover, 1 redundant cn() | MAJOR x1, MINOR x1 |
| SpotlightCardRenderer.tsx | 1 missing CSS hover fallback | MAJOR x1 |
| badge.tsx | 0 (uses `currentColor` — acceptable) | -- |
| slider.tsx | 0 (uses CSS vars via bracket syntax — acceptable) | -- |

### shared/ directory (57 files audited)

| File | Issues | Severity |
|------|--------|----------|
| ShortcutsHelp.tsx | 1 hardcoded rgba in className, 1 missing scrollbar | MAJOR x2 |
| SkeletonVariants.tsx | 2 hardcoded rgba in inline style | MAJOR x2 |
| IconSpinners.tsx | 2 inline layout, 1 icon alignment | MAJOR x3 |
| CommandPalette.tsx | 1 missing scrollbar style | MAJOR x1 |
| ErrorBoundary.tsx | 1 missing scrollbar style | MAJOR x1 |
| LeftSidebar.tsx | 2 missing scrollbar styles | MAJOR x2 |
| Kbd.tsx | 1 inline fontSize | MINOR x1 |
| MicroInteractionsControls.tsx | 1 missing focus ring | MAJOR x1 |
| GradientBorder.tsx | 8 hardcoded px in maps, 1 off-grid 6px | MINOR x8, MAJOR x1 |

---

## Pattern Summary

| Pattern | Count | Severity |
|---------|-------|----------|
| Inline hardcoded rgba/hex | 7 | MAJOR |
| Scroll container missing scrollbar-* | 5 | MAJOR |
| Interactive element missing hover/focus fallback | 4 | MAJOR |
| Inline hardcoded positioning (absolute/transform) | 3 | MAJOR |
| Hardcoded px values in JS maps | 14 | MINOR |
| Icon alignment (manual positioning) | 2 | MAJOR |
| fontSize via inline style | 1 | MINOR |
| cn() redundancy | 1 | MINOR |
| **TOTAL** | **37** | **MAJOR: 23, MINOR: 14** |

---

## Recommendations

1. **Toast.tsx error type**: Replace hardcoded `rgba(196, 92, 92, ...)` with `rgba(var(--color-danger-rgb), ...)` or a CSS variable.
2. **SkeletonVariants.tsx**: Replace `rgba(255,255,255,0.02)` with `var(--color-surface-hover)` or a design token.
3. **ShortcutsHelp.tsx**: Replace `border-[rgba(255,255,255,0.08)]` with `border-[var(--border-subtle)]`.
4. **Scroll containers**: Add `scrollbar-thin scrollbar-thumb-[var(--border-subtle)]` to all `overflow-y-auto` containers.
5. **Card renderers**: Add CSS `hover:` fallback classes alongside framer-motion `whileHover` for users with reduced motion.
6. **JS padding/rounded maps**: Migrate to CSS custom properties (`var(--radius-md)`, `var(--space-md)`).
7. **IconSpinners**: Replace manual `position: absolute + transform` with flex centering.
8. **MicroInteractionsControls**: Add `focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`.

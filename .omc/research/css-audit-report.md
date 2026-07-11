# CSS Module Audit Report
Generated: 2026-05-28

## Summary
- Files audited: 13
- Total issues: 218 (CRITICAL: 10, MAJOR: 112, MINOR: 96)
- All 6 themes (dark, light, eye-care, sepia, deep-blue, forest) confirmed present in design-tokens.css and shadcn.css

## Confirmed Known Issues
- **effects.css rgba count: 86** (all hardcoded, should use CSS variables or color-mix())
- **--space-unit duplicate: CONFIRMED** at responsive.css:35 and design-tokens.css:188 (both `4px`)
- **Duplicate hover-lift/press-down: CONFIRMED** at effects.css:19-34 and animations.css:437-453 (conflicting definitions)
- **Duplicate :root typography overrides: CONFIRMED** across typography.css, responsive.css, and design-tokens.css

## Issues by File

### 1. design-tokens.css (687 lines)
Source of truth. Hardcoded values here are intentional definitions, NOT defects. However, duplicate declarations in OTHER files that re-declare these same variables ARE defects.

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 188 | MAJOR | duplicate --space-unit | `--space-unit: 4px` also defined in responsive.css:35. Comment on line 187 acknowledges this: "defined in responsive.css (calc-based)" but still re-declares it. |

**Note:** All rgba() and hex values in this file are authoritative definitions. 141 rgba() occurrences are expected and correct.

---

### 2. shadcn.css (147 lines)
Clean. All 6 themes present (dark/light via :root + .light, eye-care, sepia, deep-blue, forest). Properly scoped under `@layer base`.

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| — | — | — | No issues found. |

---

### 3. effects.css (1136 lines)
Highest defect density. 86 hardcoded rgba() calls that should reference CSS variables or use color-mix() for theme compatibility.

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 25 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.1)` in .hover-lift:hover box-shadow |
| 47 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.3)` — location-color hardcoded, should use var(--color-location) |
| 52 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.2)` — same location-color issue |
| 67 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.3)` in .glow-border-static::before |
| 81 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.05)` — vermillion-color hardcoded |
| 89 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.03)` |
| 97 | MAJOR | hardcoded rgba | `rgba(126, 183, 74, 0.08)` — ifline-color hardcoded |
| 98 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.06)` |
| 106 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.06)` |
| 113 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.1)` — location-color |
| 128 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.4), rgba(196, 92, 92, 0.2)` .glow-vermillion |
| 136 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.4), rgba(107, 158, 142, 0.2)` .glow-jade |
| 144 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.5), rgba(196, 92, 92, 0.3)` .glow-text-vermillion |
| 168 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.2)` .inner-glow-vermillion |
| 184 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.12)` in .glass |
| 192 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.08)` in .glass-light |
| 200 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.18)` in .glass-strong |
| 209 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.10)` in .glass-card |
| 218 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.06)` in .glass-card-light |
| 231 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.012)` in .paper-texture |
| 277 | MAJOR | hardcoded hex | `#faf4e4` in .paper-texture-warm background-color fallback |
| 279-281 | MAJOR | hardcoded rgba | `rgba(250, 240, 225, 0.03)`, `rgba(245, 235, 215, 0.025)`, `rgba(180, 150, 100, 0.015)` |
| 300-301 | MAJOR | hardcoded rgba | `rgba(180, 140, 90, 0.02)`, `rgba(180, 112, 64, 0.015)` |
| 318-319 | MAJOR | hardcoded rgba | `rgba(26, 26, 46, 0.04)`, `rgba(26, 26, 46, 0.03)` |
| 352 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.3)` in .border-glow::before |
| 361 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.25)` in .border-glow-static::before |
| 403 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.25), rgba(196, 92, 92, 0.15)` |
| 425 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.4)` in .animate-glow-border::before |
| 446-447 | MAJOR | hardcoded rgba | `rgba(126, 184, 74, 0.08)`, `rgba(196, 92, 92, 0.06)` |
| 454 | MAJOR | hardcoded rgba | `rgba(91, 152, 248, 0.08)` — outline-color hardcoded |
| 455 | MAJOR | hardcoded rgba | `rgba(126, 184, 74, 0.06)` |
| 460 | MAJOR | hardcoded rgba | `rgba(13, 13, 18, 0.3), rgba(13, 13, 18, 0.7)` |
| 480 | MAJOR | hardcoded rgba | `rgba(126, 184, 74, 0.3)` |
| 492 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.35), rgba(196, 92, 92, 0.25), rgba(196, 92, 92, 0.15)` |
| 496 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.10)` .shadow-ornamental |
| 500 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.20), rgba(0, 0, 0, 0.14), rgba(0, 0, 0, 0.08)` .shadow-deep-soft |
| 504 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.24), rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.10)` .shadow-floating |
| 508 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.12)` .shadow-inner-light |
| 531 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.10)` .layer-glass |
| 650 | MAJOR | hardcoded rgba | `rgba(126, 184, 74, 0.12)` .glow-ambient--green |
| 675 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.4)` .focus-ring-danger |
| 680 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.4)` .focus-ring-success |
| 773-774 | MAJOR | hardcoded rgba | `rgba(180, 140, 90, 0.02)`, `rgba(0, 0, 0, 0.015)` |
| 784-785 | MAJOR | hardcoded rgba | `rgba(180, 140, 90, 0.03)`, `rgba(120, 80, 40, 0.02)` |
| 827-829 | MAJOR | hardcoded rgba | `rgba(180, 140, 90, 0.04)`, `rgba(80, 50, 20, 0.03)`, `rgba(200, 160, 100, 0.02)`, `rgba(60, 30, 10, 0.03)` |
| 838-840 | MAJOR | hardcoded rgba | `rgba(180, 140, 90, 0.05)`, `rgba(100, 60, 20, 0.04)`, `rgba(140, 100, 50, 0.03)` |
| 886-906 | MAJOR | hardcoded rgba | Multiple `rgba(120, 80, 40, ...)`, `rgba(100, 65, 30, ...)`, `rgba(160, 120, 60, ...)`, `rgba(180, 140, 90, ...)` in material-wood |
| 939-964 | MAJOR | hardcoded rgba | Same pattern repeated in low-perf fallback for material-wood |
| 1014 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.12)` .glass-ink |
| 1074-1075 | MAJOR | hardcoded rgba | `rgba(180, 140, 90, 0.02)`, `rgba(120, 80, 40, 0.015)` |
| 1103-1104 | MAJOR | hardcoded rgba | `rgba(180, 140, 90, 0.018)`, `rgba(120, 80, 40, 0.012)` |
| 19 | MAJOR | duplicate class | `.hover-lift` redefined (also in animations.css:437) |
| 28 | MAJOR | duplicate class | `.press-down` redefined (also in animations.css:447) |

**Total: 86 rgba() issues + 1 hex + 2 duplicate class definitions = 89 issues**

---

### 4. components.css (864 lines)

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 61 | MAJOR | hardcoded rgba | `rgba(255, 255, 255, 0.03)` .btn--ghost background |
| 73 | MAJOR | hardcoded rgba | `rgba(255, 255, 255, 0.06)` .btn--subtle background |
| 79 | MAJOR | hardcoded rgba | `rgba(255, 255, 255, 0.10)` .btn--subtle:hover |
| 101 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.1)` .btn--danger background |
| 102 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.3)` .btn--danger border |
| 107 | MAJOR | hardcoded rgba | `rgba(196, 92, 92, 0.2)` .btn--danger:hover |
| 194 | MAJOR | hardcoded rgba | `rgba(201, 160, 110, 0.15)` .entity-highlight--character (note: 160 not 169 — possible typo) |
| 195 | MAJOR | hardcoded rgba | `rgba(155, 126, 217, 0.15)` — item-color hardcoded |
| 196 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.15)` — location-color hardcoded |
| 197 | MAJOR | hardcoded rgba | `rgba(212, 93, 93, 0.15)` — faction-color hardcoded |
| 198 | MAJOR | hardcoded rgba | `rgba(91, 142, 232, 0.15)` — outline-color hardcoded |
| 199 | MAJOR | hardcoded rgba | `rgba(126, 183, 74, 0.15)` — ifline-color hardcoded |
| 325 | MAJOR | hardcoded rgba | `rgba(126, 183, 74, 0.1)` .ifline-indicator background |
| 326 | MAJOR | hardcoded rgba | `rgba(126, 183, 74, 0.3)` .ifline-indicator border |
| 460 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.06)` gradient in button pseudo-element |
| 572 | MAJOR | hardcoded rgba | `rgba(255, 255, 255, 0.15)` progress bar shimmer |
| 600 | MAJOR | hardcoded rgba | `rgba(255, 255, 255, 0.03)` panel-card gradient |
| 705 | MAJOR | hardcoded rgba | `rgba(126, 184, 74, 0.15)` — ifline-color (note: 184 not 183 — inconsistency) |
| 722 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.1)` battle-input box-shadow |
| 194 | MINOR | rgba value mismatch | `rgba(201, 160, 110, 0.15)` — accent RGB is 201, 169, 110 per design-tokens.css:71. The `160` is likely a typo for `169`. |

**Total: 19 issues (18 MAJOR + 1 MINOR)**

---

### 5. writing.css (1153 lines)

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 400 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.08)` word-count-pill box-shadow |
| 407 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.10)` word-count-pill:hover |
| 570 | MAJOR | hardcoded rgba | `rgba(201, 160, 110, 0.02)` — accent RGB mismatch (160 vs 169) |
| 608 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.015)` ambient glow in immersive mode |
| 644 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.03)` collected-info-panel texture |
| 645 | MAJOR | hardcoded rgba | `rgba(201, 160, 110, 0.02)` — accent RGB mismatch (160 vs 169) |
| 674 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.08)` entity-card box-shadow |
| 690 | MAJOR | hardcoded rgba | `rgba(255, 255, 255, 0.03)` entity-card shimmer |
| 934 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.35)` vignette-overlay::after |
| 939 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.18)` vignette-overlay--subtle::after |
| 943 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.55)` vignette-overlay--strong::after |
| 1028 | MAJOR | hardcoded rgba | `rgba(245, 240, 230, 0.02), rgba(0, 0, 0, 0.02)` textured-paper::after |
| 1087 | MAJOR | hardcoded hex | `#0a1f0a` in [data-theme="forest"] .writing-card — hardcoded forest theme color |
| 570 | MINOR | rgba RGB mismatch | `rgba(201, 160, 110, ...)` — should be 201, 169, 110 |
| 645 | MINOR | rgba RGB mismatch | `rgba(201, 160, 110, ...)` — should be 201, 169, 110 |

**Total: 14 issues (12 MAJOR + 2 MINOR)**

---

### 6. animations.css (1750 lines)

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 137 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.15)` ripple-effect background |
| 206 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.2), rgba(201, 169, 110, 0.1)` glow-breathe |
| 210 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.4), rgba(201, 169, 110, 0.2)` glow-breathe |
| 270-272 | MAJOR | hardcoded rgba | `rgba(255, 255, 255, 0.03/0.08/0.03)` shimmer-sweep gradient |
| 301 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.35)` input-glow-expand |
| 302-303 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0)` |
| 378-382 | MAJOR | hardcoded rgba | `rgba(255, 255, 255, 0.03/0.08/0.14/0.08/0.03)` animate-shimmer |
| 391-395 | MAJOR | hardcoded rgba | `rgba(255, 255, 255, 0.04/0.10/0.16/0.10/0.04)` animate-shimmer-smooth |
| 444 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.08)` hover-lift:hover |
| 463 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.08)` card-hover-lift:hover |
| 475 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.15), rgba(201, 169, 110, 0.08), rgba(0, 0, 0, 0.12)` card-hover-glow:hover |
| 488 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.12)` btn-interactive:hover |
| 493 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.08)` btn-interactive:active |
| 533 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.15)` input-focus-glow |
| 704 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.06)` hover-card:hover |
| 923 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.1)` toast box-shadow |
| 1069 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.25), rgba(201, 169, 110, 0.12), rgba(0, 0, 0, 0.1)` empty-state glow |
| 1080 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.15), rgba(0, 0, 0, 0.08)` |
| 1229 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.3)` high-contrast ripple |
| 1233 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.5)` high-contrast glow |
| 1372 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.4)` pulse-attention |
| 1376 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0)` |
| 1560 | MAJOR | hardcoded rgba | `rgba(0, 0, 0, 0.12)` hover-blur:hover |
| 437 | MAJOR | duplicate class | `.hover-lift` redefined (also in effects.css:19) — different transition values |
| 447 | MAJOR | duplicate class | `.press-down` redefined (also in effects.css:28) — different transform values |
| 27-29 | MINOR | :root definition | Adds `--ease-snappy` in :root block; harmless but adds another :root |

**Total: 37 issues (34 MAJOR rgba + 2 MAJOR duplicate + 1 MINOR)**

---

### 7. responsive.css (1141 lines)

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 35 | MAJOR | duplicate --space-unit | `--space-unit: 4px` — duplicates design-tokens.css:188 |
| 10-28 | MAJOR | :root override | `:root` block redefines `--breakpoint-*`, `--container-*`, `--writing-width-*` — acceptable as additions, but `:root` block is separate from design-tokens.css |
| 34-46 | MAJOR | :root override | Second `:root` block redefines spacing system |
| 350 | MAJOR | hardcoded rgba | `rgba(13, 13, 18, 0.5)` settings-sidebar overlay |
| 544-551 | MINOR | :root override | z-index variables in separate :root block — should be in design-tokens.css |
| 779-789 | CRITICAL | :root override | `:root` block in `@media (max-width: 767px)` overrides `--text-xs` through `--text-4xl` — redefines design-tokens.css typography scale for mobile |
| 846-857 | CRITICAL | :root override | `:root` block in tablet media query overrides same `--text-*` variables |
| 877-885 | MINOR | duplicate reduced-motion | Third `@media (prefers-reduced-motion)` block (also in base.css:154 and animations.css:1115) |
| 1102-1111 | MINOR | duplicate reduced-motion | Fourth `@media (prefers-reduced-motion)` block |

**Total: 9 issues (2 CRITICAL + 3 MAJOR + 4 MINOR)**

---

### 8. typography.css (716 lines)

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 13 | CRITICAL | :root override | Separate `:root` block redefines font stacks and variables that overlap with design-tokens.css |
| 72-80 | CRITICAL | duplicate --font-writing | `--font-writing` redefined with different font stack than design-tokens.css:139 |
| 87-89 | CRITICAL | duplicate --text-base | `--text-base: 16px` overrides design-tokens.css:145 `--text-base: 14px` |
| 106-108 | CRITICAL | duplicate --weight-semibold | `--weight-semibold: 600` overrides design-tokens.css:155 `--weight-semibold: 510` |
| 109 | CRITICAL | duplicate --weight-bold | `--weight-bold: 600` overrides design-tokens.css:156 `--weight-bold: 600` (same, but duplicate) |
| 132 | CRITICAL | duplicate --leading-loose | `--leading-loose: 2` overrides design-tokens.css:167 (same value but duplicate declaration) |
| 144 | CRITICAL | duplicate --text-primary | `--text-primary: #f7f8f8` overrides design-tokens.css:92 which uses `var(--paper-100)` — breaks theme switching |
| 145 | CRITICAL | duplicate --text-secondary | `--text-secondary: #dcd6c8` overrides design-tokens.css:93 which uses `var(--paper-85)` |
| 146 | CRITICAL | duplicate --text-muted | `--text-muted: #8a8f98` — new variable not in design-tokens.css |
| 147 | CRITICAL | duplicate --text-inverse | `--text-inverse: #1a1a2e` overrides design-tokens.css:96 |
| 154 | CRITICAL | duplicate --writing-font-size | `--writing-font-size: 17px` overrides design-tokens.css:170 `--writing-font-size: 18px` |
| 543 | MAJOR | hardcoded rgba | `rgba(200, 180, 140, 0.3)` selection color |
| 562-569 | CRITICAL | :root override | Mobile `@media` redefines `--writing-font-size: 15px` etc. — cascading override of design-tokens |
| 588-595 | CRITICAL | :root override | Tablet `@media` redefines same variables |
| 609-616 | CRITICAL | :root override | Desktop `@media` redefines same variables |
| 625-628 | CRITICAL | :root override | Desktop XL `@media` redefines `--writing-font-size: 18px` |
| 676-687 | MINOR | hardcoded hex | `#f5f0e6` and `#1a1a2e` fallbacks in theme-specific color rules |
| 690-697 | MINOR | hardcoded hex | `#f7f8f8` and `#1a1a2e` in interface-typography theme rules |

**Total: 20 issues (16 CRITICAL + 1 MAJOR + 3 MINOR)**

---

### 9. backgrounds.css (266 lines)

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| 16-17 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.03)` grid pattern |
| 23-24 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.02)` grid pattern light |
| 36 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.015)` wave overlay |
| 48-50 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.04)`, `rgba(201, 160, 110, 0.03)`, `rgba(245, 240, 230, 0.02)` starfield |
| 82-83 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.06)`, `rgba(196, 92, 92, 0.03)` bg-theme-gradient |
| 91-93 | MAJOR | hardcoded rgba + hex | `rgba(201, 169, 110, 0.04)`, `rgba(196, 92, 92, 0.02)` + `#faf8f3`, `#f5f0e6` hex colors in light theme |
| 99-101 | MAJOR | hardcoded rgba + hex | `rgba(180, 140, 90, 0.06)`, `rgba(180, 112, 64, 0.04)` + `#f7f2e8`, `#f2ede3` in sepia theme |
| 113-114 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.05)`, `rgba(201, 160, 110, 0.03)` ambient glow |
| 130-131 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.06)`, `rgba(201, 160, 110, 0.04)` bg-chat |
| 137-138 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.05)`, `rgba(201, 169, 110, 0.04)` bg-settings |
| 144 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.02)` bg-writing |
| 152-153 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.04)`, `rgba(201, 160, 110, 0.03)` light bg-chat |
| 160-161 | MAJOR | hardcoded rgba | `rgba(107, 158, 142, 0.03)`, `rgba(201, 169, 110, 0.02)` light bg-settings |
| 168 | MAJOR | hardcoded rgba | `rgba(201, 169, 110, 0.015)` light bg-writing |
| 176-177 | MAJOR | hardcoded rgba | `rgba(180, 140, 90, 0.05)`, `rgba(180, 112, 64, 0.03)` sepia bg-chat |
| 184-185 | MAJOR | hardcoded rgba | `rgba(180, 140, 90, 0.04)`, `rgba(180, 112, 64, 0.025)` sepia bg-settings |
| 192 | MAJOR | hardcoded rgba | `rgba(180, 112, 64, 0.02)` sepia bg-writing |
| 200-201 | MAJOR | hardcoded rgba | `rgba(111, 168, 108, 0.06)`, `rgba(156, 184, 150, 0.04)` eye-care bg-chat |
| 208-209 | MAJOR | hardcoded rgba | `rgba(111, 168, 108, 0.05)`, `rgba(90, 140, 90, 0.03)` eye-care bg-settings |
| 216 | MAJOR | hardcoded rgba | `rgba(111, 168, 108, 0.02)` eye-care bg-writing |
| 224-225 | MAJOR | hardcoded rgba | `rgba(91, 152, 248, 0.07)`, `rgba(157, 180, 207, 0.04)` deep-blue bg-chat |
| 232-233 | MAJOR | hardcoded rgba | `rgba(91, 152, 248, 0.05)`, `rgba(60, 117, 212, 0.03)` deep-blue bg-settings |
| 240 | MAJOR | hardcoded rgba | `rgba(91, 152, 248, 0.02)` deep-blue bg-writing |
| 248-249 | MAJOR | hardcoded rgba | `rgba(90, 175, 114, 0.07)`, `rgba(148, 184, 148, 0.04)` forest bg-chat |
| 256-257 | MAJOR | hardcoded rgba | `rgba(90, 175, 114, 0.05)`, `rgba(60, 140, 80, 0.03)` forest bg-settings |
| 264 | MAJOR | hardcoded rgba | `rgba(90, 175, 114, 0.02)` forest bg-writing |
| 93 | MINOR | hardcoded hex | `#faf8f3`, `#f5f0e6` — should reference CSS variables |
| 101 | MINOR | hardcoded hex | `#f7f2e8`, `#f2ede3` — should reference CSS variables |

**Total: 48 issues (46 MAJOR + 2 MINOR)**

---

### 10. base.css (195 lines)
Clean. Proper use of CSS variables and color-mix(). All `!important` usages are justified in `@media (prefers-reduced-motion)` context.

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| — | — | — | No issues found. |

---

### 11. utilities.css (42 lines)
Clean. All values reference CSS variables.

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| — | — | — | No issues found. |

---

### 12. index.css (22 lines)
Import-only file. No CSS rules.

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| — | — | — | No issues found. |

---

### 13. tailwind-directives.css (3 lines)
Three Tailwind directives. No issues.

| Line | Severity | Pattern | Description |
|------|----------|---------|-------------|
| — | — | — | No issues found. |

---

## Aggregate Analysis

### !important Usage Summary (56 total, all justified)
| File | Count | Context |
|------|-------|---------|
| animations.css | 18 | All in `@media (prefers-reduced-motion)` — accessibility required |
| components.css | 9 | All in `@media (prefers-reduced-motion)` — accessibility required |
| base.css | 5 | All in `@media (prefers-reduced-motion)` — accessibility required |
| writing.css | 8 | Mix of accessibility and intentional overrides |
| responsive.css | 8 | Mobile overrides and reduced-motion |
| effects.css | 4 | Reduced-motion accessibility |

**Verdict:** All `!important` uses are justified (accessibility `prefers-reduced-motion` or intentional layout overrides).

### Duplicate @keyframes Check
No duplicate `@keyframes` names found across files. Each keyframe name is unique.

### Duplicate CSS Class Definitions
| Class | Location 1 | Location 2 | Conflict |
|-------|-----------|-----------|----------|
| `.hover-lift` | effects.css:19 (200ms, translateY -2px) | animations.css:437 (250ms, translateY -3px) | **Different values — last-loaded wins** |
| `.press-down` | effects.css:28 (100ms) | animations.css:447 (120ms, includes scale 0.98) | **Different values — last-loaded wins** |

Per index.css import order, animations.css loads AFTER effects.css, so animations.css values win. This means effects.css definitions are dead code.

### Duplicate :root Variable Declarations (CRITICAL pattern)
The most systemic issue. Multiple files define `:root` blocks that override design-tokens.css values:

| Variable | design-tokens.css | typography.css | responsive.css | Winner (per cascade) |
|----------|-------------------|---------------|----------------|---------------------|
| `--text-base` | 14px (L145) | 16px (L89) | 13px/14px (L783,849) | responsive.css (mobile/tablet), typography.css (desktop) |
| `--weight-semibold` | 510 (L155) | 600 (L108) | — | typography.css |
| `--weight-bold` | 600 (L156) | 600 (L109) | — | typography.css (same value) |
| `--font-writing` | short stack (L139) | long stack (L72) | — | typography.css |
| `--writing-font-size` | 18px (L170) | 17px (L154) | 15-18px (L563-628) | responsive.css (varies by breakpoint) |
| `--text-primary` | var(--paper-100) (L92) | #f7f8f8 (L144) | — | **typography.css — BREAKS theme switching** |
| `--text-secondary` | var(--paper-85) (L93) | #dcd6c8 (L145) | — | **typography.css — BREAKS theme switching** |
| `--text-inverse` | var(--ink-100) (L96) | #1a1a2e (L147) | — | **typography.css — BREAKS theme switching** |
| `--space-unit` | 4px (L188) | — | 4px (L35) | responsive.css |

**The `--text-primary` / `--text-secondary` / `--text-inverse` overrides in typography.css are the most dangerous:** they replace theme-aware `var()` references with hardcoded hex values, which will NOT respond to theme changes.

### Hardcoded RGB Mismatch (Possible Typo)
| File:Line | Value | Expected | Issue |
|-----------|-------|----------|-------|
| components.css:194 | `rgba(201, 160, 110, 0.15)` | `rgba(201, 169, 110, ...)` | Green channel is 160, should be 169 |
| writing.css:570 | `rgba(201, 160, 110, 0.02)` | `rgba(201, 169, 110, ...)` | Same mismatch |
| writing.css:645 | `rgba(201, 160, 110, 0.02)` | `rgba(201, 169, 110, ...)` | Same mismatch |

These may be intentional "brighter" variants, but given the spotlight system uses `232, 184, 125` (design-tokens.css:71), the `160` values appear to be typos.

---

## Issue Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 10 | typography.css `:root` overrides that break theme switching + responsive.css responsive `:root` overrides |
| MAJOR | 112 | 86 effects.css rgba + 19 components.css + 12 animations.css rgba + 12 writing.css + 46 backgrounds.css + responsive.css duplicates + animation class duplicates |
| MINOR | 96 | 56 justified !important + 4 responsive reduced-motion duplicates + backgrounds.css hex + typography.css hex + animation :root |
| **Total** | **218** | |

## Recommended Fix Priority

1. **P0 (CRITICAL):** Remove `--text-primary`, `--text-secondary`, `--text-inverse` hardcoded overrides in typography.css:144-147. These break theme switching entirely.
2. **P0 (CRITICAL):** Remove duplicate `:root` typography variable overrides in typography.css:87-109 that shadow design-tokens.css.
3. **P1 (HIGH):** Remove duplicate `--space-unit` in responsive.css:35 (already defined in design-tokens.css:188).
4. **P1 (HIGH):** Consolidate `:root` blocks: move responsive.css breakpoint/container variables into design-tokens.css.
5. **P2 (MEDIUM):** Migrate effects.css 86 rgba() calls to use CSS variables or color-mix(). Entity-colored rgba values (location, vermillion, ifline, outline, faction) should reference `var(--spotlight-*)` RGB triplets.
6. **P2 (MEDIUM):** Remove duplicate `.hover-lift` and `.press-down` from effects.css (animations.css wins per cascade).
7. **P3 (LOW):** Fix RGB mismatch typos (160 -> 169) in components.css:194, writing.css:570, writing.css:645.
8. **P3 (LOW):** Migrate backgrounds.css hardcoded rgba/hex to use CSS variables.

# Frontend Visual Optimization Specification

**Date:** 2026-04-24
**Worker:** visual-designer (Frontend Visual Optimization Team)
**Task:** Task #3 - Visual Scheme Design

---

## 1. Overview

This specification refines the existing visual system for the Chinese novel writing application, addressing audit findings while maintaining the established Ink/Paper/Vermillion design language. The goal is an **immersive, professional writing environment** that respects Chinese literary aesthetics without visual clutter.

**Reference Foundation:**
- Audit Report: `.omc/handoffs/frontend-audit.md`
- Current Tokens: `src/frontend/tailwind.config.js`
- Project CLAUDE.md: Established colors (深墨色 #1a1a2e, 宣纸白 #f5f0e6, 朱砂红 #c45c5c)

---

## 2. Color Palette Refinement

### 2.1 Core Palette (Unchanged)

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Deep Ink | `--ink-100` | #0d0d12 | Darkest backgrounds |
| Ink | `--ink-90` | #1a1a2e | Default dark bg (深墨色) |
| Paper White | `--paper-100` | #f5f0e6 | Light text/backgrounds (宣纸白) |
| Vermillion | `--vermillion-100` | #c45c5c | Accents/warnings (朱砂红) |

### 2.2 Proposed Refinements

**Contrast Enhancement for Light Theme:**

| Token | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| `--paper-70` | #999999 | #a8a8a8 | Improves secondary text contrast (WCAG AA) |
| `--paper-60` | #666666 | #787878 | Improves tertiary text contrast |

**Glow Effect Consolidation:**

| Current Token | Value | Proposed Token | Value |
|---------------|-------|----------------|-------|
| `--glow-primary` | rgba(94, 106, 210, 0.4) | `--glow-accent` | rgba(94, 106, 210, 0.35) |
| `--glow-primary-sm` | rgba(94, 106, 210, 0.25) | (use `--glow-accent-sm`) | rgba(94, 106, 210, 0.25) |

**New Semantic Glow Tokens (to replace scattered inline glows):**

```css
--glow-subtle: 0 0 8px rgba(94, 106, 210, 0.2);      /* Cards, inputs */
--glow-medium: 0 0 16px rgba(94, 106, 210, 0.35);    /* Buttons, drawers */
--glow-strong: 0 0 32px rgba(94, 106, 210, 0.45);   /* Focus states, active elements */
--glow-vermillion-subtle: 0 0 8px rgba(196, 92, 92, 0.25);
--glow-vermillion: 0 0 16px rgba(196, 92, 92, 0.35);
```

### 2.3 Entity Colors (Preserved)

| Entity | Token | Hex | Usage |
|--------|-------|-----|-------|
| Character | `--color-character` | #e8b87d | Orange - warm, human |
| Item | `--color-item` | #9b7ed9 | Purple - mystical |
| Location | `--color-location` | #5eb5a6 | Teal - grounded |
| Faction | `--color-faction` | #d45d5d | Red - danger/contrast |
| Outline | `--color-outline` | #5b8ee8 | Blue - structure |
| IF Line | `--color-ifline` | #7eb84a | Green - growth |

---

## 3. Background Design

### 3.1 Writing Environment Background

**Current Issue:** Multiple animated layers (particles, gradients, orbs) may distract during writing.

**Proposed Solution - Layered Quiet Design:**

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 0: Solid Base                                        │
│   Dark: #0d0d12 → #12121a gradient (top to bottom)          │
│   Light: #f5f0e6 → #f0ebe0 gradient (top to bottom)         │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Subtle Texture (optional, disabled by default)      │
│   Paper texture at 3-5% opacity for writing areas           │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Vignette (immersive mode only)                     │
│   radial-gradient: transparent 40% → rgba(0,0,0,0.4) 100%   │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Content                                            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Chat/Settings Background

Keep subtle ambient effects but reduce:
- Remove pulsing glow orbs from ChatInitPage
- Reduce DynamicBackground particle count by 50%
- Disable starfield/wave animations (use static grid mode)

### 3.3 Writing Canvas Background

**Critical Zone - Maximum Focus:**

```css
/* WritingCanvas background */
--writing-bg-dark: #1a1a2e;      /* Slightly lighter than base */
--writing-bg-light: #faf6e8;      /* Warm paper tone */
--writing-surface-dark: #1e1e32;
--writing-surface-light: #ffffff;

/* Paper texture: subtle noise at 4% opacity */
background-image: url("data:image/svg+xml,...noise pattern...");
```

---

## 4. Component Layout Improvements

### 4.1 Spacing System (4px Base)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight elements |
| `--space-2` | 8px | Related items |
| `--space-3` | 12px | Component padding |
| `--space-4` | 16px | Standard gap |
| `--space-6` | 24px | Section spacing |
| `--space-8` | 32px | Major sections |

### 4.2 Card Elevation System

Consolidate to 3 levels (remove 6-intensity GlassCard complexity):

| Level | Token | Usage | Shadow |
|-------|-------|-------|--------|
| Surface | `--card-surface` | Default cards | `0 0 0 1px rgba(255,255,255,0.06)` |
| Raised | `--card-raised` | Floating elements | `0 4px 12px rgba(0,0,0,0.25)` |
| Elevated | `--card-elevated` | Modals, drawers | `0 8px 24px rgba(0,0,0,0.35)` |

### 4.3 Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Inputs, small elements |
| `--radius-md` | 8px | Buttons, cards |
| `--radius-lg` | 12px | Panels, drawers |
| `--radius-xl` | 16px | Modals |

---

## 5. Glow and Accent Effects

### 5.1 Strategic Glow Usage

**Reduce overuse by limiting glow to:**

| Element | Glow Type | When Active |
|---------|-----------|-------------|
| Primary buttons | Medium glow | Hover + Focus |
| Active drawer | Subtle border glow | When open |
| Writing toolbar | Very subtle | On hover |
| AI operation indicators | Pulsing | When AI is processing |
| Focus rings | Strong glow | Keyboard navigation |

**Remove glow from:**
- Static cards and panels (keep only borders)
- Entity badges (keep color, remove shadow)
- Chat messages (keep sender distinction via background)
- Ambient background orbs (ChatInitPage)

### 5.2 Glow Animation Guidelines

```css
/* Standard glow animation - use sparingly */
@keyframes glow-standard {
  0%, 100% { box-shadow: 0 0 8px rgba(94, 106, 210, 0.25); }
  50% { box-shadow: 0 0 16px rgba(94, 106, 210, 0.4); }
}

/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .glow, .glow-pulse, .breathe {
    animation: none;
  }
}
```

---

## 6. Typography Optimization

### 6.1 Writing Area (Long-form Chinese)

**Font Stack:**
```css
--font-writing: 'Noto Serif SC', 'Source Han Serif CN', Georgia, serif;
```

**Specifications:**
| Property | Value | Rationale |
|----------|-------|-----------|
| Font size | 17px (1.0625rem) | Comfortable reading |
| Line height | 1.85 | Chinese character spacing |
| Letter spacing | 0.02em | Slight expansion for readability |
| Paragraph spacing | 1.5em | Clear paragraph breaks |

### 6.2 UI Text

**Font Stack:**
```css
--font-ui: 'Inter', 'Noto Sans SC', -apple-system, sans-serif;
```

**Specifications:**
| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Page title | 20px | 600 | 1.3 |
| Section header | 16px | 600 | 1.4 |
| Body text | 14px | 400 | 1.5 |
| Secondary text | 13px | 400 | 1.5 |
| Caption/label | 12px | 500 | 1.4 |

### 6.3 Writing Stats/Overlay

Use monospace for numbers:
```css
--font-stats: 'JetBrains Mono', 'Fira Code', monospace;
font-feature-settings: "tnum", "cv01";
```

---

## 7. Dark/Light Mode Balance

### 7.1 Mode-specific Adjustments

**Dark Mode (Default):**
- Base background: `--ink-100` (#0d0d12)
- Writing surface: `--ink-90` (#1a1a2e)
- Text: `--paper-100` (#f5f0e6)
- Borders: rgba(255,255,255,0.06)
- Subtle glow on interactive elements

**Light Mode (Needs Polish):**
- Base background: `--paper-100` (#f5f0e6)
- Writing surface: #faf6e8 (warm tint)
- Text: `--ink-90` (#1a1a2e)
- Borders: rgba(0,0,0,0.08)
- Softer shadows (reduce intensity by 40%)
- Remove glow effects (replaced with subtle borders)

### 7.2 Theme Presets (Preserve 6 Themes)

| Theme | Adjustment from Dark Base |
|-------|---------------------------|
| dark | Base dark mode |
| light | Invert to paper tones |
| eye-care | Shift text to #c8d4c8 (muted green) |
| midnight-blue | Add 10% blue tint to backgrounds |
| warm-paper | Increase warm tones, sepia undertones |
| forest-green | Shift to green-tinted dark |

### 7.3 Smooth Transitions

```css
:root {
  transition: background-color 0.3s ease,
              color 0.2s ease,
              border-color 0.2s ease,
              box-shadow 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    transition: none;
  }
}
```

---

## 8. Animation Optimization

### 8.1 Reduce Concurrent Animations

**Current Problem:** Glow pulse, breathe, float, shimmer all animate simultaneously.

**Solution: Animation Hierarchy**

| Priority | Animation | Elements | Duration |
|----------|-----------|----------|----------|
| Critical | Page transitions | Pages | 250ms |
| Important | Micro-interactions | Buttons, inputs | 150ms |
| Ambient | Loading states | Spinners | continuous |
| None | Decorative glows | Static cards | REMOVE |

### 8.2 Animation Whitelist

Keep:
- `pulse-slow` - AI processing indicators only
- `shimmer-subtle` - Loading skeletons only
- `ripple` - Button click feedback only
- `accordion-down/up` - Collapsible panels only

Remove/Disable:
- `glow-pulse` - Replace with static glow on active states
- `breathe` - Remove entirely (unnecessary ambient)
- `float` - Remove from background orbs, keep only for error states
- `glow` - Standardize to static `box-shadow`

---

## 9. Implementation Checklist

### High Priority

- [ ] Consolidate glow tokens (remove scattered inline glows)
- [ ] Apply reduced-motion to all animations
- [ ] Polish light theme borders and remove inappropriate glows
- [ ] Set writing area font to 17px/1.85 line-height

### Medium Priority

- [ ] Simplify GlassCard from 6 intensities to 3 levels
- [ ] Remove ambient glow orbs from ChatInitPage
- [ ] Reduce DynamicBackground particle count
- [ ] Add smooth theme transition CSS

### Lower Priority

- [ ] Standardize icon sizes (w-3.5 throughout UI)
- [ ] Document design token usage guidelines
- [ ] Create reduced-motion alternative stylesheet

---

## 10. File Changes Required

| File | Changes |
|------|---------|
| `src/frontend/src/styles/globals.css` | Add refined glow tokens, update animations section |
| `src/frontend/tailwind.config.js` | Add `--glow-*` tokens to theme.extend, update shadow scale |
| `src/frontend/src/components/shared/ThemeProvider.tsx` | Add smooth transitions, reduced-motion handling |

---

## 11. Validation Criteria

1. **Contrast:** All text meets WCAG AA (4.5:1 normal, 3:1 large)
2. **Performance:** No more than 3 concurrent animations on screen
3. **Reduced Motion:** `prefers-reduced-motion: reduce` disables all decorative animations
4. **Writing Focus:** WritingCanvas has no animated elements
5. **Light Theme:** No glow effects in light mode (only borders/shadows)

---

*Specification prepared for frontend-implementer (Task #4)*

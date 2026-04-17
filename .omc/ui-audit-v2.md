# UI Audit v2 — Against Research Findings

## Audit Scope
- WritingCanvas.tsx
- Button.tsx (all variants)
- globals.css color system
- Typography for Chinese writing

---

## 1. WritingCanvas.tsx Audit

### 1.1 Background Suitability for Long Writing Sessions

| Attribute | Spec (CLAUDE.md) | Actual | Status |
|-----------|-----------------|--------|--------|
| Font size | 16-18px | 17px | OK |
| Line height | 1.75-2em | 1.85 | OK |
| Writing font | Source Serif / Noto Serif SC | Source Serif 4 | OK |
| Dark background | #1a1a2e (深墨色) | #1a1a2e | OK |
| Light background | #faf6e8 (宣纸白) | #faf6e8 | OK |
| Body text color (dark) | #f5f0e6 | Hardcoded #3d3d3d | **ISSUE** |
| Body text color (light) | #f5f0e6 | #3d3d3d | OK |

**Issues:**
1. Background colors are hardcoded instead of using CSS variables `--color-writing-dark` / `--color-writing-light`
2. Text color in Tiptap is hardcoded `#3d3d3d` (globals.css line 176: `color: #3d3d3d`)

### 1.2 Title/Body Separation

| Element | Implementation | Issue |
|---------|---------------|-------|
| Title font | `font-['Inter']` | **Wrong font** — CLAUDE.md specifies serif for Chinese writing |
| Title line-height | 1.75 | OK but inconsistent with body 1.85 |
| Body line-height | 1.85 | OK |
| Divider | Gradient `from-transparent via-[#d4c8a8] to-transparent` | Nice touch, but hardcoded |
| Title size | text-2xl (24px) | OK |

**Gap:** Title uses Inter (sans-serif) instead of serif font. For Chinese novel writing, a serif font (Source Serif 4) should be used for titles as well.

### 1.3 Status Bar
- Uses `bg-[var(--color-bg-surface)]` correctly
- But border is hardcoded `border-[var(--color-border-subtle)]` instead of `border-[var(--color-border)]`

---

## 2. Button Component Audit

### 2.1 Button.tsx Variant Styles

| Variant | Spec | Actual | Status |
|---------|------|--------|--------|
| **ghost** bg | rgba(255,255,255,0.02) | `rgba(255,255,255,0.02)` | OK |
| **ghost** border | rgb(36,40,44) | `border border-[rgb(36,40,44)]` | OK |
| **ghost** text | #e2e4e7 | text-[#e2e4e7] | OK |
| **primary** | #5e6ad2 | `bg-[#5e6ad2]` | OK |
| **default** | accent variable | `bg-var-accent` | OK |
| **outline** | border variable | `border border-var-border` | OK |

**Finding:** Button.tsx component definitions are correct per Linear spec.

### 2.2 Ghost Button Usage Inconsistencies

Despite Button.tsx being correct, **inline ghost buttons throughout the codebase do not use the Button component**. They use hardcoded inline styles:

**WritingToolbar.tsx:**
```tsx
// Line 40-60: Toolbar uses Button component ✓
// But ToolbarButton (lines 124-150) uses variant="ghost" correctly via Button component
```

**WritingEditorPage.tsx:**
```tsx
// Line 29-35: Close button uses Button component with variant="ghost" ✓
<Button variant="ghost" size="icon">
  <X className="w-4 h-4 text-[#d0d6e0]" />
</Button>
```

**Gap:** The Button component is correctly implemented. However, some icon buttons use `text-[#d0d6e0]` directly on the child icon instead of inheriting from the button's text color. This is minor but inconsistent.

### 2.3 Ghost Button Border vs Linear Spec

Linear ghost buttons have:
- Background: transparent
- Border: `1px solid rgb(36,40,44)` — a **dark gray** border, NOT a white-tinted border

The current implementation correctly uses `border-[rgb(36,40,44)]`. This is different from the `outline` variant which uses `border-var-border` (white rgba). This is **correct**.

---

## 3. Color Variables in globals.css

### 3.1 Alignment with Linear Design System

| Variable | Linear Spec | Value | Status |
|----------|-------------|-------|--------|
| `--color-bg-primary` | #08090a | #08090a | OK |
| `--color-bg-surface` | #0f1011 | #0f1011 | OK |
| `--color-bg-elevated` | #191a1b | #191a1b | OK |
| `--color-text-primary` | #f7f8f8 | #f7f8f8 | OK |
| `--color-text-secondary` | #d0d6e0 | #d0d6e0 | OK |
| `--color-text-muted` | #8a8f98 | #8a8f98 | OK |
| `--color-accent` | #5e6ad2 | #5e6ad2 | OK |
| `--color-border` | rgba(255,255,255,0.08) | rgba(255,255,255,0.08) | OK |
| `--color-border-subtle` | rgba(255,255,255,0.05) | rgba(255,255,255,0.05) | OK |

**Finding:** CSS variables are correctly aligned with Linear's commercial design system.

### 3.2 Semantic Colors for Chinese Web Novels

| Variable | Value | Usage | Status |
|----------|-------|-------|--------|
| `--color-character` | #e8b87d | 角色橙 | OK |
| `--color-item` | #9b7ed9 | 物品紫 | OK |
| `--color-location` | #5eb5a6 | 地点青 | OK |
| `--color-faction` | #d45d5d | 势力红 | OK |
| `--color-outline` | #5b8ee8 | 大纲蓝 | OK |
| `--color-ifline` | #7eb84a | IF线绿 | OK |

**Finding:** Entity color coding system is well-defined and follows the spec.

### 3.3 CSS Variable Coverage Gap

**Problem: Variables defined but not used**

| Variable | Defined | Used in components |
|----------|---------|-------------------|
| `--color-writing-light` | Yes | No (hardcoded in WritingCanvas) |
| `--color-writing-dark` | Yes | No (hardcoded in WritingCanvas) |
| `--color-ink` | Yes (#1a1a2e) | No |
| `--color-paper` | Yes (#f5f0e6) | No |
| `--color-bg-primary` | Yes | No (components use hardcoded #08090a) |
| `--color-bg-surface` | Yes | Partially (status bar uses it, but other components hardcode) |

---

## 4. Typography Audit for Chinese Writing

### 4.1 Font Choices

| Element | Spec | Actual | Status |
|---------|------|--------|--------|
| Writing font | Source Han Serif / Noto Serif SC | Source Serif 4 | **OK** |
| Title font | Serif for Chinese | Inter (sans-serif) | **ISSUE** |
| UI font | Source Han Sans / Inter | Inter | OK |
| Mono font | JetBrains Mono | JetBrains Mono | OK |

### 4.2 Font Sizes

| Element | Spec | Actual | Status |
|---------|------|--------|--------|
| Writing body | 16-18px | 17px | OK |
| Title (h1) | ~24px | text-2xl (24px) | OK |
| UI text | 13-14px | 14px | OK |
| Input/Textarea | Should be writing size (16-18px) | 14px | **TOO SMALL** |

### 4.3 Line Heights

| Element | Spec | Actual | Status |
|---------|------|--------|--------|
| Writing body | 1.75-2em | 1.85 | OK |
| Title | Should match body | 1.75 | OK |
| UI text | 1.5em | 1.5 | OK |
| Paragraph spacing | 1.2-1.5em | 1.2em | OK |

### 4.4 Letter Spacing

| Element | Spec | Actual | Status |
|---------|------|--------|--------|
| Writing body | 0.03-0.05em | 0.03em | OK |
| Title | -0.02em (tight) | -0.02em | OK |

---

## 5. Key Gaps Summary

### P0 — Critical (Must Fix)
1. **WritingCanvas hardcoded colors**: Uses `#faf6e8`, `#1a1a2e`, `#3d3d3d` instead of CSS variables
2. **Title font**: Uses Inter instead of serif for Chinese title text

### P1 — Important (Should Fix)
3. **Input/Textarea font size**: 14px is too small for a writing interface (should be 16-18px)
4. **Tiptap body text color**: Hardcoded `#3d3d3d` in globals.css instead of CSS variable
5. **WritingCanvas status bar**: Uses `border-subtle` instead of `border` variable

### P2 — Nice to Have
6. **Title/body line-height consistency**: Title 1.75 vs body 1.85 — should unify
7. **Icon button text color**: Some icons have hardcoded `text-[#d0d6e0]` instead of inheriting

---

## 6. Specific Improvement Recommendations

### 6.1 WritingCanvas Color Variables
```tsx
// Before
<div className="h-full flex flex-col bg-[#1a1a2e]">
  <div className="flex-1 overflow-y-auto bg-[#faf6e8]">
    <h1 className="... text-[#3d3d3d]">

// After
<div className="h-full flex flex-col dark:bg-[var(--color-writing-dark)]">
  <div className="flex-1 overflow-y-auto bg-[var(--color-writing-light)]">
    <h1 className="font-serif ... text-[var(--color-text-primary)] dark:text-[var(--color-paper)]">
```

### 6.2 WritingCanvas Title Font
```tsx
// Before
<h1 className="font-['Source_Serif_4','Noto_Serif_SC',Georgia,serif]">

// After (consistent serif for Chinese titles)
<h1 className="font-serif">
```

### 6.3 Input/Textarea Typography
```css
/* globals.css */
.input, .textarea {
  font-size: 16px; /* Up from 14px for writing interface */
  line-height: 1.6;
}
```

### 6.4 Tiptap Text Color Variable
```css
/* globals.css */
// Before
.writing-area .tiptap {
  color: #3d3d3d;
}

// After
.writing-area .tiptap {
  color: var(--color-writing-text, #3d3d3d);
}
```

---

## 7. Comparison: Current vs Commercial Solutions

| Aspect | Linear (Reference) | This Project | Verdict |
|--------|-------------------|--------------|---------|
| Background layers | 3 distinct levels | 3 levels defined | OK |
| Ghost button | Subtle gray border | Subtle gray border | OK |
| Writing surface | Pure white/off-white | Warm paper tone | **Better** ✓ |
| Typography | 14px UI / 15px body | 14px UI / 17px body | **Better for writing** ✓ |
| Entity colors | Monochrome | 6-color semantic | **Better for novels** ✓ |
| CSS variable usage | 100% | ~60% | **Needs improvement** |

---

## 8. Appendix: Component CSS Variable Usage Map

| Component | CSS Variables Used | Hardcoded Colors |
|-----------|-------------------|------------------|
| WritingCanvas | partial | #1a1a2e, #faf6e8, #3d3d3d, #d4c8a8 |
| WritingToolbar | partial | #0f1011 border, #d0d6e0 icon |
| WritingEditorPage | none | #08090a, #191a1b, #f7f8f8 |
| Button | accent, border | ghost border rgb(36,40,44) |
| Input | none | All hardcoded rgba values |
| Textarea | none | All hardcoded rgba values |
| AIOperationDrawer | (not reviewed) | Likely hardcoded |
| CollaborationPanel | (not reviewed) | Likely hardcoded |

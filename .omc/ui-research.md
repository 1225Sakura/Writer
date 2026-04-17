# Writing Assistant UI/UX Research

**Date:** 2026-04-17
**Team:** writer-ui-v2
**Status:** Complete

---

## 1. Scrivener

### Color Schemes
- **Default themes:** "Miller" (warm cream/paper tones), "Steam" (dark gray/blue), "Novel" (cream with sepia tones), "Typewriter" (light gray background)
- **Dark mode:** Charcoal (#2b2b2b), slate gray backgrounds with warm off-white text
- ** Corkboard mode:** Cream index cards on natural cork texture background
- **Focus mode:** Full-screen distraction-free with configurable background colors

### Typography
- **Editor font options:** System fonts + serif/sans-serif choices (Georgia, Times, Arial)
- **Default:** Georgia 14px for manuscript, customizable line spacing (1.5-2.0)
- **Composition mode:** Large serif fonts (18-24px), generous margins

### Layout Patterns
- **Three-panel layout:** Binder (left) / Editor (center) / Inspector (right collapsible)
- **Scrivenings mode:** Single scroll through multiple sections
- **Corkboard:** Index card grid for chapter overview
- **Outliner:** Collapsible chapter/section tree
- **Collections:** Virtual folders for research organization

---

## 2. Ulysses

### Color Schemes
- **Light theme:** Clean white (#ffffff) with subtle gray dividers
- **Dark theme:** True dark (#1c1c1e) with warm gray text
- **Sepia theme:** Warm cream (#f4ecd8) background for focused writing
- **Markup highlights:** Color-coded markup elements (headers, emphasis, links)
- **Library:** Group/sheet hierarchy with subtle background differentiation

### Typography
- **Editor:** System fonts (San Francisco on Mac) + bundled Source Serif Pro
- **Default size:** 16-18px, line height 1.6-1.8
- **Markup-aware:** Text rendered with semantic styling inline

### Layout Patterns
- **Sheet browser:** Three-level hierarchy (Groups > Sheets > Text)
- **Focus mode:** Centered text column (600-700px max-width)
- **Split view:** Side-by-side sheet comparison
- **Keyboard-driven:** Heavy keyboard shortcut reliance

---

## 3. 纯纯写作 (Pure Writer)

### Color Schemes
- **Dark mode primary:** Deep black (#000000) background, pure white (#ffffff) text
- **Light mode:** Warm white (#fafafa) background, near-black (#1a1a1a) text
- **Accent color:** Subtle blue (#4a90d9) for cursor and highlights
- **No decorative elements:** Maximum focus on text

### Typography
- **Font:** System default sans-serif, Japanese-style clean typography
- **Size:** 16px default, adjustable
- **Line height:** 1.8-2.0 for readability
- **No font ornamentation:** Monospace optional for markdown users

### Layout Patterns
- **Full-screen focus:** Edge-to-edge writing area
- **No sidebars:** Completely distraction-free
- **Minimal toolbar:** Appears on demand (tap/hover)
- **Markdown shortcuts:** Real-time rendered preview optional

---

## 4. Writeathon

### Color Schemes
- **Primary:** Dark blue-gray (#1e2430) background
- **Accent:** Teal (#4ecdc4) for interactive elements
- **Card backgrounds:** Slightly lighter (#2a3441)
- **Writing area:** Maximum contrast off-white (#f5f5f5) on dark
- **Status indicators:** Warm orange (#ff6b6b) for word counts/goals

### Typography
- **Editor:** Noto Sans CJK SC / Source Han Sans for Chinese
- **Monospace option:** JetBrains Mono for code snippets
- **Size:** 15-17px default, adjustable via快捷键

### Layout Patterns
- **Dashboard:** Card-based goal tracking, writing streaks
- **Editor:** Centered column (720px), full-height
- **Sidebar:** Collapsible outline/character panel (left)
- **Right drawer:** Quick notes, research snippets

---

## 5. 作家助手 (Writer's Assistant - 起点中文网)

### Color Schemes
- **Light mode:** Clean white (#ffffff) with blue (#2196f3) accents
- **Dark mode:** Dark gray (#1f2937) with lighter gray panels
- **Manuscript paper:** Option for cream (#fffef0) "paper" feel
- **Highlight colors:** Yellow (comments), green (accept), red (reject)

### Typography
- **Chinese-optimized:** Source Han Sans SC / 方正静蕾体 for headers
- **Body:** 14-16px, line-height 1.8
- **Chapter titles:** 18-20px bold

### Layout Patterns
- **Three-column classic:** Navigation (left) / Editor (center) / Preview (right)
- **Tab-based chapters:** Easy chapter switching
- **Split view:** Original vs. AI suggestions
- **Mobile-first:** Simplified mobile interface for on-the-go writing

---

## Common Patterns Summary

### Color Scheme Patterns
| Pattern | Usage |
|---------|-------|
| Dark backgrounds | Reduce eye strain, focus on text |
| Warm off-whites | Mimic paper/traditional writing feel |
| High contrast text | Ensure readability (white on near-black or black on cream) |
| Minimal accent colors | One primary accent, used sparingly for interactivity |
| Neutral backgrounds | No distracting textures or patterns |

### Typography Patterns
| Pattern | Usage |
|---------|-------|
| Serif for long-form | Better reading rhythm for narrative |
| 16-18px body | Optimal for sustained reading |
| 1.75-2.0 line-height | Prevents line crowding, aids comprehension |
| Generous margins | Visual breathing room, focus |
| Monospace optional | Code snippets, markdown editing |

### Layout Patterns
| Pattern | Usage |
|---------|-------|
| Distraction-free | Hide all chrome in focus mode |
| Centered column | 600-800px max-width for readability |
| Collapsible sidebars | Show/hide based on need |
| Keyboard shortcuts | Power user efficiency |
| Full-screen option | Maximum immersion |

### Animation Patterns
| Pattern | Usage |
|---------|-------|
| Subtle fades | Panel transitions (150-200ms) |
| No bounce/elastic | Writing = focus, not play |
| Smooth scrolling | Text navigation |
| Gentle highlight pulse | Cursor position, selection |
| Slide-in drawers | Settings, tools panels |

### Component Design Patterns
| Component | Design Notes |
|-----------|--------------|
| Toolbar | Icon-only or text+icon, appears on hover/selection |
| Context menus | Right-click for formatting, appears near cursor |
| Word count | Non-intrusive, usually bottom-right or status bar |
| Progress indicators | Subtle, don't interrupt flow (streaks, goals) |
| Modal dialogs | Avoid except critical (delete, settings) |
| Tooltips | Shortcuts hints, appear on hover after 500ms delay |

---

## Recommendations for Auto Novel Writer

### Adopt from Research
1. **Color:** Deep charcoal (#1a1a2e) background with warm off-white (#f5f0e6) text matches professional tools and CLAUDE.md spec
2. **Typography:** 16-18px serif for writing, 1.75-2.0 line-height, centered column (720px max)
3. **Layout:** Full-screen writing mode with collapsible drawers for AI/collaboration tools
4. **Animation:** Minimal - 150-200ms fades for panel transitions only
5. **Focus mode:** Hide all non-essential UI, escape key to exit

### Differentiation Opportunities
- **IF line visualization:** Unique graph-based approach (react-force-graph)
- **AI collaboration panel:** Real-time suggestion drawer (right side)
- **Writing style presets:** Visual previews before selection
- **Chinese-optimized:** Stronger Chinese font support than foreign apps

---

## Sources

Based on public documentation, App Store descriptions, and user interface analyses of:
- Scrivener (Literature & Latte) - v3.x interface
- Ulysses (Ulysses GmbH) - v28+ interface
- 纯纯写作 (Double Think Studio) - Android/iOS
- Writeathon (Zhihui) - Desktop version
- 作家助手 (Qidian/Tencent) - Mobile + Desktop

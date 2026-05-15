/**
 * ThemeSelector - Theme selection UI components
 *
 * Provides ThemePreviewSwatches, ThemeSelector, and ThemeSelectorCompact
 * for visually choosing between the 6 available themes.
 */

import type { Theme } from '@/hooks/useTheme'
import { themeMetaList } from './ThemeData'

/**
 * Theme preview swatch component
 * Displays 4 color squares representing theme characteristic colors
 */
export function ThemePreviewSwatches({ themeId, size = 'sm' }: { themeId: Theme; size?: 'sm' | 'md' }) {
  const meta = themeMetaList.find((t) => t.id === themeId)
  if (!meta) return null

  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const gapClass = size === 'sm' ? 'gap-0.5' : 'gap-1'

  return (
    <div className={`flex ${gapClass} items-center`} aria-hidden="true">
      <div
        className={`${sizeClass} rounded-sm border border-[var(--border-subtle)]`}
        style={{ backgroundColor: meta.preview.surface }}
        title="背景色"
      />
      <div
        className={`${sizeClass} rounded-sm border border-[var(--border-subtle)]`}
        style={{ backgroundColor: meta.preview.text }}
        title="文字色"
      />
      <div
        className={`${sizeClass} rounded-sm border border-[var(--border-subtle)]`}
        style={{ backgroundColor: meta.preview.accent }}
        title="强调色"
      />
      <div
        className={`${sizeClass} rounded-sm border border-[var(--border-subtle)]`}
        style={{ backgroundColor: meta.preview.border }}
        title="边框色"
      />
    </div>
  )
}

/**
 * Theme selector component with visual preview
 */
export function ThemeSelector({
  currentTheme,
  onThemeChange,
  className,
}: {
  currentTheme: Theme
  onThemeChange: (theme: Theme) => void
  className?: string
}) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${className || ''}`} role="radiogroup" aria-label="主题选择">
      {themeMetaList.map((meta) => (
        <button
          key={meta.id}
          role="radio"
          aria-checked={currentTheme === meta.id}
          onClick={() => onThemeChange(meta.id)}
          className={`
            flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left
            transition-all duration-200 border
            ${
              currentTheme === meta.id
                ? 'border-[var(--accent-primary)] bg-[var(--accent-muted)]'
                : 'border-[var(--border-subtle)] bg-[var(--color-surface-raised)] hover:border-[var(--border-default)]'
            }
          `}
        >
          <ThemePreviewSwatches themeId={meta.id} size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{meta.label}</div>
            <div className="text-xs text-[var(--text-tertiary)] truncate">{meta.description}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

/**
 * Compact theme selector for toolbar / tight spaces
 */
export function ThemeSelectorCompact({
  currentTheme,
  onThemeChange,
}: {
  currentTheme: Theme
  onThemeChange: (theme: Theme) => void
}) {
  return (
    <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-surface-overlay)' }}>
      {themeMetaList.map((meta) => (
        <button
          key={meta.id}
          onClick={() => onThemeChange(meta.id)}
          title={`${meta.label} - ${meta.description}`}
          className={`
            relative p-1.5 rounded-md transition-all duration-200
            ${currentTheme === meta.id ? 'ring-2 ring-[var(--accent-primary)]' : 'hover:bg-[var(--color-surface-hover)]'}
          `}
        >
          <div
            className="w-5 h-5 rounded-full border"
            style={{
              backgroundColor: meta.preview.surface,
              borderColor: meta.preview.border,
            }}
          >
            <div
              className="w-2 h-2 rounded-full mx-auto mt-1"
              style={{ backgroundColor: meta.preview.accent }}
            />
          </div>
        </button>
      ))}
    </div>
  )
}

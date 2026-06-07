import { useState, useCallback } from 'react'
import { List, LayoutGrid, Table2, Network } from 'lucide-react'
import { motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'
import { SPRING } from '@/components/shared/AnimationConfig'

export type ViewMode = 'list' | 'kanban' | 'table' | 'canvas'

const VIEW_OPTIONS: Array<{ mode: ViewMode; icon: typeof List; label: string }> = [
  { mode: 'list', icon: List, label: '列表' },
  { mode: 'kanban', icon: LayoutGrid, label: '看板' },
  { mode: 'table', icon: Table2, label: '表格' },
  { mode: 'canvas', icon: Network, label: '画布' },
]

const STORAGE_KEY = 'setting-editor-view-mode'

function loadPersistedMode(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && VIEW_OPTIONS.some((v) => v.mode === stored)) {
      return stored as ViewMode
    }
  } catch {
    // localStorage unavailable — fall through
  }
  return 'list'
}

function persistMode(mode: ViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // localStorage unavailable — silently ignore
  }
}

interface ViewSwitcherProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  const handleChange = useCallback(
    (mode: ViewMode) => {
      persistMode(mode)
      onChange(mode)
    },
    [onChange],
  )

  return (
    <div
      className="flex items-center gap-0.5 rounded-md p-0.5 bg-[var(--color-surface-raised)] border border-[var(--border-subtle)]"
      role="radiogroup"
      aria-label="视图模式"
    >
      {VIEW_OPTIONS.map(({ mode, icon, label }) => {
        const isActive = value === mode
        return (
          <button
            key={mode}
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => handleChange(mode)}
            className="relative flex items-center justify-center w-7 h-7 rounded-[5px] transition-colors"
          >
            {isActive && (
              <motion.span
                layoutId="view-switcher-indicator"
                className="absolute inset-0 rounded-[5px] bg-[var(--accent-muted)]"
                transition={SPRING.SNAPPY}
              />
            )}
            <Icon
              icon={icon}
              size="xs"
              color={isActive ? 'accent' : 'muted'}
              className="relative z-10"
            />
          </button>
        )
      })}
    </div>
  )
}

/**
 * Hook that manages ViewMode with localStorage persistence.
 * Initial value is loaded from localStorage; changes are persisted automatically.
 */
export function usePersistedViewMode(_defaultMode: ViewMode = 'list'): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(loadPersistedMode)

  const handleChange = useCallback((newMode: ViewMode) => {
    persistMode(newMode)
    setMode(newMode)
  }, [])

  return [mode, handleChange]
}

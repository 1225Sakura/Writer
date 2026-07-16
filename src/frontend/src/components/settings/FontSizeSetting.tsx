/**
 * Font Size Setting (US-019 polish).
 *
 * Compact slider/select pair that drives `uiStore.fontSize`. The value is
 * mirrored to:
 *   - `localStorage['writer-font-size']` — survives page reloads
 *   - The CSS custom property `--writer-font-size` on `:root` — applies
 *     to writing-area typography globally.
 *
 * Mounted inside the settings editor's right rail / status area.
 */
import { useEffect } from 'react'
import { Type } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { useUIStore } from '@/store/uiStore'

const SIZE_OPTIONS = [12, 14, 16, 18, 20, 24] as const

const STORAGE_KEY = 'writer-font-size'

function readPersistedFontSize(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function FontSizeSetting() {
  const fontSize = useUIStore((state) => state.fontSize)
  const setFontSize = useUIStore((state) => state.setFontSize)

  // On mount, hydrate from localStorage (covers cases where the persist
  // middleware hasn't rehydrated yet, e.g. tests / SSR-like contexts).
  useEffect(() => {
    const stored = readPersistedFontSize()
    if (stored !== null && stored !== fontSize) {
      setFontSize(stored)
      return
    }
    // Always apply current store value to CSS so first paint is correct.
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--writer-font-size', `${fontSize}px`)
    }
  }, [fontSize, setFontSize])

  return (
    <div className="flex items-center gap-2" data-testid="font-size-setting">
      <Icon icon={Type} size="xs" color="inherit" />
      <label
        htmlFor="font-size-select"
        className="text-xs text-[var(--text-tertiary)] whitespace-nowrap"
      >
        正文字号
      </label>
      <select
        id="font-size-select"
        data-testid="font-size-select"
        value={fontSize}
        onChange={(e) => setFontSize(Number.parseInt(e.target.value, 10))}
        className="text-xs rounded-md border px-2 py-1 bg-[var(--color-surface-overlay)] text-[var(--text-primary)] border-[var(--border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
      >
        {SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}px
          </option>
        ))}
      </select>
    </div>
  )
}

export default FontSizeSetting

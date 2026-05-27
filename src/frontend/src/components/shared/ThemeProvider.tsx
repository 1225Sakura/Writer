/**
 * ThemeProvider - Theme context provider
 *
 * Integrates 6 themes with Ink/Parchment design token system.
 * Sub-components are split into:
 *   - ThemeData.ts      — themeMetaList, themeVariableMap, ThemeMeta
 *   - ThemeUtils.ts     — applyThemeVariables
 *   - ThemeSelector.tsx — ThemePreviewSwatches, ThemeSelector, ThemeSelectorCompact
 */

import { createContext, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { themeMetaList } from './ThemeData'
import { applyThemeVariables } from './ThemeUtils'
import { updateCanvasColors } from '@/components/settings/GraphCanvasRenderers'

// Re-export sub-components for backward compatibility
export { ThemePreviewSwatches, ThemeSelector, ThemeSelectorCompact } from './ThemeSelector'
export { themeMetaList, type ThemeMeta } from './ThemeData'
export { applyThemeVariables } from './ThemeUtils'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  cycleTheme: () => void
  followSystem: boolean
  setFollowSystem: (follow: boolean) => void
  isDark: boolean
  themeList: Theme[]
  themeMeta: ThemeMeta[]
}

import type { ThemeMeta } from './ThemeData'

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme, toggleTheme, cycleTheme, followSystem, setFollowSystem, isDark, themeList } = useTheme()

  // Apply CSS variables when theme changes
  useEffect(() => {
    applyThemeVariables(theme)
    // Update Canvas color cache after CSS variables are applied
    requestAnimationFrame(() => updateCanvasColors())
  }, [theme])

  // Handle smooth theme transitions and reduced motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const root = document.documentElement

    if (mediaQuery.matches) {
      root.classList.add('motion-reduce')
    } else {
      root.classList.remove('motion-reduce')
    }

    const handleTransition = () => {
      if (mediaQuery.matches) {
        root.style.setProperty('--transition-duration', '0ms')
      } else {
        root.style.setProperty('--transition-duration', '250ms')
      }
    }

    handleTransition()
    mediaQuery.addEventListener('change', handleTransition)
    return () => mediaQuery.removeEventListener('change', handleTransition)
  }, [])

  // Sync with system theme preference when user hasn't manually selected
  useEffect(() => {
    if (followSystem) return // useTheme hook handles this case

    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const handleSystemChange = () => {
      const savedTheme = localStorage.getItem('theme')
      const systemPrefers = localStorage.getItem('theme-system-prefers')
      if (systemPrefers === 'true' || (!savedTheme)) {
        setFollowSystem(true)
      }
    }

    media.addEventListener('change', handleSystemChange)
    return () => media.removeEventListener('change', handleSystemChange)
  }, [followSystem, setFollowSystem])

  const handleSetTheme = useCallback(
    (newTheme: Theme) => {
      setTheme(newTheme)
    },
    [setTheme]
  )

  const value = useMemo(
    () => ({
      theme,
      setTheme: handleSetTheme,
      toggleTheme,
      cycleTheme,
      followSystem,
      setFollowSystem,
      isDark,
      themeList,
      themeMeta: themeMetaList,
    }),
    [theme, handleSetTheme, toggleTheme, cycleTheme, followSystem, setFollowSystem, isDark, themeList]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider')
  }
  return context
}

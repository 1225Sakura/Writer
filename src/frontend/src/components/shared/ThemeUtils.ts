/**
 * ThemeUtils - Theme CSS variable application utilities
 */

import type { Theme } from '@/hooks/useTheme'
import { themeVariableMap } from './ThemeData'

/**
 * Apply theme CSS variables to the document root
 */
export function applyThemeVariables(theme: Theme) {
  const root = document.documentElement
  const variables = themeVariableMap[theme]
  if (!variables) return

  requestAnimationFrame(() => {
    Object.entries(variables).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  })
}

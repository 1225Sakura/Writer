import { useState, useCallback, useEffect, useRef } from 'react'

export type Theme = 'dark' | 'light' | 'eye-care' | 'midnight-blue' | 'warm-paper' | 'forest-green'

const THEME_LIST: Theme[] = ['dark', 'light', 'eye-care', 'midnight-blue', 'warm-paper', 'forest-green']

const STORAGE_KEY = 'theme'
const SYSTEM_PREFERS_KEY = 'theme-system-prefers'

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'

  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (saved && THEME_LIST.includes(saved)) return saved

  const systemPrefers = localStorage.getItem(SYSTEM_PREFERS_KEY)
  if (systemPrefers === 'true') {
    return getSystemTheme()
  }

  return getSystemTheme()
}

export interface UseThemeReturn {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  cycleTheme: () => void
  followSystem: boolean
  setFollowSystem: (follow: boolean) => void
  isDark: boolean
  themeList: Theme[]
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [followSystem, setFollowSystemState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SYSTEM_PREFERS_KEY) === 'true'
  })
  const systemMediaRef = useRef<MediaQueryList | null>(null)

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)

    // Also sync dark class for Tailwind/shadcn compatibility
    const isDarkTheme = theme === 'dark' || theme === 'midnight-blue' || theme === 'eye-care' || theme === 'forest-green'
    if (isDarkTheme) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // Trigger transition
    root.classList.add('theme-transitioning')
    const timer = setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 350)

    return () => clearTimeout(timer)
  }, [theme])

  // System preference listener
  useEffect(() => {
    if (!followSystem) return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    systemMediaRef.current = media

    const handler = (e: MediaQueryListEvent) => {
      setThemeState(e.matches ? 'dark' : 'light')
    }

    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [followSystem])

  const setTheme = useCallback((newTheme: Theme) => {
    setFollowSystemState(false)
    localStorage.setItem(SYSTEM_PREFERS_KEY, 'false')
    setThemeState(newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setFollowSystemState(false)
    localStorage.setItem(SYSTEM_PREFERS_KEY, 'false')
    setThemeState(prev => {
      // Toggle between dark and light as the primary action
      if (prev === 'light') return 'dark'
      return 'light'
    })
  }, [])

  const cycleTheme = useCallback(() => {
    setFollowSystemState(false)
    localStorage.setItem(SYSTEM_PREFERS_KEY, 'false')
    setThemeState(prev => {
      const idx = THEME_LIST.indexOf(prev)
      return THEME_LIST[(idx + 1) % THEME_LIST.length]
    })
  }, [])

  const setFollowSystem = useCallback((follow: boolean) => {
    setFollowSystemState(follow)
    localStorage.setItem(SYSTEM_PREFERS_KEY, follow ? 'true' : 'false')
    if (follow) {
      setThemeState(getSystemTheme())
    }
  }, [])

  const isDark = theme === 'dark' || theme === 'midnight-blue' || theme === 'eye-care' || theme === 'forest-green'

  return {
    theme,
    setTheme,
    toggleTheme,
    cycleTheme,
    followSystem,
    setFollowSystem,
    isDark,
    themeList: THEME_LIST,
  }
}

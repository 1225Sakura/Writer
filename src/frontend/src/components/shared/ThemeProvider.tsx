import { createContext, useContext, ReactNode, useEffect, useCallback } from 'react'
import { useTheme, type Theme } from '@/hooks/useTheme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  cycleTheme: () => void
  followSystem: boolean
  setFollowSystem: (follow: boolean) => void
  isDark: boolean
  themeList: Theme[]
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// CSS variable mappings for all theme variants
// These supplement the globals.css [data-theme] selectors for shadcn/ui HSL variables
const themeColors: Record<string, Record<string, string>> = {
  dark: {
    '--background': '0 0% 3.5%',
    '--foreground': '0 0% 98%',
    '--card': '0 0% 5%',
    '--card-foreground': '0 0% 98%',
    '--popover': '0 0% 5%',
    '--popover-foreground': '0 0% 98%',
    '--primary': '238 83% 66%',
    '--primary-foreground': '0 0% 98%',
    '--secondary': '240 3.7% 15.9%',
    '--secondary-foreground': '0 0% 98%',
    '--muted': '240 3.7% 15.9%',
    '--muted-foreground': '240 5% 64.9%',
    '--accent': '240 3.7% 15.9%',
    '--accent-foreground': '0 0% 98%',
    '--destructive': '0 84% 60%',
    '--destructive-foreground': '0 0% 98%',
    '--border': '240 3.7% 15.9%',
    '--input': '240 3.7% 15.9%',
    '--ring': '238 83% 66%',
  },
  light: {
    '--background': '45 30% 96%',
    '--foreground': '240 10% 10%',
    '--card': '0 0% 100%',
    '--card-foreground': '240 10% 10%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '240 10% 10%',
    '--primary': '238 83% 55%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '40 20% 93%',
    '--secondary-foreground': '240 10% 10%',
    '--muted': '40 15% 90%',
    '--muted-foreground': '240 5% 45%',
    '--accent': '40 20% 93%',
    '--accent-foreground': '240 10% 10%',
    '--destructive': '0 72% 56%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '40 15% 85%',
    '--input': '40 15% 90%',
    '--ring': '238 83% 55%',
  },
  'eye-care': {
    '--background': '120 8% 10%',
    '--foreground': '100 20% 90%',
    '--card': '120 8% 14%',
    '--card-foreground': '100 20% 90%',
    '--popover': '120 8% 14%',
    '--popover-foreground': '100 20% 90%',
    '--primary': '120 35% 60%',
    '--primary-foreground': '120 8% 10%',
    '--secondary': '120 8% 18%',
    '--secondary-foreground': '100 20% 90%',
    '--muted': '120 8% 18%',
    '--muted-foreground': '100 10% 60%',
    '--accent': '120 8% 18%',
    '--accent-foreground': '100 20% 90%',
    '--destructive': '0 60% 55%',
    '--destructive-foreground': '0 0% 98%',
    '--border': '120 8% 20%',
    '--input': '120 8% 20%',
    '--ring': '120 35% 60%',
  },
  'midnight-blue': {
    '--background': '215 35% 5%',
    '--foreground': '212 30% 92%',
    '--card': '215 30% 9%',
    '--card-foreground': '212 30% 92%',
    '--popover': '215 30% 9%',
    '--popover-foreground': '212 30% 92%',
    '--primary': '215 75% 62%',
    '--primary-foreground': '215 35% 5%',
    '--secondary': '215 25% 13%',
    '--secondary-foreground': '212 30% 92%',
    '--muted': '215 25% 13%',
    '--muted-foreground': '212 20% 55%',
    '--accent': '215 25% 13%',
    '--accent-foreground': '212 30% 92%',
    '--destructive': '0 65% 58%',
    '--destructive-foreground': '0 0% 98%',
    '--border': '215 25% 16%',
    '--input': '215 25% 16%',
    '--ring': '215 75% 62%',
  },
  'warm-paper': {
    /* Enhanced warm-paper - richer amber tones for vintage paper feel */
    '--background': '38 30% 94%',
    '--foreground': '32 25% 20%',
    '--card': '38 28% 98%',
    '--card-foreground': '32 25% 20%',
    '--popover': '38 28% 98%',
    '--popover-foreground': '32 25% 20%',
    '--primary': '28 55% 48%',
    '--primary-foreground': '38 30% 94%',
    '--secondary': '35 25% 90%',
    '--secondary-foreground': '32 25% 20%',
    '--muted': '35 22% 90%',
    '--muted-foreground': '32 15% 45%',
    '--accent': '35 25% 90%',
    '--accent-foreground': '32 25% 20%',
    '--destructive': '20 55% 50%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '35 18% 82%',
    '--input': '35 22% 88%',
    '--ring': '28 55% 48%',
  },
  'forest-green': {
    /* Deep forest green with natural moss undertones */
    '--background': '140 15% 7%',
    '--foreground': '120 15% 80%',
    '--card': '140 12% 11%',
    '--card-foreground': '120 15% 80%',
    '--popover': '140 12% 11%',
    '--popover-foreground': '120 15% 80%',
    '--primary': '140 35% 50%',
    '--primary-foreground': '140 15% 7%',
    '--secondary': '140 12% 16%',
    '--secondary-foreground': '120 15% 80%',
    '--muted': '140 12% 16%',
    '--muted-foreground': '120 10% 50%',
    '--accent': '140 12% 16%',
    '--accent-foreground': '120 15% 80%',
    '--destructive': '0 55% 55%',
    '--destructive-foreground': '0 0% 98%',
    '--border': '140 12% 18%',
    '--input': '140 10% 18%',
    '--ring': '140 35% 50%',
  },
}

function applyThemeColors(theme: Theme) {
  const root = document.documentElement
  const colors = themeColors[theme]
  if (!colors) return

  requestAnimationFrame(() => {
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme, toggleTheme, cycleTheme, followSystem, setFollowSystem, isDark, themeList } = useTheme()

  // Apply CSS variables when theme changes
  useEffect(() => {
    applyThemeColors(theme)
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

    // Add smooth transitions (disabled for reduced motion)
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

  const handleSetTheme = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
  }, [setTheme])

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme: handleSetTheme,
      toggleTheme,
      cycleTheme,
      followSystem,
      setFollowSystem,
      isDark,
      themeList,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider')
  }
  return context
}

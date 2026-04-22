import { createContext, useContext, ReactNode, useEffect, useCallback } from 'react'
import { useTheme } from '@/hooks/useTheme'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// CSS variable mappings for dual-theme system
const themeColors = {
  dark: {
    // Core backgrounds
    '--background': '0 0% 3.5%',
    '--foreground': '0 0% 98%',
    '--card': '0 0% 5%',
    '--card-foreground': '0 0% 98%',
    '--popover': '0 0% 5%',
    '--popover-foreground': '0 0% 98%',
    // Primary accent (紫辰)
    '--primary': '238 83% 66%',
    '--primary-foreground': '0 0% 98%',
    // Secondary
    '--secondary': '240 3.7% 15.9%',
    '--secondary-foreground': '0 0% 98%',
    '--muted': '240 3.7% 15.9%',
    '--muted-foreground': '240 5% 64.9%',
    '--accent': '240 3.7% 15.9%',
    '--accent-foreground': '0 0% 98%',
    // Semantic
    '--destructive': '0 84% 60%',
    '--destructive-foreground': '0 0% 98%',
    '--border': '240 3.7% 15.9%',
    '--input': '240 3.7% 15.9%',
    '--ring': '238 83% 66%',
    // Custom surfaces (墨韵色系)
    '--ink-black': '#0d0d12',
    '--charcoal': '#1a1a2e',
    '--paper-white': '#f5f0e6',
    '--smoke': '#3a3a4a',
    '--frost': '#e8e4dc',
    // UI surfaces
    '--ui-bg': '#08090a',
    '--ui-card': '#0f1011',
    '--ui-text': '#f7f8f8',
    '--ui-text-secondary': '#d0d6e0',
    '--ui-border': 'rgba(255, 255, 255, 0.08)',
    '--ui-toolbar': '#0f1011',
    '--ui-drawer': '#191a1b',
    // Writing surface
    '--writing-bg': '#1a1a2e',
    '--writing-text': '#f5f0e6',
    '--writing-muted': 'rgba(245, 240, 230, 0.6)',
  },
  light: {
    // Core backgrounds
    '--background': '45 30% 96%',
    '--foreground': '240 10% 10%',
    '--card': '0 0% 100%',
    '--card-foreground': '240 10% 10%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '240 10% 10%',
    // Primary accent (紫辰) - slightly adjusted for light
    '--primary': '238 83% 55%',
    '--primary-foreground': '0 0% 100%',
    // Secondary - warm paper tones
    '--secondary': '40 20% 93%',
    '--secondary-foreground': '240 10% 10%',
    '--muted': '40 15% 90%',
    '--muted-foreground': '240 5% 45%',
    '--accent': '40 20% 93%',
    '--accent-foreground': '240 10% 10%',
    // Semantic
    '--destructive': '0 72% 56%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '40 15% 85%',
    '--input': '40 15% 90%',
    '--ring': '238 83% 55%',
    // Custom surfaces (墨韵色系 - light)
    '--ink-black': '#1a1a2e',
    '--charcoal': '#3a3a4a',
    '--paper-white': '#f5f0e6',
    '--smoke': '#8a8a9a',
    '--frost': '#ffffff',
    // UI surfaces
    '--ui-bg': '#faf8f3',
    '--ui-card': '#ffffff',
    '--ui-text': '#1a1a2e',
    '--ui-text-secondary': '#666666',
    '--ui-border': '#e0dcd3',
    '--ui-toolbar': '#f5f0e6',
    '--ui-drawer': '#ffffff',
    // Writing surface - warm paper
    '--writing-bg': '#faf6e8',
    '--writing-text': '#1a1a2e',
    '--writing-muted': 'rgba(26, 26, 46, 0.5)',
  }
}

function applyThemeColors(theme: Theme) {
  const root = document.documentElement
  const colors = themeColors[theme]

  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme, toggleTheme } = useTheme()

  // Apply CSS variables when theme changes
  useEffect(() => {
    applyThemeColors(theme)
  }, [theme])

  const handleSetTheme = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
  }, [setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, toggleTheme }}>
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

/**
 * ThemeProvider - 主题提供者
 *
 * 集成6种主题与Ink/Parchment设计令牌系统
 * - dark, light, eye-care, midnight-blue, warm-paper, forest-green
 * - 每个主题完整映射所有CSS变量
 * - 提供视觉预览色板
 * - 平滑主题切换过渡
 */

import { createContext, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react'
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
  themeMeta: ThemeMeta[]
}

interface ThemeMeta {
  id: Theme
  label: string
  description: string
  isDark: boolean
  preview: {
    surface: string
    text: string
    accent: string
    border: string
  }
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * 完整主题元数据，包含视觉预览色板
 */
const themeMetaList: ThemeMeta[] = [
  {
    id: 'dark',
    label: '深墨',
    description: '经典深色，专注写作',
    isDark: true,
    preview: {
      surface: '#0d0d12',
      text: '#f5f0e6',
      accent: '#5e6ad2',
      border: 'rgba(255,255,255,0.10)',
    },
  },
  {
    id: 'light',
    label: '宣纸',
    description: '明亮浅色，清晰阅读',
    isDark: false,
    preview: {
      surface: '#f5f0e6',
      text: '#1a1a2e',
      accent: '#5e6ad2',
      border: 'rgba(0,0,0,0.10)',
    },
  },
  {
    id: 'eye-care',
    label: '护眼',
    description: '柔和绿色，减轻疲劳',
    isDark: true,
    preview: {
      surface: '#1a1f1a',
      text: '#d4e4cc',
      accent: '#6fa86c',
      border: 'rgba(255,255,255,0.06)',
    },
  },
  {
    id: 'midnight-blue',
    label: '午夜蓝',
    description: '深邃蓝色，沉浸创作',
    isDark: true,
    preview: {
      surface: '#080c14',
      text: '#e4ecf7',
      accent: '#5b98f8',
      border: 'rgba(96,165,250,0.12)',
    },
  },
  {
    id: 'warm-paper',
    label: '暖纸',
    description: '复古暖色，温润书写',
    isDark: false,
    preview: {
      surface: '#f7f2e8',
      text: '#3d3020',
      accent: '#b87040',
      border: 'rgba(61,48,32,0.08)',
    },
  },
  {
    id: 'forest-green',
    label: '森林',
    description: '自然深绿，静谧灵感',
    isDark: true,
    preview: {
      surface: '#0a120e',
      text: '#c8dcc8',
      accent: '#5aaf72',
      border: 'rgba(100,180,120,0.10)',
    },
  },
]

/**
 * 完整CSS变量映射 - 每个主题覆盖所有shadcn/ui设计令牌
 * 这些变量补充globals.css中的[data-theme]选择器
 * 用于shadcn/ui HSL变量和运行时动态调整
 */
const themeVariableMap: Record<Theme, Record<string, string>> = {
  dark: {
    '--background': '240 10% 3.5%',
    '--foreground': '0 0% 98%',
    '--card': '240 10% 5%',
    '--card-foreground': '0 0% 98%',
    '--popover': '240 10% 5%',
    '--popover-foreground': '0 0% 98%',
    '--primary': '238 83% 66%',
    '--primary-foreground': '0 0% 98%',
    '--secondary': '240 4% 16%',
    '--secondary-foreground': '0 0% 98%',
    '--muted': '240 4% 16%',
    '--muted-foreground': '240 5% 65%',
    '--accent': '240 4% 16%',
    '--accent-foreground': '0 0% 98%',
    '--destructive': '0 84% 60%',
    '--destructive-foreground': '0 0% 98%',
    '--border': '240 4% 16%',
    '--input': '240 4% 16%',
    '--ring': '238 83% 66%',
    '--radius': '0.5rem',
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
    '--radius': '0.5rem',
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
    '--radius': '0.5rem',
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
    '--radius': '0.5rem',
  },
  'warm-paper': {
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
    '--radius': '0.5rem',
  },
  'forest-green': {
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
    '--radius': '0.5rem',
  },
}

/**
 * 应用主题CSS变量到DOM
 */
function applyThemeVariables(theme: Theme) {
  const root = document.documentElement
  const variables = themeVariableMap[theme]
  if (!variables) return

  requestAnimationFrame(() => {
    Object.entries(variables).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  })
}

/**
 * 主题色板预览组件
 * 显示4个颜色小方块代表主题特征色
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
 * 主题选择器组件 - 带视觉预览
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
 * 小型主题选择器 - 用于工具栏等紧凑空间
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme, toggleTheme, cycleTheme, followSystem, setFollowSystem, isDark, themeList } = useTheme()

  // Apply CSS variables when theme changes
  useEffect(() => {
    applyThemeVariables(theme)
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

/**
 * ThemeData - Theme metadata and CSS variable mappings
 *
 * Contains theme preview palettes, labels, and full CSS variable maps
 * for each of the 6 supported themes.
 */

import type { Theme } from '@/hooks/useTheme'

export interface ThemeMeta {
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

/**
 * Full theme metadata with visual preview swatches
 */
export const themeMetaList: ThemeMeta[] = [
  {
    id: 'dark',
    label: '深墨',
    description: '经典深色，专注写作',
    isDark: true,
    preview: {
      surface: '#0d0d12',
      text: '#f5f0e6',
      accent: '#c9a96e',
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
      accent: '#c9a96e',
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
    id: 'deep-blue',
    label: '深夜蓝',
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
    id: 'sepia',
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
    id: 'forest',
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
 * Full CSS variable map — each theme overrides all shadcn/ui design tokens.
 * These supplement the [data-theme] selectors in design-tokens.css
 * for shadcn/ui HSL variables and runtime dynamic adjustment.
 */
export const themeVariableMap: Record<Theme, Record<string, string>> = {
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
  'deep-blue': {
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
  'sepia': {
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
  'forest': {
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

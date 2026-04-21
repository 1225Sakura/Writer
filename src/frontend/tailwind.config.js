/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Shadcn/ui theme colors (mapped to Linear design system)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        popover: 'hsl(var(--popover))',
        'popover-foreground': 'hsl(var(--popover-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        destructive: 'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // 主色调
        primary: {
          ink: '#1a1a2e',      // 深墨色 - 写作区背景
          paper: '#f5f0e6',    // 宣纸白 - 正文文字/卡片背景
          vermillion: '#c45c5c', // 朱砂红 - 强调/警告
        },
        // 功能色 - 实体类型编码
        entity: {
          character: '#e8b87d',  // 角色
          item: '#9b7ed9',       // 物品
          location: '#5eb5a6',   // 地点
          faction: '#d45d5d',     // 势力
          outline: '#5b8ee8',     // 大纲
          ifline: '#7eb84a',     // IF线
        },
        // 状态色
        status: {
          normal: '#5eb5a6',
          warning: '#e8b87d',
          error: '#c45c5c',
          success: '#6dd45e',
        },
        // 写作模式背景
        writing: {
          light: '#faf6e8',      // 浅色护眼
          dark: '#1a1a2e',       // 深色水墨
        },
        // 界面色
        ui: {
          light: {
            bg: '#ffffff',
            card: '#f5f0e6',
            text: '#1a1a2e',
            'text-secondary': '#666666',
            border: '#e0dcd3',
            toolbar: '#f5f0e6',
            drawer: '#ffffff',
          },
          dark: {
            bg: '#1a1a2e',
            card: '#252540',
            text: '#f5f0e6',
            'text-secondary': '#999999',
            border: '#3a3a5a',
            toolbar: '#252540',
            drawer: '#2a2a45',
          },
        },
        // CSS变量直接映射（Linear 设计系统）
        'var-bg': '#08090a',
        'var-card': '#0f1011',
        'var-text': '#f7f8f8',
        'var-text-secondary': '#d0d6e0',
        'var-border': 'rgba(255,255,255,0.08)',
        'var-toolbar': '#0f1011',
        'var-drawer': '#191a1b',
        'var-accent': '#5e6ad2',
        'var-outline': '#5e6ad2',
        'var-vermillion': '#c45c5c',
        'var-character': '#e8b87d',
        'var-item': '#9b7ed9',
        'var-location': '#5eb5a6',
        'var-faction': '#d45d5d',
        'var-ifline': '#7eb84a',
        'var-highlight': 'rgba(91,142,232,0.2)',
      },
      fontFamily: {
        serif: ['Source Han Serif', 'Noto Serif SC', 'Georgia', 'serif'],
        sans: ['Source Han Sans', 'Noto Sans SC', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'iA Writer Quattro', 'monospace'],
      },
      fontWeight: {
        510: '510',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        'card': '8px',
        'button': '6px',
        'input': '6px',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '400ms',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 4px rgba(94, 106, 210, 0.3)' },
          '50%': { boxShadow: '0 0 16px rgba(94, 106, 210, 0.6)' },
        },
        'breathe': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.02)', opacity: '0.85' },
        },
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-ink': 'linear-gradient(135deg, #1a1a2e 0%, #252540 50%, #1a1a2e 100%)',
        'gradient-paper': 'linear-gradient(180deg, #f5f0e6 0%, #ebe5d8 100%)',
        'gradient-accent': 'linear-gradient(135deg, #5e6ad2 0%, #7b87e0 100%)',
        'gradient-warm': 'linear-gradient(135deg, #c45c5c 0%, #e8b87d 100%)',
        'gradient-aurora': 'linear-gradient(135deg, #1a1a2e 0%, #252540 40%, #2a2a45 60%, #1a1a2e 100%)',
        'shimmer-line': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      boxShadow: {
        'card': '0 0 0 1px rgba(255,255,255,0.06)',
        'drawer': '0 0 0 1px rgba(255,255,255,0.06)',
        'float': '0 0 0 1px rgba(255,255,255,0.08)',
        'elevated': '0 4px 12px rgba(0, 0, 0, 0.25)',
        'elevated-lg': '0 8px 24px rgba(0, 0, 0, 0.35)',
        'glow-sm': '0 0 8px rgba(94, 106, 210, 0.25)',
        'glow': '0 0 16px rgba(94, 106, 210, 0.35)',
        'glow-lg': '0 0 32px rgba(94, 106, 210, 0.45)',
        'glow-vermillion': '0 0 12px rgba(196, 92, 92, 0.35)',
        'inner-glow': 'inset 0 0 12px rgba(94, 106, 210, 0.15)',
        'inner-glow-strong': 'inset 0 0 20px rgba(94, 106, 210, 0.25)',
      },
    },
  },
  plugins: [],
}

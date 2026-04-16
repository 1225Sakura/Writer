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
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.08)',
        'drawer': '0 4px 20px rgba(0,0,0,0.15)',
        'float': '0 8px 30px rgba(0,0,0,0.2)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '400ms',
      },
    },
  },
  plugins: [],
}

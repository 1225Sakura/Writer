/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin')

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        // === 核心色彩 (Core Colors) ===
        ink: {
          black: '#0d0d12',    // 写作区/沉浸模式背景
          DEFAULT: '#0d0d12',
        },
        charcoal: {
          DEFAULT: '#1a1a2e',  // 卡片/面板背景
          light: '#252540',    // 深色模式工具栏
          dark: '#151520',     // 深色模式侧边栏
        },
        paper: {
          white: '#f5f0e6',    // 正文文字/浅色模式背景
          frost: '#e8e4dc',    // 浅色模式卡片
          DEFAULT: '#f5f0e6',
        },
        smoke: {
          DEFAULT: '#3a3a4a',  // 次级界面/分隔线
          light: '#5a5a6a',
        },

        // === 强调色板 (Accent Palette) ===
        accent: {
          purple: '#5e6ad2',    // 主按钮/聚焦/AI相关
          amber: '#e8b87d',    // 角色类型/温暖提示
          jade: '#5eb5a6',     // 地点类型/成功状态
          vermillion: '#c45c5c', // 警告/重要标记/朱砂批注
          DEFAULT: '#5e6ad2',
        },

        // === 实体色板 (Entity Palette) - 保持现有 ===
        entity: {
          character: '#e8b87d',
          item: '#9b7ed9',
          location: '#5eb5a6',
          faction: '#d45d5d',
          outline: '#5b8ee8',
          ifline: '#7eb84a',
        },

        // === 语义色板 (Semantic Palette) ===
        status: {
          normal: '#5eb5a6',
          warning: '#e8b87d',
          error: '#c45c5c',
          success: '#6dd45e',
          info: '#5e6ad2',
        },

        // === CSS 变量兼容色 ===
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        popover: 'hsl(var(--popover))',
        'popover-foreground': 'hsl(var(--popover-foreground))',
        primary: {
          ink: '#1a1a2e',
          paper: '#f5f0e6',
          vermillion: '#c45c5c',
          DEFAULT: 'hsl(var(--primary))',
        },
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

        // === UI 深色/浅色系统 ===
        writing: {
          light: '#faf6e8',
          dark: '#1a1a2e',
        },
        ui: {
          light: {
            bg: '#faf8f3',
            card: '#ffffff',
            text: '#1a1a2e',
            'text-secondary': '#666666',
            border: '#e0dcd3',
            'border-strong': '#c0bbb0',
            toolbar: '#f5f0e6',
            drawer: '#ffffff',
            sidebar: '#ebe5d8',
            hover: '#f5f0e6',
            active: '#e8e4dc',
          },
          dark: {
            bg: '#0d0d12',
            card: '#1a1a2e',
            'card-hover': '#252540',
            text: '#f5f0e6',
            'text-secondary': '#999999',
            border: 'rgba(255,255,255,0.08)',
            'border-strong': 'rgba(255,255,255,0.15)',
            toolbar: '#252540',
            drawer: '#191a1b',
            sidebar: '#151520',
            hover: 'rgba(255,255,255,0.05)',
            active: 'rgba(94,106,210,0.15)',
          },
        },

        // === Var 系列 (直接使用的颜色) ===
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

        // === 交互状态色 ===
        'state-hover': 'var(--state-hover)',
        'state-active': 'var(--state-active)',
        'state-focus': 'var(--state-focus)',
        'state-disabled': 'var(--state-disabled)',
      },
  		fontFamily: {
  			serif: [
  				'Source Han Serif',
  				'Noto Serif SC',
  				'Georgia',
  				'serif'
  			],
  			sans: [
  				'Source Han Sans',
  				'Noto Sans SC',
  				'Inter',
  				'sans-serif'
  			],
  			mono: [
  				'JetBrains Mono',
  				'iA Writer Quattro',
  				'monospace'
  			]
  		},
  		fontWeight: {
  			'510': '510'
  		},
  		spacing: {
  			xs: '4px',
  			sm: '8px',
  			md: '16px',
  			lg: '24px',
  			xl: '32px',
  			'2xl': '48px',
  			'3xl': '64px'
  		},
  		borderRadius: {
  			card: '8px',
  			button: '6px',
  			input: '6px'
  		},
  		transitionDuration: {
  			fast: '150ms',
  			normal: '250ms',
  			slow: '400ms'
  		},
  		screens: {
  			'mobile': '480px',
  			'tablet': '768px',
  			'desktop': '1024px',
  			'desktop-xl': '1440px',
  		},
  		keyframes: {
  			'pulse-slow': {
  				'0%, 100%': {
  					opacity: '1'
  				},
  				'50%': {
  					opacity: '0.6'
  				}
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0px)'
  				},
  				'50%': {
  					transform: 'translateY(-6px)'
  				}
  			},
  			glow: {
  				'0%, 100%': {
  					boxShadow: '0 0 4px rgba(94, 106, 210, 0.3)'
  				},
  				'50%': {
  					boxShadow: '0 0 16px rgba(94, 106, 210, 0.6)'
  				}
  			},
  			breathe: {
  				'0%, 100%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				},
  				'50%': {
  					transform: 'scale(1.02)',
  					opacity: '0.85'
  				}
  			},
  			ripple: {
  				'0%': {
  					transform: 'translate(-50%, -50%) scale(0)',
  					opacity: '0.5'
  				},
  				'100%': {
  					transform: 'translate(-50%, -50%) scale(4)',
  					opacity: '0'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
  			shimmer: 'shimmer 2s linear infinite',
  			float: 'float 3s ease-in-out infinite',
  			glow: 'glow 2s ease-in-out infinite',
  			breathe: 'breathe 4s ease-in-out infinite',
  			ripple: 'ripple 0.6s ease-out forwards',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  			'gradient-ink': 'linear-gradient(135deg, #1a1a2e 0%, #252540 50%, #1a1a2e 100%)',
  			'gradient-ink-light': 'linear-gradient(135deg, #faf8f3 0%, #f5f0e6 50%, #faf8f3 100%)',
  			'gradient-paper': 'linear-gradient(180deg, #f5f0e6 0%, #ebe5d8 100%)',
  			'gradient-accent': 'linear-gradient(135deg, #5e6ad2 0%, #7b87e0 100%)',
  			'gradient-warm': 'linear-gradient(135deg, #c45c5c 0%, #e8b87d 100%)',
  			'gradient-aurora': 'linear-gradient(135deg, #1a1a2e 0%, #252540 40%, #2a2a45 60%, #1a1a2e 100%)',
  			'gradient-aurora-light': 'radial-gradient(ellipse at 30% 0%, rgba(94, 106, 210, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(126, 183, 74, 0.06) 0%, transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(196, 92, 92, 0.05) 0%, transparent 50%), linear-gradient(180deg, #0d0d12 0%, #1a1a2e 50%, #0d0d12 100%)',
  			'gradient-warm-light': 'radial-gradient(ellipse at 30% 70%, rgba(232, 184, 125, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(196, 92, 92, 0.06) 0%, transparent 50%), linear-gradient(180deg, #1a1a2e 0%, #252540 100%)',
  			'gradient-cool': 'radial-gradient(ellipse at 20% 30%, rgba(94, 181, 166, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(94, 106, 210, 0.08) 0%, transparent 50%), linear-gradient(180deg, #0d0d12 0%, #1a1a2e 100%)',
  			'shimmer-line': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)'
  		},
  		backdropBlur: {
  			xs: '2px'
  		},
  		boxShadow: {
  			card: '0 0 0 1px rgba(255,255,255,0.06)',
  			drawer: '0 0 0 1px rgba(255,255,255,0.06)',
  			float: '0 0 0 1px rgba(255,255,255,0.08)',
  			elevated: '0 4px 12px rgba(0, 0, 0, 0.25)',
  			'elevated-lg': '0 8px 24px rgba(0, 0, 0, 0.35)',
  			'glow-sm': '0 0 8px rgba(94, 106, 210, 0.25)',
  			glow: '0 0 16px rgba(94, 106, 210, 0.35)',
  			'glow-lg': '0 0 32px rgba(94, 106, 210, 0.45)',
  			'glow-vermillion': '0 0 12px rgba(196, 92, 92, 0.35)',
  			'inner-glow': 'inset 0 0 12px rgba(94, 106, 210, 0.15)',
  			'inner-glow-md': 'inset 0 0 20px rgba(94, 106, 210, 0.2)',
  			'inner-glow-strong': 'inset 0 0 24px rgba(94, 106, 210, 0.25)',
  			'inner-glow-vermillion': 'inset 0 0 16px rgba(196, 92, 92, 0.2)',
  			'inner-glow-amber': 'inset 0 0 16px rgba(232, 184, 125, 0.2)',
  			'glow-amber': '0 0 12px rgba(232, 184, 125, 0.35)',
  			'glow-jade': '0 0 12px rgba(94, 181, 166, 0.35)',
  			'glow-accent': '0 0 16px rgba(94, 106, 210, 0.4), 0 0 32px rgba(94, 106, 210, 0.2), 0 0 64px rgba(94, 106, 210, 0.1)'
  		}
  	}
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('motion-reduce', '@media (prefers-reduced-motion: reduce) { & }');
      addVariant('motion-safe', '@media (prefers-reduced-motion: no-preference) { & }');
    }),
  ],
}

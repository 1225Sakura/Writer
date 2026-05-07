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
        /* === Ink Scale (Backgrounds) === */
        ink: {
          100: 'var(--ink-100)',
          90:  'var(--ink-90)',
          80:  'var(--ink-80)',
          70:  'var(--ink-70)',
          60:  'var(--ink-60)',
          DEFAULT: 'var(--ink-100)',
        },

        /* === Paper Scale (Foregrounds) === */
        paper: {
          100: 'var(--paper-100)',
          90:  'var(--paper-90)',
          80:  'var(--paper-80)',
          70:  'var(--paper-70)',
          60:  'var(--paper-60)',
          DEFAULT: 'var(--paper-100)',
        },

        /* === Accent Scale (Brand / Interactive) === */
        accent: {
          100: 'var(--accent-100)',
          90:  'var(--accent-90)',
          80:  'var(--accent-80)',
          muted: 'var(--accent-muted)',
          DEFAULT: 'var(--accent-100)',
        },

        /* === Vermillion Scale (Warning / Error) === */
        vermillion: {
          100: 'var(--vermillion-100)',
          90:  'var(--vermillion-90)',
          muted: 'var(--vermillion-muted)',
          DEFAULT: 'var(--vermillion-100)',
        },

        /* === Entity Colors === */
        entity: {
          character: 'var(--color-character)',
          item:      'var(--color-item)',
          location:  'var(--color-location)',
          faction:   'var(--color-faction)',
          outline:   'var(--color-outline)',
          ifline:    'var(--color-ifline)',
        },

        /* === Semantic Colors === */
        status: {
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          error:   'var(--color-danger)',
          info:    'var(--color-info)',
        },

        /* === Surface Colors (Theme-aware) === */
        surface: {
          base:     'var(--color-surface-base)',
          raised:   'var(--color-surface-raised)',
          overlay:  'var(--color-surface-overlay)',
          input:    'var(--color-surface-input)',
          hover:    'var(--color-surface-hover)',
          pressed:  'var(--color-surface-pressed)',
          elevated: 'var(--color-surface-elevated)',
          floating: 'var(--color-surface-floating)',
        },

        /* === Glass Colors === */
        glass: {
          DEFAULT:  'var(--glass-bg)',
          subtle:   'var(--glass-bg-subtle)',
          medium:   'var(--glass-bg-medium)',
          strong:   'var(--glass-bg-strong)',
          border:   'var(--glass-border)',
        },

        /* === Writing Colors === */
        writing: {
          bg:        'var(--writing-bg)',
          text:      'var(--writing-text)',
          muted:     'var(--writing-muted)',
          selection: 'var(--writing-selection)',
        },

        /* === Gradient Presets === */
        gradient: {
          dawn: 'linear-gradient(135deg, var(--paper-95) 0%, var(--paper-100) 40%, var(--paper-85) 100%)',
          dusk: 'linear-gradient(135deg, var(--ink-85) 0%, var(--ink-90) 50%, var(--ink-95) 100%)',
          aurora: 'linear-gradient(135deg, var(--ink-90) 0%, #2d2d4a 30%, #1f3a3a 60%, var(--ink-90) 100%)',
          ocean: 'linear-gradient(135deg, var(--ink-90) 0%, #1a2a3a 50%, var(--ink-90) 100%)',
          sunset: 'linear-gradient(135deg, #2a1a1a 0%, #3a2a2a 40%, #2a1a1a 100%)',
          mist: 'linear-gradient(180deg, var(--paper-100) 0%, var(--paper-95) 50%, var(--paper-100) 100%)',
          inkwash: 'linear-gradient(180deg, var(--ink-100) 0%, var(--ink-90) 100%)',
        },

        /* === Entity Gradient Colors === */
        entityGradient: {
          character: 'linear-gradient(135deg, var(--color-character) 0%, color-mix(in srgb, var(--color-character) 70%, var(--vermillion-100)) 100%)',
          item: 'linear-gradient(135deg, var(--color-item) 0%, color-mix(in srgb, var(--color-item) 70%, var(--accent-100)) 100%)',
          location: 'linear-gradient(135deg, var(--color-location) 0%, color-mix(in srgb, var(--color-location) 70%, var(--color-outline)) 100%)',
          faction: 'linear-gradient(135deg, var(--color-faction) 0%, color-mix(in srgb, var(--color-faction) 70%, var(--vermillion-100)) 100%)',
          outline: 'linear-gradient(135deg, var(--color-outline) 0%, color-mix(in srgb, var(--color-outline) 70%, var(--accent-100)) 100%)',
          ifline: 'linear-gradient(135deg, var(--color-ifline) 0%, color-mix(in srgb, var(--color-ifline) 70%, var(--color-location)) 100%)',
        },

        /* === shadcn/ui CSS Variable Bridge === */
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },

      fontFamily: {
        serif: [
          'Noto Serif SC',
          'Source Han Serif CN',
          'Source Han Serif',
          'Georgia',
          'serif'
        ],
        sans: [
          'Source Han Sans',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Noto Sans SC',
          'Source Han Sans CN',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Cascadia Code',
          'monospace'
        ],
        /* Writing-specific fonts */
        writing: [
          'Noto Serif SC',
          'Source Han Serif CN',
          'Source Han Serif',
          'STKaiti',
          'KaiTi',
          'SimKai',
          'serif'
        ],
        ui: [
          'Inter',
          'Noto Sans SC',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif'
        ],
        code: [
          'JetBrains Mono',
          'Fira Code',
          'Cascadia Code',
          'Source Code Pro',
          'monospace'
        ]
      },

      fontWeight: {
        '510': '510'
      },

      fontSize: {
        'xs': ['12px', { lineHeight: '1.4' }],
        'sm': ['14px', { lineHeight: '1.5' }],
        'base': ['16px', { lineHeight: '1.75' }],
        'lg': ['18px', { lineHeight: '1.875' }],
        'xl': ['20px', { lineHeight: '2' }],
        '2xl': ['24px', { lineHeight: '2.2' }],
        '3xl': ['30px', { lineHeight: '2.4' }],
        '4xl': ['36px', { lineHeight: '2.5' }],
        '5xl': ['48px', { lineHeight: '2.6' }],
        /* Writing-specific sizes */
        'writing-sm': ['16px', { lineHeight: '2', letterSpacing: '0.01em' }],
        'writing-base': ['18px', { lineHeight: '2.2', letterSpacing: '0.02em' }],
        'writing-lg': ['20px', { lineHeight: '2.4', letterSpacing: '0.02em' }],
        'writing-xl': ['24px', { lineHeight: '2.6', letterSpacing: '0.03em' }],
      },

      spacing: {
        '0': '0px',
        'px': '1px',
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px',
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },

      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        'full': '9999px',
      },

      borderWidth: {
        '0.5': '0.5px',
        '1': '1px',
        '1.5': '1.5px',
        '2': '2px',
        '3': '3px',
      },

      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '400ms',
        instant: '50ms',
        base: '180ms',
        spring: '400ms',
      },

      transitionTimingFunction: {
        'out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'snappy': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },

      transitionProperty: {
        'colors-shadow': 'color, background-color, border-color, box-shadow',
        'transform-opacity': 'transform, opacity',
        'all-filter': 'all, filter',
      },

      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        'mobile': '480px',
        'tablet': '768px',
        'desktop': '1024px',
        'desktop-xl': '1440px',
      },

      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'float-gentle': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-4px) rotate(0.5deg)' },
          '75%': { transform: 'translateY(2px) rotate(-0.5deg)' }
        },
        'glow-breathe': {
          '0%, 100%': {
            boxShadow: '0 0 4px var(--glow-primary-sm), 0 0 8px var(--glow-primary-sm)',
            opacity: '1'
          },
          '50%': {
            boxShadow: '0 0 12px var(--glow-primary), 0 0 24px var(--glow-primary)',
            opacity: '0.95'
          }
        },
        'page-load': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '60%': { opacity: '1', transform: 'translateY(-2px) scale(1.01)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'scale-bounce': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '40%': { transform: 'scale(1.15)', opacity: '1' },
          '60%': { transform: 'scale(0.92)' },
          '80%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'slide-in-bottom': {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'fade-scale-in': {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
      },

      animation: {
        shimmer: 'shimmer 2s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'float-gentle': 'float-gentle 4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'glow-breathe': 'glow-breathe 3s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'page-load': 'page-load 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-bounce': 'scale-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-in-bottom': 'slide-in-bottom 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-scale-in': 'fade-scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-ink': 'linear-gradient(135deg, var(--ink-90) 0%, var(--ink-80) 50%, var(--ink-90) 100%)',
        'gradient-paper': 'linear-gradient(180deg, var(--paper-100) 0%, #ebe5d8 100%)',
      },

      backdropBlur: {
        xs: '2px'
      },

      aspectRatio: {
        '1/1': '1 / 1',
        '3/4': '3 / 4',
        '4/3': '4 / 3',
        '16/9': '16 / 9',
        '21/9': '21 / 9',
        'portrait': '3 / 4',
        'landscape': '4 / 3',
        'widescreen': '16 / 9',
      },

      boxShadow: {
        'xs': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'sm': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px rgba(0, 0, 0, 0.15)',
        '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
        'inner': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
        'none': 'none',
        card: '0 0 0 1px var(--glass-border)',
        drawer: '0 0 0 1px var(--glass-border)',
        float: '0 0 0 1px var(--border-default)',
        elevated: '0 4px 12px rgba(0, 0, 0, 0.25)',
        'elevated-lg': '0 8px 24px rgba(0, 0, 0, 0.35)',
        'glow-sm': '0 0 8px var(--glow-primary-sm)',
        'glow-subtle': '0 0 12px var(--glow-primary-sm)',
        glow: '0 0 16px var(--glow-primary)',
        'glow-lg': '0 0 32px var(--glow-primary)',
        'glow-strong': '0 0 48px var(--glow-primary)',
        'glow-vermillion-subtle': '0 0 8px var(--vermillion-muted)',
        'glow-vermillion': '0 0 16px var(--vermillion-muted)',
        'glow-amber': '0 0 12px color-mix(in srgb, var(--color-character) 35%, transparent)',
        'glow-jade': '0 0 12px color-mix(in srgb, var(--color-location) 35%, transparent)',
        'shadow-character': '0 4px 16px color-mix(in srgb, var(--color-character) 25%, transparent)',
        'shadow-item': '0 4px 16px color-mix(in srgb, var(--color-item) 25%, transparent)',
        'shadow-location': '0 4px 16px color-mix(in srgb, var(--color-location) 25%, transparent)',
        'shadow-faction': '0 4px 16px color-mix(in srgb, var(--color-faction) 25%, transparent)',
        'shadow-outline': '0 4px 16px color-mix(in srgb, var(--color-outline) 25%, transparent)',
        'shadow-ifline': '0 4px 16px color-mix(in srgb, var(--color-ifline) 25%, transparent)',
      },

      opacity: {
        '0': '0',
        '5': '0.05',
        '10': '0.1',
        '15': '0.15',
        '20': '0.2',
        '25': '0.25',
        '30': '0.3',
        '35': '0.35',
        '40': '0.4',
        '45': '0.45',
        '50': '0.5',
        '55': '0.55',
        '60': '0.6',
        '65': '0.65',
        '70': '0.7',
        '75': '0.75',
        '80': '0.8',
        '85': '0.85',
        '90': '0.9',
        '95': '0.95',
        '100': '1',
      },

      lineClamp: {
        1: '1',
        2: '2',
        3: '3',
        4: '4',
        5: '5',
        6: '6',
      },
    }
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('motion-reduce', '@media (prefers-reduced-motion: reduce) { & }');
      addVariant('motion-safe', '@media (prefers-reduced-motion: no-preference) { & }');
    }),
    plugin(({ addUtilities }) => {
      addUtilities({
        '.text-balance': {
          'text-wrap': 'balance',
        },
        '.text-pretty': {
          'text-wrap': 'pretty',
        },
        '.line-clamp-1': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '1',
        },
        '.line-clamp-2': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '2',
        },
        '.line-clamp-3': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '3',
        },
        '.line-clamp-4': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '4',
        },
        '.line-clamp-5': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '5',
        },
        '.line-clamp-6': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '6',
        },
        '.font-feature-normal': {
          'font-feature-settings': '"cv01", "ss03"',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.touch-manipulation': {
          'touch-action': 'manipulation',
        },
        '.gpu-accelerate': {
          'transform': 'translateZ(0)',
          'will-change': 'transform',
        },
        '.transition-transform-opacity': {
          'transition-property': 'transform, opacity',
          'transition-timing-function': 'cubic-bezier(0.16, 1, 0.3, 1)',
          'transition-duration': '200ms',
        },
        '.animate-in': {
          'animation-fill-mode': 'forwards',
          'opacity': '0',
        },
        '.animate-out': {
          'animation-fill-mode': 'forwards',
        },
        '.will-change-transform': {
          'will-change': 'transform',
        },
        '.will-change-opacity': {
          'will-change': 'opacity',
        },
        '.will-change-transform-opacity': {
          'will-change': 'transform, opacity',
        },
        '.backface-hidden': {
          'backface-visibility': 'hidden',
        },
        '.preserve-3d': {
          'transform-style': 'preserve-3d',
        },
        '.touch-target-min': {
          'min-height': '44px',
          'min-width': '44px',
        },
        '.touch-target-button': {
          'min-height': '44px',
          'min-width': '44px',
        },
        '.vignette-overlay': {
          'position': 'relative',
        },
        '.vignette-overlay::after': {
          content: "''",
          'position': 'absolute',
          'inset': '0',
          'pointer-events': 'none',
          'background': 'radial-gradient(ellipse at center, transparent 50%, color-mix(in srgb, var(--ink-100) 35%, transparent) 100%)',
          'z-index': '1',
        },
        '.typewriter-mode': {
          '--layout-sidebar-width': '0px',
          '--layout-topbar-height': '0px',
          '--layout-rightpanel-width': '0px',
        },
        '.focus-dim': {
          'transition': 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        },
        '.ambient-glow': {
          'position': 'relative',
        },
        '.ambient-glow::before': {
          content: "''",
          'position': 'absolute',
          'inset': '-20px',
          'background': 'radial-gradient(ellipse at center, var(--glow-primary) 0%, transparent 70%)',
          'opacity': '0.4',
          'pointer-events': 'none',
          'animation': 'ambient-glow-pulse 6s ease-in-out infinite',
          'z-index': '-1',
        },
        '.textured-paper': {
          'position': 'relative',
          'background-color': 'var(--writing-bg)',
        },
        '.textured-paper::before': {
          content: "''",
          'position': 'absolute',
          'inset': '0',
          'background-image': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
          'opacity': 'var(--paper-texture-opacity, 0.04)',
          'pointer-events': 'none',
          'mix-blend-mode': 'overlay',
        },
      });
    }),
  ],
}

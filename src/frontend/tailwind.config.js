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

        /* === shadcn/ui CSS Variable Bridge === */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
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
        ]
      },

      fontWeight: {
        '510': '510'
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
        slow: '400ms'
      },

      transitionTimingFunction: {
        'out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'snappy': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },

      screens: {
        'mobile': '480px',
        'tablet': '768px',
        'desktop': '1024px',
        'desktop-xl': '1440px',
      },

      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'shimmer-subtle': {
          '0%': { backgroundPosition: '-100% 0' },
          '100%': { backgroundPosition: '100% 0' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' }
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 4px rgba(94, 106, 210, 0.3)' },
          '50%': { boxShadow: '0 0 16px rgba(94, 106, 210, 0.6)' }
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' }
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.02)', opacity: '0.85' }
        },
        ripple: {
          '0%': { transform: 'translate(-50%, -50%) scale(0)', opacity: '0.5' },
          '100%': { transform: 'translate(-50%, -50%) scale(4)', opacity: '0' }
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },

      animation: {
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'shimmer-subtle': 'shimmer-subtle 1.5s linear infinite',
        /* REMOVED per SPEC 8.2: float, glow-pulse, breathe - use static glow instead */
        glow: 'glow 2s ease-in-out infinite',
        ripple: 'ripple 0.4s ease-out forwards',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-ink': 'linear-gradient(135deg, var(--ink-90) 0%, var(--ink-80) 50%, var(--ink-90) 100%)',
        'gradient-ink-light': 'linear-gradient(135deg, #faf8f3 0%, var(--paper-100) 50%, #faf8f3 100%)',
        'gradient-paper': 'linear-gradient(180deg, var(--paper-100) 0%, #ebe5d8 100%)',
        'gradient-accent': 'linear-gradient(135deg, var(--accent-100) 0%, #7b87e0 100%)',
        'gradient-warm': 'linear-gradient(135deg, var(--vermillion-100) 0%, var(--color-warning) 100%)',
        'gradient-aurora': 'linear-gradient(135deg, var(--ink-100) 0%, var(--ink-90) 40%, #2a2a45 60%, var(--ink-100) 100%)',
        'shimmer-line': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)'
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
        card: '0 0 0 1px rgba(255,255,255,0.06)',
        drawer: '0 0 0 1px rgba(255,255,255,0.06)',
        float: '0 0 0 1px rgba(255,255,255,0.08)',
        elevated: '0 4px 12px rgba(0, 0, 0, 0.25)',
        'elevated-lg': '0 8px 24px rgba(0, 0, 0, 0.35)',
        'glow-sm': '0 0 8px rgba(94, 106, 210, 0.2)',
        'glow-subtle': '0 0 12px rgba(94, 106, 210, 0.25)',
        'glow': '0 0 16px rgba(94, 106, 210, 0.35)',
        'glow-lg': '0 0 32px rgba(94, 106, 210, 0.45)',
        'glow-strong': '0 0 48px rgba(94, 106, 210, 0.55)',
        'glow-vermillion-subtle': '0 0 8px rgba(196, 92, 92, 0.25)',
        'glow-vermillion': '0 0 16px rgba(196, 92, 92, 0.35)',
        'glow-amber': '0 0 12px rgba(232, 184, 125, 0.35)',
        'glow-jade': '0 0 12px rgba(94, 181, 166, 0.35)',
        'glow-accent': '0 0 18px rgba(94, 106, 210, 0.4), 0 0 36px rgba(94, 106, 210, 0.2), 0 0 72px rgba(94, 106, 210, 0.1)',
        'glow-primary': '0 0 12px var(--glow-primary-sm), 0 0 24px var(--glow-primary)',
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
        '.font-feature-tnum': {
          'font-feature-settings': '"tnum", "cv01"',
        },
        '.font-feature-zero': {
          'font-feature-settings': '"zero", "cv01"',
        },
        '.font-feature-ss01': {
          'font-feature-settings': '"ss01"',
        },
        '.font-feature-ss02': {
          'font-feature-settings': '"ss02"',
        },
        '.font-feature-ss03': {
          'font-feature-settings': '"ss03"',
        },
        '.font-feature-palt': {
          'font-feature-settings': '"palt"',
        },
        '.font-feature-pwid': {
          'font-feature-settings': '"pwid"',
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
      });
    }),
  ],
}

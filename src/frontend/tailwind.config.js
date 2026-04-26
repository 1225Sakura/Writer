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
          dawn: 'linear-gradient(135deg, #faf8f3 0%, #f5f0e6 40%, #e8dfd0 100%)',
          dusk: 'linear-gradient(135deg, #2a2a45 0%, #1a1a2e 50%, #12121f 100%)',
          aurora: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d4a 30%, #1f3a3a 60%, #1a1a2e 100%)',
          ocean: 'linear-gradient(135deg, #1a1a2e 0%, #1a2a3a 50%, #1a1a2e 100%)',
          sunset: 'linear-gradient(135deg, #2a1a1a 0%, #3a2a2a 40%, #2a1a1a 100%)',
          mist: 'linear-gradient(180deg, #f5f0e6 0%, #ebe5d8 50%, #f5f0e6 100%)',
          inkwash: 'linear-gradient(180deg, var(--ink-100) 0%, var(--ink-90) 100%)',
        },

        /* === Entity Gradient Colors === */
        entityGradient: {
          character: 'linear-gradient(135deg, var(--color-character) 0%, #d4956a 100%)',
          item: 'linear-gradient(135deg, var(--color-item) 0%, #7b5ec0 100%)',
          location: 'linear-gradient(135deg, var(--color-location) 0%, #4ea096 100%)',
          faction: 'linear-gradient(135deg, var(--color-faction) 0%, #c04545 100%)',
          outline: 'linear-gradient(135deg, var(--color-outline) 0%, #4a7ed9 100%)',
          ifline: 'linear-gradient(135deg, var(--color-ifline) 0%, #6ba84a 100%)',
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
        'float-gentle': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-4px) rotate(0.5deg)' },
          '75%': { transform: 'translateY(2px) rotate(-0.5deg)' }
        },
        'glow-breathe': {
          '0%, 100%': {
            boxShadow: '0 0 4px rgba(94, 106, 210, 0.2), 0 0 8px rgba(94, 106, 210, 0.1)',
            opacity: '1'
          },
          '50%': {
            boxShadow: '0 0 12px rgba(94, 106, 210, 0.4), 0 0 24px rgba(94, 106, 210, 0.2)',
            opacity: '0.95'
          }
        },
        'shimmer-sweep': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'text-reveal': {
          '0%': { clipPath: 'inset(0 100% 0 0)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { clipPath: 'inset(0 0% 0 0)', opacity: '1' }
        },
        'progress-fill': {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '100%': { transform: 'scaleX(1)', transformOrigin: 'left' }
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 4px rgba(94, 106, 210, 0.3)' },
          '50%': { boxShadow: '0 0 16px rgba(94, 106, 210, 0.6)' }
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
        },
        /* New keyframes for enhanced animation system */
        'page-load': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '60%': { opacity: '1', transform: 'translateY(-2px) scale(1.01)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'button-ripple': {
          '0%': { transform: 'translate(-50%, -50%) scale(0)', opacity: '0.45' },
          '50%': { opacity: '0.2' },
          '100%': { transform: 'translate(-50%, -50%) scale(2.5)', opacity: '0' }
        },
        'card-flip': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' }
        },
        'text-shimmer': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' }
        },
        'float-particle': {
          '0%, 100%': { transform: 'translateY(0) translateX(0) rotate(0deg)', opacity: 'var(--particle-opacity, 0.04)' },
          '25%': { transform: 'translateY(-30px) translateX(15px) rotate(90deg)', opacity: 'calc(var(--particle-opacity, 0.04) * 1.5)' },
          '50%': { transform: 'translateY(-15px) translateX(-10px) rotate(180deg)', opacity: 'var(--particle-opacity, 0.04)' },
          '75%': { transform: 'translateY(-40px) translateX(5px) rotate(270deg)', opacity: 'calc(var(--particle-opacity, 0.04) * 0.7)' }
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
        /* Additional keyframes for extended animations */
        'slide-in-left': {
          '0%': { transform: 'translateX(-24px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(24px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        'slide-up': {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'blur-in': {
          '0%': { filter: 'blur(8px)', opacity: '0' },
          '100%': { filter: 'blur(0)', opacity: '1' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'pop-in': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '70%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' }
        }
      },

      animation: {
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        shimmer: 'shimmer 2s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'shimmer-subtle': 'shimmer-subtle 1.5s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'float-gentle': 'float-gentle 4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'glow-breathe': 'glow-breathe 3s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'shimmer-sweep': 'shimmer-sweep 2.5s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'text-reveal': 'text-reveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'progress-fill': 'progress-fill 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        glow: 'glow 2s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        ripple: 'ripple 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'accordion-down': 'accordion-down 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        'accordion-up': 'accordion-up 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        /* New animation utilities */
        'page-load': 'page-load 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'button-ripple': 'button-ripple 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'card-flip': 'card-flip 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'text-shimmer': 'text-shimmer 3s linear infinite',
        'float-particle': 'float-particle var(--particle-duration, 12s) ease-in-out infinite',
        'scale-bounce': 'scale-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-in-bottom': 'slide-in-bottom 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-scale-in': 'fade-scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        /* New animation presets */
        'slide-in-left': 'slide-in-bottom 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slide-in-bottom 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slide-in-bottom 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'bounce-in': 'scale-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'spin-slow': 'spin 4s linear infinite',
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
        /* New shadow levels */
        'shadow-xs': 'var(--shadow-xs)',
        'shadow-sm-token': 'var(--shadow-sm)',
        'shadow-md-token': 'var(--shadow-md)',
        'shadow-lg-token': 'var(--shadow-lg)',
        'shadow-xl-token': 'var(--shadow-xl)',
        'shadow-2xl-token': 'var(--shadow-2xl)',
        'inner-soft': 'var(--shadow-inner-soft)',
        'inner-md': 'var(--shadow-inner-md)',
        /* Elevation system (shadow-based, not color-based) */
        'elevation-1': 'var(--shadow-elevation-1)',
        'elevation-2': 'var(--shadow-elevation-2)',
        'elevation-3': 'var(--shadow-elevation-3)',
        'elevation-4': 'var(--shadow-elevation-4)',
        'elevation-5': 'var(--shadow-elevation-5)',
        /* Glass shadow */
        'glass': '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        /* Extended shadow scale */
        '3xl': '0 30px 60px rgba(0, 0, 0, 0.3)',
        '4xl': '0 40px 80px rgba(0, 0, 0, 0.35)',
        '5xl': '0 50px 100px rgba(0, 0, 0, 0.4)',
        /* Soft shadow system */
        'soft-xs': '0 1px 2px rgba(0, 0, 0, 0.04)',
        'soft-sm': '0 2px 4px rgba(0, 0, 0, 0.06)',
        'soft-md': '0 4px 8px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 8px 16px rgba(0, 0, 0, 0.1)',
        'soft-xl': '0 16px 32px rgba(0, 0, 0, 0.12)',
        /* Hard shadow system */
        'hard-xs': '2px 2px 0 rgba(0, 0, 0, 0.1)',
        'hard-sm': '3px 3px 0 rgba(0, 0, 0, 0.1)',
        'hard-md': '4px 4px 0 rgba(0, 0, 0, 0.12)',
        'hard-lg': '6px 6px 0 rgba(0, 0, 0, 0.14)',
        'hard-xl': '8px 8px 0 rgba(0, 0, 0, 0.16)',
        /* Colored shadows */
        'shadow-character': '0 4px 16px rgba(232, 184, 125, 0.25)',
        'shadow-item': '0 4px 16px rgba(155, 126, 217, 0.25)',
        'shadow-location': '0 4px 16px rgba(94, 181, 166, 0.25)',
        'shadow-faction': '0 4px 16px rgba(212, 93, 93, 0.25)',
        'shadow-outline': '0 4px 16px rgba(91, 142, 232, 0.25)',
        'shadow-ifline': '0 4px 16px rgba(126, 184, 74, 0.25)',
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
        /* Animation transition utilities */
        '.transition-transform-opacity': {
          'transition-property': 'transform, opacity',
          'transition-timing-function': 'cubic-bezier(0.16, 1, 0.3, 1)',
          'transition-duration': '200ms',
        },
        '.transition-scale': {
          'transition-property': 'transform',
          'transition-timing-function': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          'transition-duration': '200ms',
        },
        '.transition-opacity-fast': {
          'transition-property': 'opacity',
          'transition-timing-function': 'ease-out',
          'transition-duration': '150ms',
        },
        '.animate-in': {
          'animation-fill-mode': 'forwards',
          'opacity': '0',
        },
        '.animate-out': {
          'animation-fill-mode': 'forwards',
        },
        /* Will-change utilities (use sparingly for performance) */
        '.will-change-transform': {
          'will-change': 'transform',
        },
        '.will-change-opacity': {
          'will-change': 'opacity',
        },
        '.will-change-transform-opacity': {
          'will-change': 'transform, opacity',
        },
        /* Backface visibility for 3D transforms */
        '.backface-hidden': {
          'backface-visibility': 'hidden',
        },
        '.preserve-3d': {
          'transform-style': 'preserve-3d',
        },
        /* Motion-safe / motion-reduce utilities */
        '.motion-safe\\:animate-none': {
          '@media (prefers-reduced-motion: reduce)': {
            'animation': 'none !important',
          },
        },
        '.motion-safe\\:transition-none': {
          '@media (prefers-reduced-motion: reduce)': {
            'transition': 'none !important',
          },
        },
        /* Mobile touch target utilities */
        '.touch-target-min': {
          'min-height': '44px',
          'min-width': '44px',
        },
        '.touch-target-button': {
          'min-height': '44px',
          'min-width': '44px',
        },
        '.safe-area-inset-bottom': {
          'padding-bottom': 'env(safe-area-inset-bottom, 0px)',
        },
        '.safe-area-inset-top': {
          'padding-top': 'env(safe-area-inset-top, 0px)',
        },
        /* Mobile scrollbar hide */
        '.mobile-scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        /* Mobile text utilities */
        '.text-mobile-sm': {
          'font-size': '12px',
          'line-height': '1.4',
        },
        '.text-mobile-base': {
          'font-size': '14px',
          'line-height': '1.5',
        },
        /* Writing app utility classes */
        '.vignette-overlay': {
          'position': 'relative',
        },
        '.vignette-overlay::after': {
          content: "''",
          'position': 'absolute',
          'inset': '0',
          'pointer-events': 'none',
          'background': 'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.35) 100%)',
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
        '.text-balance': {
          'text-wrap': 'balance',
        },
        '.text-pretty': {
          'text-wrap': 'pretty',
        },
      });
    }),
  ],
}

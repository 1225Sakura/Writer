import { useState, useRef, useEffect } from 'react'
import { Icon } from '@/components/ui/Icon'
import {
  Sun, Moon, Eye, Palette, Coffee, TreePine,
  Wifi, WifiOff, Check, ChevronDown,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useThemeContext } from '@/components/shared/ThemeProvider'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import type { Theme } from '@/hooks/useTheme'
import type { WebSocketStatus } from '@/api/websocket'

/* ============================================================
   THEME METADATA
   ============================================================ */

export const themeMeta: Record<Theme, { label: string; icon: React.ReactNode; color: string }> = {
  dark:            { label: '深色',   icon: <Icon icon={Moon} size="xs" />,     color: 'var(--accent-primary)' },
  light:           { label: '浅色',   icon: <Icon icon={Sun} size="xs" />,      color: 'var(--color-warning)' },
  'eye-care':      { label: '护眼',   icon: <Icon icon={Eye} size="xs" />,      color: 'var(--color-success)' },
  'deep-blue': { label: '深夜蓝', icon: <Icon icon={Palette} size="xs" />,  color: 'var(--accent-100)' },
  'sepia':     { label: '暖纸',   icon: <Icon icon={Coffee} size="xs" />,   color: 'var(--accent-90)' },
  'forest':    { label: '森林',   icon: <Icon icon={TreePine} size="xs" />, color: 'var(--accent-100)' },
}

/* ============================================================
   THEME SELECTOR DROPDOWN
   ============================================================ */

export function ThemeSelector() {
  const { theme, setTheme, followSystem, setFollowSystem } = useThemeContext()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentMeta = themeMeta[theme]

  return (
    <div ref={containerRef} className="relative">
      <motion.button
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl relative overflow-hidden
                   bg-surface-raised border border-default text-secondary touch-target-min
                   transition-all duration-200 ease-out"
        style={{
          boxShadow: `
            0 2px 8px color-mix(in srgb, var(--ink-100) 8%, transparent),
            inset 0 1px 0 color-mix(in srgb, white 5%, transparent)
          `,
        }}
        title="切换主题"
        aria-label="切换主题"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        whileHover={{
          scale: 1.03,
          borderColor: 'var(--border-strong)',
        }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        <span className="relative z-10" style={{ color: currentMeta.color }}>{currentMeta.icon}</span>
        <span className="text-xs hidden sm:inline relative z-10">{currentMeta.label}</span>
        <motion.span
          className="relative z-10"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: DURATION.FAST, ease: EASE.OUT }}
        >
          <Icon icon={ChevronDown} size="xs" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full mt-2 z-50 p-2 rounded-2xl min-w-[180px]"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
              boxShadow: `
                0 12px 40px color-mix(in srgb, var(--ink-100) 25%, transparent),
                0 4px 16px color-mix(in srgb, var(--ink-100) 12%, transparent)
              `,
            }}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            layout
          >
            <div className="text-[10px] px-2 py-1 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              选择主题
            </div>
            <div className="flex flex-col gap-0.5 mt-0.5">
              {(Object.keys(themeMeta) as Theme[]).map((t) => {
                const meta = themeMeta[t]
                const isActive = theme === t
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setTheme(t)
                      setOpen(false)
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150
                      ${isActive ? 'bg-[var(--accent-muted)]' : 'hover:bg-[var(--hover-bg)]'}
                    `}
                    style={{ color: isActive ? meta.color : 'var(--text-secondary)' }}
                  >
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span className="flex-1 text-left">{meta.label}</span>
                    {isActive && <Icon icon={Check} size="xs" style={{ color: meta.color }} />}
                  </button>
                )
              })}
            </div>
            <div className="mt-1 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={() => {
                  setFollowSystem(!followSystem)
                  setOpen(false)
                }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 w-full
                  ${followSystem ? 'bg-[var(--accent-muted)]' : 'hover:bg-[var(--hover-bg)]'}
                `}
                style={{ color: followSystem ? 'var(--accent-100)' : 'var(--text-tertiary)' }}
              >
                <span className="flex-1 text-left">跟随系统</span>
                {followSystem && <Icon icon={Check} size="xs" style={{ color: 'var(--accent-100)' }} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ============================================================
   WEBSOCKET STATUS BADGE
   ============================================================ */

export function WebSocketStatusBadge({
  status,
  reconnectAttempt,
}: {
  status: WebSocketStatus
  reconnectAttempt: number
}) {
  if (status === 'connected') return null

  return (
    <motion.div
      className="flex items-center gap-1.5 ml-2 text-[10px] px-2.5 py-0.5 rounded-full border
                 bg-surface-base relative overflow-hidden"
      style={{
        color: status === 'reconnecting' ? 'var(--color-danger)' : 'var(--text-secondary)',
        borderColor: status === 'reconnecting' ? 'color-mix(in srgb, var(--vermillion-100) 30%, transparent)' : 'var(--border-subtle)',
        backgroundColor: status === 'reconnecting' ? 'color-mix(in srgb, var(--vermillion-100) 8%, transparent)' : 'var(--color-surface-base)',
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
    >
      {status === 'connecting' && (
        <span className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ backgroundColor: 'color-mix(in srgb, var(--accent-100) 30%, transparent)' }} />
      )}
      {status === 'reconnecting' && (
        <span className="absolute inset-0 rounded-full animate-ping opacity-25"
          style={{ backgroundColor: 'color-mix(in srgb, var(--vermillion-100) 30%, transparent)' }} />
      )}
      {status === 'reconnecting' ? (
        <>
          <Icon icon={WifiOff} size="xs" className="relative z-10" />
          <span className="relative z-10">重连中{reconnectAttempt > 0 ? `(${reconnectAttempt})` : ''}</span>
        </>
      ) : status === 'connecting' ? (
        <>
          <Icon icon={Wifi} size="xs" className="animate-pulse relative z-10" />
          <span className="relative z-10">连接中</span>
        </>
      ) : (
        <>
          <Icon icon={WifiOff} size="xs" className="relative z-10" />
          <span className="relative z-10">已断开</span>
        </>
      )}
    </motion.div>
  )
}

/* ============================================================
   ICON BUTTON (reusable for header actions)
   ============================================================ */

export function IconButton({
  icon,
  title,
  onClick,
  className = '',
}: {
  icon: React.ReactNode
  title: string
  onClick?: () => void
  className?: string
}) {
  return (
    <motion.button
      className={`p-2 rounded-xl relative overflow-hidden bg-surface-raised border border-default text-secondary touch-target-min
                 transition-all duration-200 ease-out hidden sm:flex items-center justify-center ${className}`}
      style={{
        boxShadow: `
          0 2px 8px color-mix(in srgb, var(--ink-100) 6%, transparent),
          inset 0 1px 0 color-mix(in srgb, white 5%, transparent)
        `,
      }}
      title={title}
      aria-label={title}
      onClick={onClick}
      whileHover={{
        scale: 1.06,
        borderColor: 'var(--border-strong)',
      }}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      <span className="relative z-10">{icon}</span>
    </motion.button>
  )
}

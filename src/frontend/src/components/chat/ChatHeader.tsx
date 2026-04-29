import { useState, useRef, useEffect } from 'react'
import { useChatStore, useUIStore } from '@/store'
import { Button } from '@/components/ui/Button'
import {
  ArrowRight, Settings, PenTool, Sun, Moon, Eye,
  Palette, Coffee, TreePine, Save, History, Wifi,
  WifiOff, Check, ChevronDown, Menu,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useThemeContext } from '@/components/shared/ThemeProvider'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { getWebSocketClient, type WebSocketStatus } from '@/api/websocket'
import type { Theme } from '@/hooks/useTheme'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


const themeMeta: Record<Theme, { label: string; icon: React.ReactNode; color: string }> = {
  dark:            { label: '深色',   icon: <Moon className="w-3.5 h-3.5" />,     color: '#5e6ad2' },
  light:           { label: '浅色',   icon: <Sun className="w-3.5 h-3.5" />,      color: '#e8b87d' },
  'eye-care':      { label: '护眼',   icon: <Eye className="w-3.5 h-3.5" />,      color: '#7eb87a' },
  'deep-blue': { label: '深夜蓝', icon: <Palette className="w-3.5 h-3.5" />,  color: '#60a5fa' },
  'sepia':     { label: '暖纸',   icon: <Coffee className="w-3.5 h-3.5" />,   color: '#b46e3c' },
  'forest':    { label: '森林',   icon: <TreePine className="w-3.5 h-3.5" />, color: '#5aaf72' },
}

/* ============================================================
   THEME SELECTOR DROPDOWN
   ============================================================ */

function ThemeSelector() {
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
          <ChevronDown className="w-3 h-3" />
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
              backdropFilter: 'blur(20px)',
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
                    {isActive && <Check className="w-3 h-3" style={{ color: meta.color }} />}
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
                {followSystem && <Check className="w-3 h-3" style={{ color: 'var(--accent-100)' }} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ============================================================
   BREATHING LOGO - Simplified, elegant
   ============================================================ */

function BreathingLogo() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      className="w-9 h-9 rounded-xl flex items-center justify-center relative"
      style={{
        background: 'linear-gradient(135deg, var(--accent-primary) 0%, color-mix(in srgb, var(--accent-primary) 60%, var(--accent-80)) 100%)',
        boxShadow: `
          0 0 16px color-mix(in srgb, var(--accent-100) 25%, transparent),
          0 4px 12px color-mix(in srgb, var(--accent-100) 15%, transparent),
          inset 0 1px 1px color-mix(in srgb, white 20%, transparent)
        `,
      }}
      initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
      animate={{
        scale: 1,
        opacity: 1,
        rotate: 0,
      }}
      transition={{ delay: 0.1, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{
        scale: 1.06,
        boxShadow: `
          0 0 24px color-mix(in srgb, var(--accent-100) 40%, transparent),
          0 6px 16px color-mix(in srgb, var(--accent-100) 20%, transparent)
        `,
      }}
      whileTap={{ scale: 0.92 }}
    >
      <PenTool className="w-4 h-4 text-white drop-shadow-lg" />
      {/* Single subtle glow ring */}
      {!prefersReducedMotion && (
        <motion.span
          className="absolute inset-[-3px] rounded-xl border-2 border-transparent"
          style={{
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-90)) border-box',
            WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            opacity: 0.3,
          }}
          animate={{
            opacity: [0.15, 0.35, 0.15],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  )
}

/* ============================================================
   WEBSOCKET STATUS BADGE
   ============================================================ */

function WebSocketStatusBadge({
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
          <WifiOff className="w-2.5 h-2.5 relative z-10" />
          <span className="relative z-10">重连中{reconnectAttempt > 0 ? `(${reconnectAttempt})` : ''}</span>
        </>
      ) : status === 'connecting' ? (
        <>
          <Wifi className="w-2.5 h-2.5 animate-pulse relative z-10" />
          <span className="relative z-10">连接中</span>
        </>
      ) : (
        <>
          <WifiOff className="w-2.5 h-2.5 relative z-10" />
          <span className="relative z-10">已断开</span>
        </>
      )}
    </motion.div>
  )
}

/* ============================================================
   ICON BUTTON (reusable for header actions)
   ============================================================ */

function IconButton({
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
                 transition-all duration-200 ease-out hidden sm:flex ${className}`}
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

/* ============================================================
   CHAT HEADER
   ============================================================ */

export function ChatHeader({ onMobileMenuClick }: { onMobileMenuClick?: () => void }) {
  const { messages, sessionId } = useChatStore()
  const { setCurrentInterface } = useUIStore()
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [wsReconnectAttempt, setWsReconnectAttempt] = useState(0)

  // WebSocket connection management
  useEffect(() => {
    if (!sessionId) return

    const ws = getWebSocketClient()
    ws.on({
      onStatusChange: (status) => setWsStatus(status),
      onReconnect: (attempt) => setWsReconnectAttempt(attempt),
      onConnect: () => setWsReconnectAttempt(0),
      onMessage: (msg) => {
        if (msg.type === 'message' && msg.content && msg.role) {
          // Messages are handled by chatStore via HTTP API; WebSocket is for sync only
        }
      },
    })

    ws.connect(sessionId)

    return () => {
      ws.disconnect()
    }
  }, [sessionId])

  const hasMessages = messages.length > 0

  return (
    <motion.header
      className="h-[var(--layout-topbar-height)] flex items-center justify-between px-4 z-20 relative shrink-0
                 bg-surface-base/85 backdrop-blur-xl border-b border-transparent"
      style={{
        borderImage: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-100) 20%, transparent) 30%, color-mix(in srgb, var(--accent-100) 30%, transparent) 50%, color-mix(in srgb, var(--accent-100) 20%, transparent) 70%, transparent 100%) 1',
        borderImageSlice: '0 0 1 0',
        boxShadow: `
          0 4px 30px color-mix(in srgb, var(--ink-100) 10%, transparent),
          0 1px 0 color-mix(in srgb, var(--accent-100) 8%, transparent) inset
        `,
      }}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Left: Logo + Project Name */}
      <div className="flex items-center gap-3">
        <BreathingLogo />
        <motion.h1
          className="font-semibold text-sm text-primary tracking-wide relative"
          style={{
            letterSpacing: '0.08em',
          }}
          initial={{ x: -8, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="relative">
            自动化写作软件
          </span>
        </motion.h1>
        {hasMessages && (
          <motion.span
            className="text-xs ml-2 px-2 py-0.5 rounded-full border border-subtle
                       text-secondary bg-surface-base"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.25 }}
          >
            {messages.length} 条消息
          </motion.span>
        )}

        <WebSocketStatusBadge status={wsStatus} reconnectAttempt={wsReconnectAttempt} />
      </div>

      {/* Right: Settings + Theme Selector */}
      <motion.div
        className="flex items-center gap-1 sm:gap-2"
        initial={{ x: 8, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        {/* Mobile: Show collected info button */}
        {onMobileMenuClick && (
          <motion.button
            onClick={onMobileMenuClick}
            className="md:hidden mobile-menu-btn mr-1 p-2 rounded-lg text-secondary hover:text-primary hover:bg-surface-base"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="查看已收集信息"
          >
            <Menu className="w-4 h-4" />
          </motion.button>
        )}
        <IconButton
          icon={<Save className="w-4 h-4" />}
          title="保存会话"
        />
        <IconButton
          icon={<History className="w-4 h-4" />}
          title="历史记录"
        />
        <ThemeSelector />
        <Button
          onClick={() => setCurrentInterface('settings')}
          variant="primary"
          size="sm"
          className="touch-target-min"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">进入设定</span>
          <ArrowRight className="w-3 h-3" />
        </Button>
      </motion.div>
    </motion.header>
  )
}

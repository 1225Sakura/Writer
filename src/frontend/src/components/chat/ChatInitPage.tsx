import { useEffect, useState, useRef } from 'react'
import { useChatStore, useUIStore } from '@/store'
import { AIGuidePanel } from './AIGuidePanel'
import { UserInputPanel } from './UserInputPanel'
import { CollectedInfoPanel } from './CollectedInfoPanel'
import { Button } from '@/components/ui/Button'
import {
  ArrowRight, Settings, PenTool, Sun, Moon, Eye,
  Palette, Coffee, TreePine, Save, History, Wifi,
  WifiOff, Check, ChevronDown,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatSkeleton } from '@/components/shared/SmartSkeleton'
import { useThemeContext } from '@/components/shared/ThemeProvider'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { getWebSocketClient, type WebSocketStatus } from '@/api/websocket'
import type { Theme } from '@/hooks/useTheme'

const themeMeta: Record<Theme, { label: string; icon: React.ReactNode; color: string }> = {
  dark:            { label: '深色',   icon: <Moon className="w-3.5 h-3.5" />,     color: '#5e6ad2' },
  light:           { label: '浅色',   icon: <Sun className="w-3.5 h-3.5" />,      color: '#e8b87d' },
  'eye-care':      { label: '护眼',   icon: <Eye className="w-3.5 h-3.5" />,      color: '#7eb87a' },
  'midnight-blue': { label: '深夜蓝', icon: <Palette className="w-3.5 h-3.5" />,  color: '#60a5fa' },
  'warm-paper':    { label: '暖纸',   icon: <Coffee className="w-3.5 h-3.5" />,   color: '#b46e3c' },
  'forest-green':  { label: '森林',   icon: <TreePine className="w-3.5 h-3.5" />, color: '#64be82' },
}

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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised border border-default
                   text-secondary touch-target-min hover:bg-surface-hover hover:border-border-strong
                   transition-all duration-200 ease-out"
        title="切换主题"
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        <span style={{ color: currentMeta.color }}>{currentMeta.icon}</span>
        <span className="text-xs hidden sm:inline">{currentMeta.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full mt-1.5 z-50 p-1.5 rounded-xl min-w-[160px]"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 8px 30px color-mix(in srgb, var(--ink-100) 20%, transparent), 0 2px 8px color-mix(in srgb, var(--ink-100) 10%, transparent)',
            }}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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

export function ChatInitPage() {
  const { extractedEntities, sessionId, createSession, loadExtractedEntities, loadMessages, confirmEntity, messages, isLoading } = useChatStore()
  const { setCurrentInterface } = useUIStore()
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [wsReconnectAttempt, setWsReconnectAttempt] = useState(0)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Initialize session on mount
  useEffect(() => {
    if (!sessionId) {
      createSession()
    }
  }, [sessionId, createSession])

  // Load extracted entities when session changes
  useEffect(() => {
    if (sessionId) {
      loadExtractedEntities()
      loadMessages()
    }
  }, [sessionId, loadExtractedEntities, loadMessages])

  // WebSocket connection management
  useEffect(() => {
    if (!sessionId) return

    const ws = getWebSocketClient()
    ws.on({
      onStatusChange: (status) => setWsStatus(status),
      onReconnect: (attempt) => setWsReconnectAttempt(attempt),
      onConnect: () => setWsReconnectAttempt(0),
    })

    ws.connect(sessionId)

    return () => {
      ws.disconnect()
    }
  }, [sessionId])

  const hasMessages = messages.length > 0

  return (
    <motion.div
      className="flex flex-col h-full relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-accent-primary/10"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.1, 1], opacity: [0.6, 0.8, 0.6] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-20 right-20 w-80 h-80 rounded-full bg-[var(--color-character)]/10"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.15, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      {/* 顶部导航栏 - 48px */}
      <motion.header
        className="h-[var(--layout-topbar-height)] flex items-center justify-between px-4 z-20 relative shrink-0
                   bg-surface-base/80 backdrop-blur-md border-b border-transparent"
        style={{
          borderImage: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-100) 15%, transparent) 30%, color-mix(in srgb, var(--accent-100) 25%, transparent) 50%, color-mix(in srgb, var(--accent-100) 15%, transparent) 70%, transparent 100%) 1',
          borderImageSlice: '0 0 1 0',
        }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Left: Logo + Project Name */}
        <div className="flex items-center gap-3">
          <motion.div
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-muted glow-border"
            style={{ boxShadow: 'var(--shadow-glow-sm)' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <PenTool className="w-4 h-4 text-accent-primary" />
          </motion.div>
          <motion.h1
            className="font-medium text-sm text-primary tracking-wide"
            style={{
              letterSpacing: '0.08em',
              textShadow: '0 0 20px color-mix(in srgb, var(--accent-100) 15%, transparent), 0 0 40px color-mix(in srgb, var(--accent-100) 8%, transparent)',
            }}
            initial={{ x: -8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            自动化写作软件
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

          {/* WebSocket connection status */}
          {wsStatus !== 'connected' && (
            <motion.div
              className="flex items-center gap-1.5 ml-2 text-[10px] px-2.5 py-0.5 rounded-full border
                         bg-surface-base relative overflow-hidden"
              style={{
                color: wsStatus === 'reconnecting' ? 'var(--color-danger)' : 'var(--text-secondary)',
                borderColor: wsStatus === 'reconnecting' ? 'color-mix(in srgb, var(--vermillion-100) 30%, transparent)' : 'var(--border-subtle)',
                backgroundColor: wsStatus === 'reconnecting' ? 'color-mix(in srgb, var(--vermillion-100) 8%, transparent)' : 'var(--color-surface-base)',
                boxShadow: wsStatus === 'reconnecting'
                  ? '0 0 8px color-mix(in srgb, var(--vermillion-100) 15%, transparent), inset 0 0 4px color-mix(in srgb, var(--vermillion-100) 5%, transparent)'
                  : '0 0 6px color-mix(in srgb, var(--accent-100) 8%, transparent)',
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              {/* Pulse ring animation for status indicator */}
              {wsStatus === 'connecting' && (
                <span className="absolute inset-0 rounded-full animate-ping opacity-20"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent-100) 30%, transparent)' }} />
              )}
              {wsStatus === 'reconnecting' && (
                <span className="absolute inset-0 rounded-full animate-ping opacity-25"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--vermillion-100) 30%, transparent)' }} />
              )}
              {wsStatus === 'reconnecting' ? (
                <>
                  <WifiOff className="w-2.5 h-2.5 relative z-10" />
                  <span className="relative z-10">重连中{wsReconnectAttempt > 0 ? `(${wsReconnectAttempt})` : ''}</span>
                </>
              ) : wsStatus === 'connecting' ? (
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
          )}
        </div>

        {/* Right: Settings + Theme Selector */}
        <motion.div
          className="flex items-center gap-1 sm:gap-2"
          initial={{ x: 8, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.button
            className="p-2 rounded-lg bg-surface-raised border border-default text-secondary touch-target-min
                       hover:bg-surface-hover hover:border-border-strong
                       transition-all duration-200 ease-out hidden sm:flex"
            style={{ boxShadow: 'var(--shadow-glow-sm)' }}
            title="保存会话"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <Save className="w-4 h-4" />
          </motion.button>
          <motion.button
            className="p-2 rounded-lg bg-surface-raised border border-default text-secondary touch-target-min
                       hover:bg-surface-hover hover:border-border-strong
                       transition-all duration-200 ease-out hidden sm:flex"
            style={{ boxShadow: 'var(--shadow-glow-sm)' }}
            title="历史记录"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <History className="w-4 h-4" />
          </motion.button>
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

      {/* Main Content Area - Left/Right Split Layout */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* 左侧：AI聊天区域 */}
        <motion.div
          className="flex-1 flex flex-col min-w-0"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* 聊天内容 */}
          <div className="flex-1 overflow-hidden relative">
            {isLoading && messages.length === 0 ? (
              <div className="h-full overflow-y-auto p-4">
                <ChatSkeleton count={3} />
              </div>
            ) : (
              <AIGuidePanel />
            )}
          </div>
          <UserInputPanel />
        </motion.div>

        {/* 右侧：已收集信息面板 - 移动端隐藏 */}
        <motion.div
          className="w-[40%] max-w-[480px] min-w-[280px] overflow-y-auto shrink-0 hidden lg:block bg-surface-raised border-l border-default"
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <CollectedInfoPanel entities={extractedEntities} onConfirmEntity={confirmEntity} />
        </motion.div>
      </div>

      {/* 底部操作栏 - 48px */}
      <motion.footer
        className="h-[var(--layout-topbar-height)] flex items-center justify-between px-2 sm:px-4 shrink-0 relative z-20
                   bg-[var(--glass-bg-strong)] backdrop-blur-xl border-t border-transparent"
        style={{
          borderImage: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-100) 30%, transparent) 20%, color-mix(in srgb, var(--color-success) 25%, transparent) 50%, color-mix(in srgb, var(--accent-100) 30%, transparent) 80%, transparent 100%) 1',
          borderImageSlice: '0 0 1 0',
          boxShadow: '0 -4px 24px color-mix(in srgb, var(--ink-100) 15%, transparent), inset 0 1px 0 var(--border-subtle)',
        }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="flex items-center gap-1.5 text-xs text-secondary hidden sm:inline"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.3 }}
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"
              animate={prefersReducedMotion ? {} : { opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span>AI 正在引导你完善故事设定</span>
          </motion.div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Button
              onClick={() => setCurrentInterface('settings')}
              variant="secondary"
              size="sm"
              className="touch-target-min group/btn"
            >
              <motion.div
                className="relative"
                whileHover={{ rotate: 15 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              >
                <Settings className="w-4 h-4 text-secondary group-hover/btn:text-primary transition-colors duration-200" />
              </motion.div>
              <span className="hidden sm:inline">设定编辑</span>
            </Button>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <Button
              onClick={() => setCurrentInterface('writing')}
              variant="glow"
              size="sm"
              className="touch-target-min group/btn"
              glowColor="var(--accent-primary)"
              style={{
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-90) 50%, var(--accent-primary) 100%)',
                backgroundSize: '200% 200%',
                boxShadow: '0 0 12px color-mix(in srgb, var(--accent-100) 30%, transparent), 0 4px 12px color-mix(in srgb, var(--accent-100) 20%, transparent)',
              }}
            >
              <motion.div
                whileHover={{ rotate: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              >
                <PenTool className="w-4 h-4" />
              </motion.div>
              <span className="hidden sm:inline">开始写作</span>
              <motion.div
                className="relative"
                whileHover={{ x: 3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <ArrowRight className="w-3 h-3" />
              </motion.div>
            </Button>
          </motion.div>
        </div>
      </motion.footer>
    </motion.div>
  )
}

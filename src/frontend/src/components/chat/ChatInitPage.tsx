import { useEffect, useState } from 'react'
import { useChatStore, useUIStore } from '@/store'
import { AIGuidePanel } from './AIGuidePanel'
import { UserInputPanel } from './UserInputPanel'
import { CollectedInfoPanel } from './CollectedInfoPanel'
import { Button } from '@/components/ui/Button'
import { ArrowRight, Settings, PenTool, Sun, Moon, Save, History, Wifi, WifiOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatSkeleton } from '@/components/shared/SmartSkeleton'
import { useThemeContext } from '@/components/shared/ThemeProvider'
import { getWebSocketClient, type WebSocketStatus } from '@/api/websocket'

export function ChatInitPage() {
  const { extractedEntities, sessionId, createSession, loadExtractedEntities, loadMessages, confirmEntity, messages, isLoading } = useChatStore()
  const { setCurrentInterface } = useUIStore()
  const { theme, toggleTheme } = useThemeContext()
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [wsReconnectAttempt, setWsReconnectAttempt] = useState(0)

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
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.8, 0.6] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-20 right-20 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-character) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      {/* 顶部导航栏 - 48px */}
      <motion.header
        className="h-[var(--layout-topbar-height)] flex items-center justify-between px-4 z-20 relative shrink-0"
        style={{
          backgroundColor: 'var(--color-surface-base)',
          backdropFilter: 'blur(12px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
          borderBottom: '1px solid var(--color-border)',
        }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Left: Logo + Project Name */}
        <div className="flex items-center gap-3">
          <motion.div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: 'var(--accent-muted)',
              border: '1px solid var(--border-focus)',
              boxShadow: 'var(--shadow-glow-sm)',
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <PenTool className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          </motion.div>
          <motion.h1
            className="font-medium text-sm"
            style={{ color: 'var(--text-primary)' }}
            initial={{ x: -8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            自动化写作软件
          </motion.h1>
          {hasMessages && (
            <motion.span
              className="text-xs ml-2 px-2 py-0.5 rounded-full border"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--color-surface-base)',
                borderColor: 'var(--border-subtle)',
              }}
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
              className="flex items-center gap-1 ml-2 text-[10px] px-2 py-0.5 rounded-full"
              style={{
                color: wsStatus === 'reconnecting' ? 'var(--color-danger)' : 'var(--text-secondary)',
                backgroundColor: wsStatus === 'reconnecting' ? 'rgba(196, 92, 92, 0.08)' : 'var(--color-surface-base)',
                border: `1px solid ${wsStatus === 'reconnecting' ? 'rgba(196, 92, 92, 0.2)' : 'var(--border-subtle)'}`,
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              {wsStatus === 'reconnecting' ? (
                <>
                  <WifiOff className="w-2.5 h-2.5" />
                  重连中{wsReconnectAttempt > 0 ? `(${wsReconnectAttempt})` : ''}
                </>
              ) : wsStatus === 'connecting' ? (
                <>
                  <Wifi className="w-2.5 h-2.5 animate-pulse" />
                  连接中
                </>
              ) : (
                <>
                  <WifiOff className="w-2.5 h-2.5" />
                  已断开
                </>
              )}
            </motion.div>
          )}
        </div>

        {/* Right: Settings + Theme Toggle */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ x: 8, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.button
            className="p-2 rounded-lg"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--text-secondary)',
            }}
            title="保存会话"
            whileHover={{ scale: 1.05, backgroundColor: 'var(--color-surface-hover)' }}
            whileTap={{ scale: 0.95 }}
          >
            <Save className="w-4 h-4" />
          </motion.button>
          <motion.button
            className="p-2 rounded-lg"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--text-secondary)',
            }}
            title="历史记录"
            whileHover={{ scale: 1.05, backgroundColor: 'var(--color-surface-hover)' }}
            whileTap={{ scale: 0.95 }}
          >
            <History className="w-4 h-4" />
          </motion.button>
          <motion.button
            className="p-2 rounded-lg"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--text-secondary)',
            }}
            title="主题设置"
            onClick={toggleTheme}
            whileHover={{ scale: 1.05, backgroundColor: 'var(--color-surface-hover)' }}
            whileTap={{ scale: 0.95 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </motion.div>
            </AnimatePresence>
          </motion.button>
          <Button
            onClick={() => setCurrentInterface('settings')}
            variant="primary"
            size="sm"
          >
            <Settings className="w-4 h-4" />
            <span>进入设定</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </motion.div>
      </motion.header>

      {/* Main Content Area - Left/Right Split Layout */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* 左侧：AI聊天区域 (60%) */}
        <motion.div
          className="flex-1 flex flex-col border-r"
          style={{ borderColor: 'var(--border-default)' }}
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

        {/* 右侧：已收集信息面板 */}
        <motion.div
          className="w-[40%] max-w-[480px] min-w-[280px] overflow-y-auto shrink-0 hidden md:block"
          style={{ backgroundColor: 'var(--color-surface-raised)' }}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <CollectedInfoPanel entities={extractedEntities} onConfirmEntity={confirmEntity} />
        </motion.div>
      </div>

      {/* 底部操作栏 - 48px */}
      <motion.footer
        className="h-[var(--layout-topbar-height)] flex items-center justify-between px-4 shrink-0 relative z-20"
        style={{
          backgroundColor: 'var(--color-surface-base)',
          backdropFilter: 'blur(12px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
          borderTop: '1px solid var(--color-border)',
        }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            AI 正在引导你完善故事设定
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setCurrentInterface('settings')}
            variant="secondary"
            size="sm"
          >
            <Settings className="w-4 h-4" />
            <span>设定编辑</span>
          </Button>
          <Button
            onClick={() => setCurrentInterface('writing')}
            variant="primary"
            size="sm"
          >
            <PenTool className="w-4 h-4" />
            <span>开始写作</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </motion.footer>
    </motion.div>
  )
}

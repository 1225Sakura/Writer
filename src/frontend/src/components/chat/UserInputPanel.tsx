import { useState, useRef, useCallback } from 'react'
import { useChatStore } from '@/store'
import { Send, RefreshCw, Loader2, FileText, Zap, Wand2, Lightbulb } from 'lucide-react'
import { ChatTemplates } from './ChatTemplates'
import { motion, AnimatePresence } from 'framer-motion'
import { getWebSocketClient } from '@/api/websocket'

const quickReplies = [
  { label: '继续', icon: <Zap className="w-3.5 h-3.5" />, message: '继续' },
  { label: '详细点', icon: <Wand2 className="w-3.5 h-3.5" />, message: '请说得更详细一些' },
  { label: '换个思路', icon: <Lightbulb className="w-3.5 h-3.5" />, message: '换个思路' },
]

export function UserInputPanel() {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage, createSession, clearSession, sessionId, isLoading, isStreaming, error, messages, exportToOutline } = useChatStore()
  const [showExportConfirm, setShowExportConfirm] = useState(false)

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || isStreaming) return

    let currentSessionId = sessionId
    if (!currentSessionId) {
      await createSession()
      currentSessionId = useChatStore.getState().sessionId
    }

    if (!currentSessionId) return

    const content = input.trim()
    setInput('')

    // Also send via WebSocket for real-time sync if connected
    const ws = getWebSocketClient()
    if (ws.isConnected) {
      ws.sendText(content, 'user')
    }

    await sendMessage(content)
  }, [input, isLoading, isStreaming, sessionId, createSession, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    clearSession()
    createSession()
  }

  const handleTemplateSelect = (message: string) => {
    setInput(message)
    textareaRef.current?.focus()
  }

  const handleQuickReply = useCallback((message: string) => {
    setInput(message)
    // Auto-send for quick replies
    setTimeout(() => {
      const currentSessionId = sessionId || useChatStore.getState().sessionId
      if (currentSessionId) {
        // Send via WebSocket if connected
        const ws = getWebSocketClient()
        if (ws.isConnected) {
          ws.sendText(message, 'user')
        }
        sendMessage(message)
        setInput('')
      } else {
        createSession().then(() => {
          const ws = getWebSocketClient()
          if (ws.isConnected) {
            ws.sendText(message, 'user')
          }
          sendMessage(message)
          setInput('')
        })
      }
    }, 100)
  }, [sessionId, createSession, sendMessage])

  const handleExportOutline = () => {
    const result = exportToOutline()
    if (result.entries.length > 0) {
      setShowExportConfirm(true)
      setTimeout(() => setShowExportConfirm(false), 3000)
    }
  }

  const hasMessages = messages.length > 0
  const canSend = input.trim() && !isLoading && !isStreaming

  return (
    <div className="flex flex-col gap-3 p-4 bg-surface-base border-t border-default">
      {/* Template selector + Export button row */}
      <div className="flex items-center justify-between">
        <ChatTemplates onSelect={handleTemplateSelect} disabled={isLoading || isStreaming} />

        {hasMessages && (
          <motion.button
            onClick={handleExportOutline}
            disabled={isLoading || isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-default
                       text-secondary hover:bg-surface-raised hover:text-primary
                       active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            whileHover={{ y: -1, boxShadow: 'var(--shadow-card)' }}
            whileTap={{ scale: 0.97 }}
          >
            <FileText className="w-4 h-4" />
            <span>生成大纲</span>
          </motion.button>
        )}
      </div>

      {/* Export confirmation toast */}
      <AnimatePresence>
        {showExportConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg
                       bg-[rgba(126,184,74,0.1)] text-[var(--color-ifline)] border border-[rgba(126,184,74,0.2)]"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </motion.div>
            大纲已生成！请前往设定界面查看。
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick reply buttons */}
      <AnimatePresence>
        {hasMessages && !isLoading && !isStreaming && (
          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            {quickReplies.map((reply, i) => (
              <motion.button
                key={reply.label}
                onClick={() => handleQuickReply(reply.message)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-default
                           text-secondary hover:bg-surface-raised hover:text-primary hover:border-strong
                           transition-colors"
                style={{ whiteSpace: 'nowrap' }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                whileHover={{ y: -1, scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="flex-shrink-0 opacity-60">{reply.icon}</span>
                <span>{reply.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 items-end">
        {/* New chat button */}
        <motion.button
          className="p-2.5 flex-shrink-0 rounded-md bg-surface-raised border border-default touch-target-min"
          title="开始新对话"
          onClick={handleNewChat}
          whileHover={{ scale: 1.08, backgroundColor: 'var(--color-surface-hover)' }}
          whileTap={{ scale: 0.92 }}
          transition={{ duration: 0.15 }}
        >
          <RefreshCw className="w-5 h-5 text-[var(--icon-secondary)]" />
        </motion.button>

        {/* Input area */}
        <div className="flex-1 relative min-w-0">
          <motion.div
            className="relative"
            animate={{
              boxShadow: isFocused
                ? '0 0 0 1px var(--accent-primary), var(--shadow-glow-sm)'
                : '0 0 0 1px transparent',
            }}
            transition={{ duration: 0.2 }}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="输入你的回答... (Enter 发送，Shift+Enter 换行)"
              className="w-full resize-none min-h-[48px] max-h-32 py-3 px-4 text-sm
                         bg-surface-input text-primary font-sans
                         border rounded-md outline-none
                         transition-colors duration-200
                         placeholder:text-tertiary"
              style={{
                borderColor: isFocused ? 'var(--accent-primary)' : 'var(--color-border)',
              }}
              rows={1}
            />
            {/* Focus glow overlay */}
            <AnimatePresence>
              {isFocused && (
                <motion.div
                  className="absolute inset-0 rounded-md pointer-events-none"
                  style={{
                    boxShadow: 'inset 0 0 20px rgba(94, 106, 210, 0.03)',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Send button with micro-interactions */}
        <motion.button
          onClick={handleSend}
          disabled={!canSend}
          className="px-5 py-2.5 flex items-center gap-2 text-sm font-medium flex-shrink-0
                     rounded-md text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: canSend ? 'var(--accent-primary)' : 'var(--color-surface-input)',
          }}
          whileHover={canSend ? {
            scale: 1.05,
            backgroundColor: 'var(--accent-hover)',
            boxShadow: 'var(--shadow-glow)',
          } : {}}
          whileTap={canSend ? { scale: 0.92 } : {}}
          transition={{ duration: 0.15 }}
        >
          {isLoading || isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <motion.div
              animate={canSend ? { x: [0, 3, 0] } : {}}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
            >
              <Send className="w-4 h-4" />
            </motion.div>
          )}
          <span>{isLoading || isStreaming ? '发送中...' : '发送'}</span>
        </motion.button>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="text-sm px-3 py-2 rounded-lg flex items-center gap-2
                       text-[var(--color-danger)] bg-[rgba(196,92,92,0.08)] border border-[rgba(196,92,92,0.15)]"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)] flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

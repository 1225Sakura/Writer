import { useState } from 'react'
import { useChatStore } from '@/store'
import { Send, RefreshCw, Loader2, FileText } from 'lucide-react'
import { ChatTemplates } from './ChatTemplates'
import { motion, AnimatePresence } from 'framer-motion'

export function UserInputPanel() {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const { sendMessage, createSession, clearSession, sessionId, isLoading, isStreaming, error, messages, exportToOutline } = useChatStore()
  const [showExportConfirm, setShowExportConfirm] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || isLoading || isStreaming) return

    let currentSessionId = sessionId
    if (!currentSessionId) {
      await createSession()
      currentSessionId = useChatStore.getState().sessionId
    }

    if (!currentSessionId) return

    setInput('')
    await sendMessage(input.trim())
  }

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
  }

  const handleExportOutline = () => {
    const result = exportToOutline()
    if (result.entries.length > 0) {
      setShowExportConfirm(true)
      setTimeout(() => setShowExportConfirm(false), 3000)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col gap-3 p-4"
         style={{
           backgroundColor: 'var(--color-bg-surface)',
           borderTop: '1px solid var(--color-border)',
         }}>
      {/* Template selector + Export button row */}
      <div className="flex items-center justify-between">
        <ChatTemplates onSelect={handleTemplateSelect} disabled={isLoading || isStreaming} />

        {hasMessages && (
          <motion.button
            onClick={handleExportOutline}
            disabled={isLoading || isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[rgba(255,255,255,0.08)]
                       text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f7f8f8]
                       active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>生成大纲</span>
          </motion.button>
        )}
      </div>

      {/* Export confirmation toast */}
      <AnimatePresence>
        {showExportConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-xs text-[#7eb84a] px-1"
          >
            大纲已生成！请前往设定界面查看。
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 items-end">
        {/* Linear ghost button for new chat */}
        <motion.button
          className="p-2 flex-shrink-0"
          style={{
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          title="开始新对话"
          onClick={handleNewChat}
          whileHover={{ scale: 1.08, backgroundColor: 'rgba(255,255,255,0.05)' }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <RefreshCw className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
        </motion.button>

        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="输入你的回答... (Enter 发送，Shift+Enter 换行)"
            className="w-full resize-none min-h-[44px] max-h-32 py-2 px-3 text-sm"
            style={{
              backgroundColor: 'var(--color-surface-input)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              transition: 'border-color 200ms ease, box-shadow 200ms ease',
              boxShadow: isFocused
                ? '0 0 0 1px var(--accent-primary), 0 0 12px rgba(94, 106, 210, 0.2)'
                : 'none',
              borderColor: isFocused ? 'var(--accent-primary)' : 'var(--color-border)',
            }}
            rows={1}
          />
        </div>

        <motion.button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || isStreaming}
          className="px-4 py-2 flex items-center gap-2 text-sm font-medium flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--accent-primary)',
            borderRadius: 'var(--radius-md)',
            color: '#ffffff',
            border: 'none',
          }}
          whileHover={!(!input.trim() || isLoading || isStreaming) ? {
            scale: 1.05,
            backgroundColor: 'var(--accent-hover)',
          } : {}}
          whileTap={!(!input.trim() || isLoading || isStreaming) ? { scale: 0.95 } : {}}
          transition={{ duration: 0.15 }}
        >
          {isLoading || isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <motion.div
              animate={input.trim() && !isLoading && !isStreaming ? { x: [0, 2, 0] } : {}}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <Send className="w-4 h-4" />
            </motion.div>
          )}
          <span>{isLoading || isStreaming ? '发送中...' : '发送'}</span>
        </motion.button>
      </div>

      {error && (
        <motion.div
          className="text-sm px-1"
          style={{ color: 'var(--color-danger)' }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {error}
        </motion.div>
      )}
    </div>
  )
}

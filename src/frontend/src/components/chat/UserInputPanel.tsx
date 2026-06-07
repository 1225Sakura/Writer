import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useChatStore } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { showSuccess } from '@/utils/toastHelper'
import { getWebSocketClient } from '@/api/websocket'
import { InputField } from './InputField'
import { InputSuggestions } from './InputSuggestions'
import { InputActions } from './InputActions'
import { FirstTimeHint } from './FirstTimeHint'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


export function UserInputPanel() {
  const [input, setInput] = useState('')
  const { sendMessage, createSession, clearSession, sessionId, isLoading, isStreaming, error, messages, exportToOutline, pendingInput, setPendingInput } = useChatStore()
  const [showExportConfirm, setShowExportConfirm] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Sync pendingInput from store (set by genre tags in EmptyState) to local input
  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput)
      setPendingInput('')
    }
  }, [pendingInput, setPendingInput])

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

  const handleNewChat = () => {
    clearSession()
    createSession()
  }

  const handleTemplateSelect = (message: string) => {
    setInput(message)
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

  const handleExportOutline = async () => {
    const result = exportToOutline()
    if (result.entries.length > 0) {
      const { importFromChat } = useSettingsStore.getState()
      await importFromChat(result.entries)
      setShowExportConfirm(true)
      showSuccess(`已导出 ${result.entries.length} 个设定到设定编辑器`)
    }
  }

  // Cleanup timeout for export confirmation toast
  useEffect(() => {
    if (showExportConfirm) {
      const timer = setTimeout(() => setShowExportConfirm(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showExportConfirm])

  const hasMessages = messages.length > 0
  const canSend = input.trim() && !isLoading && !isStreaming

  return (
    <div className="flex flex-col gap-3 p-4 bg-surface-base border-t border-default">
      <FirstTimeHint />

      <InputSuggestions
        hasMessages={hasMessages}
        isLoading={isLoading}
        isStreaming={isStreaming}
        showExportConfirm={showExportConfirm}
        onTemplateSelect={handleTemplateSelect}
        onQuickReply={handleQuickReply}
        onExportOutline={handleExportOutline}
      />

      <InputField
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        onNewChat={handleNewChat}
        isLoading={isLoading}
        isStreaming={isStreaming}
        canSend={!!canSend}
      />

      {/* Keyboard shortcut hints */}
      <motion.div
        className="flex items-center justify-center gap-4 text-[10px] text-tertiary/60 select-none"
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: DURATION.NORMAL, delay: 0.3, ease: EASE.SMOOTH }}
      >
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-surface-raised border border-default/50">Enter</kbd>
          <span>发送</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-surface-raised border border-default/50">Shift</kbd>
          <span>+</span>
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-surface-raised border border-default/50">Enter</kbd>
          <span>换行</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-surface-raised border border-default/50">Ctrl</kbd>
          <span>+</span>
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-surface-raised border border-default/50">S</kbd>
          <span>保存</span>
        </span>
      </motion.div>

      <InputActions error={error} />
    </div>
  )
}

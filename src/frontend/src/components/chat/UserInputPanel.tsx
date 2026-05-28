import { useState, useCallback, useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { showSuccess } from '@/utils/toastHelper'
import { getWebSocketClient } from '@/api/websocket'
import { InputField } from './InputField'
import { InputSuggestions } from './InputSuggestions'
import { InputActions } from './InputActions'


export function UserInputPanel() {
  const [input, setInput] = useState('')
  const { sendMessage, createSession, clearSession, sessionId, isLoading, isStreaming, error, messages, exportToOutline, pendingInput, setPendingInput } = useChatStore()
  const [showExportConfirm, setShowExportConfirm] = useState(false)

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

      <InputActions error={error} />
    </div>
  )
}

import { useState } from 'react'
import { useChatStore } from '@/store'
import { Send, RefreshCw, Loader2 } from 'lucide-react'

export function UserInputPanel() {
  const [input, setInput] = useState('')
  const { sendMessage, createSession, clearSession, sessionId, isLoading, error } = useChatStore()

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

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

  return (
    <div className="flex flex-col gap-3 p-4"
         style={{
           backgroundColor: 'var(--color-bg-surface)',
           borderTop: '1px solid var(--color-border)',
         }}>
      <div className="flex gap-2 items-end">
        {/* Linear ghost button for new chat */}
        <button
          className="p-2 flex-shrink-0 transition-all hover:scale-105"
          style={{
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          title="开始新对话"
          onClick={handleNewChat}
        >
          <RefreshCw className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的回答... (Enter 发送，Shift+Enter 换行)"
          className="flex-1 resize-none min-h-[44px] max-h-32 py-2 px-3 text-sm"
          style={{
            backgroundColor: 'var(--color-surface-input)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            transition: 'all 100ms ease',
          }}
          rows={1}
        />

        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="px-4 py-2 flex items-center gap-2 text-sm font-medium flex-shrink-0 transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--accent-primary)',
            borderRadius: 'var(--radius-md)',
            color: '#ffffff',
            border: 'none',
          }}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>{isLoading ? '发送中...' : '发送'}</span>
        </button>
      </div>

      {error && (
        <div className="text-sm px-1" style={{ color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

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
    <div className="border-t border-[rgba(255,255,255,0.08)] p-4 bg-[#0f1011]">
      <div className="flex gap-2 items-end">
        <button
          className="p-2 rounded-md hover:bg-[rgba(255,255,255,0.05)] active:scale-95 transition-all"
          title="开始新对话"
          onClick={handleNewChat}
        >
          <RefreshCw className="w-5 h-5 text-[#d0d6e0]" />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的回答... (Enter 发送，Shift+Enter 换行)"
          className="flex-1 resize-none rounded-md border border-[rgba(255,255,255,0.08)]
                     bg-[#0f1011] text-[#f7f8f8] px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-[#5e6ad2] focus:border-[#5e6ad2]
                     placeholder:text-[#d0d6e0] placeholder:opacity-60
                     transition-colors min-h-[44px] max-h-32"
          rows={1}
        />

        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="px-4 py-2 bg-[#5e6ad2] text-white rounded-md
                     hover:bg-[#4f5ab8] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span className="text-sm">{isLoading ? '发送中...' : '发送'}</span>
        </button>
      </div>

      {error && (
        <div className="mt-2 text-sm text-[#d45d5d] px-1">
          {error}
        </div>
      )}
    </div>
  )
}

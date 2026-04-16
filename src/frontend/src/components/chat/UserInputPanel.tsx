import { useState } from 'react'
import { useChatStore } from '@/store'
import { Send, RefreshCw } from 'lucide-react'

export function UserInputPanel() {
  const [input, setInput] = useState('')
  const { addMessage, createSession, sessionId } = useChatStore()

  const handleSend = async () => {
    if (!input.trim()) return

    if (!sessionId) {
      createSession()
    }

    addMessage({ role: 'user', content: input.trim() })
    setInput('')

    setTimeout(() => {
      useChatStore.getState().addMessage({
        role: 'assistant',
        content: '这是一个示例回复。在实际实现中，这里会调用后端 API 获取 AI 的流式响应。',
      })
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    createSession()
    useChatStore.getState().addMessage({
      role: 'assistant',
      content: '好的，让我们开始一个新的项目。请告诉我你的故事属于什么类型？',
    })
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
          disabled={!input.trim()}
          className="px-4 py-2 bg-[#5e6ad2] text-white rounded-md
                     hover:bg-[#4f5ab8] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span className="text-sm">发送</span>
        </button>
      </div>
    </div>
  )
}

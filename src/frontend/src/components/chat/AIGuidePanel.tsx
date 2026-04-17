import { useChatStore, ChatMessage } from '@/store'
import { Bot, User } from 'lucide-react'

function ChatBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === 'assistant'

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-4`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-3 ${
          isAssistant
            ? 'bg-[#0f1011] border border-[rgba(255,255,255,0.08)] text-[#f7f8f8]'
            : 'bg-[#5e6ad2] text-white'
        }`}
      >
        <div className="flex items-start gap-2">
          {isAssistant && <Bot className="w-4 h-4 mt-0.5 text-[#5e6ad2] flex-shrink-0" />}
          {!isAssistant && <User className="w-4 h-4 mt-0.5 text-white flex-shrink-0" />}
          <div className="flex-1">
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>
            <div className="text-xs text-[#d0d6e0] mt-1">
              {new Date(message.createdAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[70%] rounded-lg px-4 py-3 bg-[#0f1011] border border-[rgba(255,255,255,0.08)]">
        <div className="flex items-start gap-2">
          <Bot className="w-4 h-4 mt-0.5 text-[#5e6ad2] flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-[#f7f8f8]">
              {content}
              <span className="inline-block w-2 h-4 ml-1 bg-[#5e6ad2] animate-pulse" />
            </div>
            <div className="text-xs text-[#d0d6e0] mt-1">正在输入...</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AIGuidePanel() {
  const { messages, isStreaming, currentStreamContent } = useChatStore()

  return (
    <div className="h-full overflow-y-auto p-4 bg-[#08090a]">
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#0f1011] border border-[rgba(255,255,255,0.08)] flex items-center justify-center mb-6">
            <Bot className="w-8 h-8 text-[#5e6ad2]" />
          </div>
          <h2 className="text-xl font-medium mb-3 text-[#f7f8f8]">
            欢迎使用自动化写作软件
          </h2>
          <p className="text-[#d0d6e0] max-w-md text-sm leading-relaxed">
            我将帮你创建一个精彩的网络小说项目。首先，请告诉我你的故事属于什么类型？
            <br />
            <br />
            例如：玄幻修仙、都市异能、悬疑推理、言情等
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {['玄幻修仙', '都市异能', '悬疑推理', '言情'].map((tag) => (
              <button
                key={tag}
                className="px-3 py-1.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[#24282c] text-[#e2e4e7] text-sm hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.08)] cursor-pointer transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <ChatBubble key={msg.id} message={msg} />
      ))}

      {isStreaming && <StreamingBubble content={currentStreamContent} />}
    </div>
  )
}

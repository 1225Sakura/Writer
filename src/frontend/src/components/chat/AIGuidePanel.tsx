import { useState, useRef, useEffect } from 'react'
import { useChatStore, ChatMessage, ExtractedEntity } from '@/store'
import { Bot, User, Pencil, Trash2, Check, X, Sparkles, MessageSquareText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TypingIndicator } from './TypingIndicator'
import { EntityTag } from './EntityTag'

const typeColors: Record<string, string> = {
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  world: 'var(--color-world)',
  rule: 'var(--color-rule)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
}

function HighlightedContent({ content, entities }: { content: string; entities?: ExtractedEntity[] }) {
  if (!entities || entities.length === 0) {
    return <div className="text-sm whitespace-pre-wrap leading-relaxed">{content}</div>
  }

  // Build a regex to match all entity names
  const sortedEntities = [...entities].sort((a, b) => b.name.length - a.name.length)
  const pattern = sortedEntities.map((e) => e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = new RegExp(`(${pattern})`, 'g')

  const parts = content.split(regex)

  return (
    <div className="text-sm whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        const entity = sortedEntities.find((e) => e.name === part)
        if (entity) {
          return (
            <mark
              key={i}
              className="rounded px-0.5 py-px font-medium cursor-pointer transition-opacity hover:opacity-80"
              style={{
                backgroundColor: `${typeColors[entity.type]}33`,
                color: typeColors[entity.type],
              }}
              title={`${entity.type === 'character' ? '角色' : entity.type === 'item' ? '物品' : entity.type === 'location' ? '地点' : entity.type === 'faction' ? '势力' : entity.type} - 点击确认`}
            >
              {part}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </div>
  )
}

function EntityChips({ entities, onConfirm }: { entities?: ExtractedEntity[]; onConfirm?: (id: string) => void }) {
  if (!entities || entities.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {entities.map((entity) => (
        <button
          key={entity.id}
          onClick={() => onConfirm?.(entity.id)}
          className="transition-opacity hover:opacity-80"
          title={entity.confirmed ? '已确认' : '点击确认'}
        >
          <EntityTag type={entity.type} size="small" />
          <span className="text-xs ml-1" style={{ color: typeColors[entity.type] }}>
            {entity.name}
          </span>
        </button>
      ))}
    </div>
  )
}

function ChatBubble({ message, onEdit, onDelete, onConfirmEntity, index }: {
  message: ChatMessage
  onEdit?: (id: string, content: string) => void
  onDelete?: (id: string) => void
  onConfirmEntity?: (id: string) => void
  index: number
}) {
  const isAssistant = message.role === 'assistant'
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showActions, setShowActions] = useState(false)

  const handleSave = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit?.(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditContent(message.content)
    setIsEditing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{
        duration: 0.3,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-4`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`max-w-[70%] rounded-lg px-4 py-3 relative group ${
          isAssistant
            ? 'bg-[#0f1011] border border-[rgba(255,255,255,0.08)] text-[#f7f8f8]'
            : 'bg-[#5e6ad2] text-white'
        }`}
      >
        {/* Action buttons for user messages */}
        {!isAssistant && showActions && !isEditing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-8 right-0 flex gap-1"
          >
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 rounded bg-[#0f1011] border border-[rgba(255,255,255,0.08)] text-[#d0d6e0] hover:text-[#f7f8f8] transition-colors"
              title="编辑"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDelete?.(message.id)}
              className="p-1 rounded bg-[#0f1011] border border-[rgba(255,255,255,0.08)] text-[#d0d6e0] hover:text-[#c45c5c] transition-colors"
              title="删除"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </motion.div>
        )}

        <div className="flex items-start gap-2">
          {isAssistant && <Bot className="w-4 h-4 mt-0.5 text-[#5e6ad2] flex-shrink-0" />}
          {!isAssistant && <User className="w-4 h-4 mt-0.5 text-white flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full resize-none min-h-[60px] p-2 text-sm rounded bg-[rgba(0,0,0,0.3)] text-white border border-[rgba(255,255,255,0.1)] outline-none"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancel}
                    className="p-1 rounded text-[#d0d6e0] hover:text-[#f7f8f8] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleSave}
                    className="p-1 rounded text-[#7eb84a] hover:text-[#8ec95a] transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <HighlightedContent content={message.content} entities={message.entities} />
                {message.entities && message.entities.length > 0 && (
                  <EntityChips entities={message.entities} onConfirm={onConfirmEntity} />
                )}
              </>
            )}
            <div className="text-xs mt-1 flex items-center gap-1" style={{ color: isAssistant ? '#d0d6e0' : 'rgba(255,255,255,0.7)' }}>
              {new Date(message.createdAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {message.editedAt && (
                <span className="text-[10px] opacity-60">(已编辑)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex justify-start mb-4"
    >
      <div className="max-w-[70%] rounded-lg px-4 py-3 bg-[#0f1011] border border-[rgba(255,255,255,0.08)]">
        <div className="flex items-start gap-2">
          <Bot className="w-4 h-4 mt-0.5 text-[#5e6ad2] flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-[#f7f8f8]">
              {content}
              <span className="inline-block w-2 h-4 ml-1 rounded-sm animate-pulse"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  boxShadow: '0 0 8px rgba(94, 106, 210, 0.5)',
                }}
              />
            </div>
            <div className="text-xs text-[#d0d6e0] mt-1 flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5e6ad2] opacity-60"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#5e6ad2]"></span>
              </span>
              正在输入...
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* 装饰性背景光晕 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)' }}
        />
      </div>

      <motion.div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{
          backgroundColor: 'rgba(94, 106, 210, 0.08)',
          border: '1px solid rgba(94, 106, 210, 0.15)',
        }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <Sparkles className="w-9 h-9" style={{ color: 'var(--accent-primary)' }} />
        {/* 装饰性小点 */}
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
          style={{ backgroundColor: 'var(--accent-primary)', opacity: 0.4 }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.h2
        className="text-xl font-medium mb-3"
        style={{ color: 'var(--text-primary)' }}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        欢迎使用自动化写作软件
      </motion.h2>

      <motion.p
        className="max-w-md text-sm leading-relaxed mb-8"
        style={{ color: 'var(--text-secondary)' }}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        我将帮你创建一个精彩的网络小说项目。首先，请告诉我你的故事属于什么类型？
      </motion.p>

      <motion.div
        className="flex flex-wrap justify-center gap-2.5"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {['玄幻修仙', '都市异能', '悬疑推理', '言情', '科幻未来', '历史穿越'].map((tag, i) => (
          <motion.button
            key={tag}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm cursor-pointer"
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            whileHover={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.12)',
              color: 'var(--text-primary)',
              y: -1,
            }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 + i * 0.06, duration: 0.3 }}
          >
            <MessageSquareText className="w-3.5 h-3.5 opacity-60" />
            {tag}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  )
}

export function AIGuidePanel() {
  const { messages, isStreaming, currentStreamContent, isLoading, editMessage, deleteMessage, confirmEntity, extractEntitiesFromMessage } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, currentStreamContent])

  // Extract entities from new assistant messages
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.role === 'assistant' && !msg.entities) {
        extractEntitiesFromMessage(msg.id)
      }
    })
  }, [messages, extractEntitiesFromMessage])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-4 bg-[#08090a]">
      {messages.length === 0 && !isStreaming && (
        <EmptyState />
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg, index) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            index={index}
            onEdit={editMessage}
            onDelete={deleteMessage}
            onConfirmEntity={confirmEntity}
          />
        ))}
      </AnimatePresence>

      {isStreaming && currentStreamContent && (
        <StreamingBubble content={currentStreamContent} />
      )}

      {isLoading && !isStreaming && (
        <TypingIndicator />
      )}
    </div>
  )
}

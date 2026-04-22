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

/* ============================================================
   TYPING EFFECT HOOK
   ============================================================ */

function useTypingEffect(text: string, speed: number = 18, enabled: boolean = true) {
  const [displayed, setDisplayed] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const indexRef = useRef(0)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text)
      setIsComplete(true)
      return
    }
    setDisplayed('')
    setIsComplete(false)
    indexRef.current = 0

    let lastTime = 0
    const tick = (time: number) => {
      if (time - lastTime >= speed) {
        lastTime = time
        indexRef.current += 1
        setDisplayed(text.slice(0, indexRef.current))
        if (indexRef.current >= text.length) {
          setIsComplete(true)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [text, speed, enabled])

  return { displayed, isComplete }
}

/* ============================================================
   HIGHLIGHTED CONTENT (with entity colors)
   ============================================================ */

function HighlightedContent({ content, entities }: { content: string; entities?: ExtractedEntity[] }) {
  if (!entities || entities.length === 0) {
    return <div className="text-sm whitespace-pre-wrap leading-relaxed">{content}</div>
  }

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

/* ============================================================
   ENTITY CHIPS
   ============================================================ */

function EntityChips({ entities, onConfirm }: { entities?: ExtractedEntity[]; onConfirm?: (id: string) => void }) {
  if (!entities || entities.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {entities.map((entity, i) => (
        <motion.button
          key={entity.id}
          onClick={() => onConfirm?.(entity.id)}
          className="transition-opacity hover:opacity-80 flex items-center gap-1"
          title={entity.confirmed ? '已确认' : '点击确认'}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
        >
          <EntityTag type={entity.type} size="small" />
          <span className="text-xs" style={{ color: typeColors[entity.type] }}>
            {entity.name}
          </span>
        </motion.button>
      ))}
    </div>
  )
}

/* ============================================================
   AI AVATAR with breathing animation
   ============================================================ */

function AIAvatar({ isThinking = false }: { isThinking?: boolean }) {
  return (
    <motion.div
      className="relative flex-shrink-0"
      animate={isThinking ? {
        scale: [1, 1.08, 1],
      } : {
        scale: [1, 1.02, 1],
      }}
      transition={isThinking ? {
        duration: 1.2,
        repeat: Infinity,
        ease: 'easeInOut',
      } : {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {/* Glow ring when thinking */}
      <AnimatePresence>
        {isThinking && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(94,106,210,0.4) 0%, transparent 70%)',
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0.7, 0.4] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
      {/* Secondary pulse ring */}
      <AnimatePresence>
        {isThinking && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(94,106,210,0.2) 0%, transparent 70%)',
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 2, 1], opacity: [0.2, 0.4, 0.2] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          />
        )}
      </AnimatePresence>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center relative z-10"
        style={{
          backgroundColor: 'rgba(94, 106, 210, 0.15)',
          border: '1px solid rgba(94, 106, 210, 0.25)',
          boxShadow: isThinking ? '0 0 20px rgba(94, 106, 210, 0.3)' : 'none',
        }}
      >
        <Bot className="w-4.5 h-4.5" style={{ color: 'var(--accent-primary)' }} />
      </div>
    </motion.div>
  )
}

/* ============================================================
   MESSAGE STATUS INDICATOR
   ============================================================ */

function MessageStatus({ status, timestamp }: { status?: 'sending' | 'sent' | 'error'; timestamp: Date }) {
  return (
    <div className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
      {timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
      {status === 'sending' && (
        <motion.span
          className="inline-block w-1 h-1 rounded-full bg-[var(--accent-primary)]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      {status === 'error' && (
        <span className="text-[var(--color-danger)] text-[10px]">发送失败</span>
      )}
    </div>
  )
}

/* ============================================================
   CHAT BUBBLE
   ============================================================ */

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
  const isLatest = index === 0 // assuming reverse order or adjust as needed

  // Only apply typing effect to latest assistant message
  const { displayed, isComplete } = useTypingEffect(
    message.content,
    16,
    isAssistant && isLatest && !message.editedAt
  )

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
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{
        duration: 0.4,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-5`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex gap-3 max-w-[75%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          {isAssistant ? (
            <AIAvatar />
          ) : (
            <motion.div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(94, 106, 210, 0.7)',
                boxShadow: '0 2px 8px rgba(94, 106, 210, 0.3)',
              }}
              whileHover={{ scale: 1.1, boxShadow: '0 4px 12px rgba(94, 106, 210, 0.4)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <User className="w-4 h-4 text-white" />
            </motion.div>
          )}
        </div>

        {/* Bubble */}
        <div className="relative">
          <motion.div
            className={`rounded-2xl px-4 py-3 relative ${
              isAssistant
                ? 'bg-[#0f1011] border border-[rgba(255,255,255,0.08)] text-[#f7f8f8]'
                : 'bg-[#5e6ad2] text-white'
            }`}
            initial={{ borderRadius: isAssistant ? '4px 16px 16px 16px' : '16px 4px 16px 16px', scale: 0.95, opacity: 0 }}
            animate={{ borderRadius: isAssistant ? '16px 16px 16px 4px' : '16px 16px 4px 16px', scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
          >
            {/* Action buttons for user messages */}
            <AnimatePresence>
              {!isAssistant && showActions && !isEditing && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute -top-9 right-0 flex gap-1"
                >
                  <motion.button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg bg-[#0f1011] border border-[rgba(255,255,255,0.08)] text-[#d0d6e0] hover:text-[#f7f8f8] transition-colors shadow-lg"
                    title="编辑"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Pencil className="w-3 h-3" />
                  </motion.button>
                  <motion.button
                    onClick={() => onDelete?.(message.id)}
                    className="p-1.5 rounded-lg bg-[#0f1011] border border-[rgba(255,255,255,0.08)] text-[#d0d6e0] hover:text-[#c45c5c] transition-colors shadow-lg"
                    title="删除"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content */}
            <div className="min-w-0">
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full resize-none min-h-[60px] p-2 text-sm rounded bg-[rgba(0,0,0,0.3)] text-white border border-[rgba(255,255,255,0.1)] outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <motion.button
                      onClick={handleCancel}
                      className="p-1.5 rounded text-[#d0d6e0] hover:text-[#f7f8f8] transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </motion.button>
                    <motion.button
                      onClick={handleSave}
                      className="p-1.5 rounded text-[#7eb84a] hover:text-[#8ec95a] transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </div>
              ) : (
                <>
                  <HighlightedContent
                    content={isAssistant && !isComplete ? displayed : message.content}
                    entities={message.entities}
                  />
                  {/* Typing cursor for assistant */}
                  {isAssistant && !isComplete && (
                    <motion.span
                      className="inline-block w-2 h-4 ml-0.5 rounded-sm align-middle"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        boxShadow: '0 0 8px rgba(94, 106, 210, 0.5)',
                      }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                  {message.entities && message.entities.length > 0 && (
                    <EntityChips entities={message.entities} onConfirm={onConfirmEntity} />
                  )}
                </>
              )}
            </div>
          </motion.div>

          {/* Timestamp */}
          <div className={`mt-1 ${isAssistant ? 'ml-1' : 'mr-1 text-right'}`}>
            <MessageStatus timestamp={new Date(message.createdAt)} />
            {message.editedAt && (
              <span className="text-[10px] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                (已编辑)
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================
   STREAMING BUBBLE
   ============================================================ */

function StreamingBubble({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex justify-start mb-5"
    >
      <div className="flex gap-3 max-w-[75%]">
        <div className="flex-shrink-0 mt-1">
          <AIAvatar isThinking />
        </div>
        <div>
          <motion.div
            className="rounded-2xl px-4 py-3 bg-[#0f1011] border border-[rgba(255,255,255,0.08)]"
            initial={{ borderRadius: '4px 16px 16px 16px' }}
            animate={{ borderRadius: '16px 16px 16px 4px' }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-[#f7f8f8]">
              {content}
              <motion.span
                className="inline-block w-2 h-4 ml-0.5 rounded-sm align-middle"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  boxShadow: '0 0 8px rgba(94, 106, 210, 0.5)',
                }}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            </div>
          </motion.div>
          <div className="mt-1 ml-1 flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5e6ad2] opacity-60"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#5e6ad2]"></span>
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>正在输入...</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================
   EMPTY STATE
   ============================================================ */

function EmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6 relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Decorative background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', opacity: 0.03 }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Main icon */}
      <motion.div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{
          backgroundColor: 'rgba(94, 106, 210, 0.08)',
          border: '1px solid rgba(94, 106, 210, 0.15)',
        }}
        initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <Sparkles className="w-9 h-9" style={{ color: 'var(--accent-primary)' }} />
        {/* Decorative dots */}
        <motion.div
          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full"
          style={{ backgroundColor: 'var(--accent-primary)', opacity: 0.5 }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full"
          style={{ backgroundColor: 'var(--color-character)', opacity: 0.4 }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
      </motion.div>

      <motion.h2
        className="text-xl font-medium mb-3"
        style={{ color: 'var(--text-primary)' }}
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        欢迎使用自动化写作软件
      </motion.h2>

      <motion.p
        className="max-w-md text-sm leading-relaxed mb-8"
        style={{ color: 'var(--text-secondary)' }}
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        我将帮你创建一个精彩的网络小说项目。首先，请告诉我你的故事属于什么类型？
      </motion.p>

      <motion.div
        className="flex flex-wrap justify-center gap-2.5"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {['玄幻修仙', '都市异能', '悬疑推理', '言情', '科幻未来', '历史穿越'].map((tag, i) => (
          <motion.button
            key={tag}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm cursor-pointer"
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            whileHover={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.12)',
              color: 'var(--text-primary)',
              y: -2,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
            whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 + i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <MessageSquareText className="w-3.5 h-3.5 opacity-60" />
            {tag}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  )
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

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
    <div ref={scrollRef} className="h-full overflow-y-auto p-4" style={{ backgroundColor: '#08090a' }}>
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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <TypingIndicator />
        </motion.div>
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useChatStore, ChatMessage, ExtractedEntity } from '@/store'
import { Bot, User, Pencil, Trash2, Check, X, Sparkles, MessageSquareText, Wand2 } from 'lucide-react'
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
    return <div className="text-sm whitespace-pre-wrap leading-relaxed text-primary">{content}</div>
  }

  const sortedEntities = [...entities].sort((a, b) => b.name.length - a.name.length)
  const pattern = sortedEntities.map((e) => e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = new RegExp(`(${pattern})`, 'g')
  const parts = content.split(regex)

  return (
    <div className="text-sm whitespace-pre-wrap leading-relaxed text-primary">
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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04, duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.95 }}
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
   AI AVATAR with subtle breathing animation
   ============================================================ */

function AIAvatar({ isThinking = false }: { isThinking?: boolean }) {
  return (
    <motion.div
      className="relative flex-shrink-0"
      animate={isThinking ? {
        scale: [1, 1.05, 1],
      } : {
        scale: [1, 1.02, 1],
      }}
      transition={isThinking ? {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      } : {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {/* Single subtle glow ring when thinking */}
      <AnimatePresence>
        {isThinking && (
          <motion.div
            className="absolute inset-0 rounded-full bg-accent-muted/30"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
      {/* Subtle ambient glow for idle state */}
      {!isThinking && (
        <motion.div
          className="absolute inset-0 rounded-full bg-accent-muted/20"
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center relative z-10
                   bg-accent-muted border border-border-focus"
        style={{
          boxShadow: isThinking ? 'var(--shadow-glow)' : 'var(--shadow-glow-sm)',
        }}
      >
        <Bot className="w-5 h-5 text-accent-primary" />
      </div>
    </motion.div>
  )
}

/* ============================================================
   MESSAGE STATUS INDICATOR
   ============================================================ */

function MessageStatus({ status, timestamp }: { status?: 'sending' | 'sent' | 'error'; timestamp: Date }) {
  return (
    <div className="text-xs mt-1 flex items-center gap-1 text-secondary">
      {timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
      {status === 'sending' && (
        <motion.span
          className="inline-block w-1 h-1 rounded-full bg-accent-primary"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
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
  const isLatest = index === 0

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
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.4, 0, 0.2, 1],
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
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center transition-shadow hover:shadow-md
                         bg-accent-primary shadow-glow-sm"
            >
              <User className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* Bubble */}
        <div className="relative">
          <div
            className={`rounded-2xl px-4 py-3.5 relative transition-shadow hover:shadow-md ${
              isAssistant
                ? 'bg-surface-raised border border-default text-primary'
                : 'bg-accent-primary text-white'
            }`}
            style={{
              borderRadius: isAssistant ? '20px 20px 20px 4px' : '20px 20px 4px 20px',
            }}
          >
            {/* Action buttons for user messages */}
            <AnimatePresence>
              {!isAssistant && showActions && !isEditing && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute -top-9 right-0 flex gap-1"
                >
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg bg-surface-base border border-default text-secondary
                               hover:text-primary transition-colors shadow-lg hover:shadow-xl"
                    title="编辑"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete?.(message.id)}
                    className="p-1.5 rounded-lg bg-surface-base border border-default text-secondary
                               hover:text-[var(--color-vermillion)] transition-colors shadow-lg hover:shadow-xl"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
                    className="w-full resize-none min-h-[60px] p-2 text-sm rounded bg-surface-base text-primary
                               border border-default outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleCancel}
                      className="p-1.5 rounded text-secondary hover:text-primary transition-colors hover:bg-white/5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleSave}
                      className="p-1.5 rounded text-[var(--color-ifline)] hover:text-[var(--color-success)] transition-colors hover:bg-white/5"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
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
                      className="inline-block w-2 h-4 ml-0.5 rounded-sm align-middle bg-accent-primary"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                  {message.entities && message.entities.length > 0 && (
                    <EntityChips entities={message.entities} onConfirm={onConfirmEntity} />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Timestamp */}
          <div className={`mt-1 ${isAssistant ? 'ml-1' : 'mr-1 text-right'}`}>
            <MessageStatus timestamp={new Date(message.createdAt)} />
            {message.editedAt && (
              <span className="text-[10px] opacity-50 text-secondary">
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
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="flex justify-start mb-5"
    >
      <div className="flex gap-3 max-w-[75%]">
        <div className="flex-shrink-0 mt-1">
          <AIAvatar isThinking />
        </div>
        <div>
          <div
            className="rounded-2xl px-4 py-3.5 bg-surface-raised border border-default"
            style={{ borderRadius: '20px 20px 20px 4px' }}
          >
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-primary">
              {content}
              <motion.span
                className="inline-block w-2 h-4 ml-0.5 rounded-sm align-middle bg-accent-primary"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </div>
          <div className="mt-1 ml-1 flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-60"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-primary"></span>
            </span>
            <span className="text-xs text-secondary">正在输入...</span>
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Main icon */}
      <motion.div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-6
                   bg-accent-muted border border-border-focus shadow-glow-sm"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <Sparkles className="w-9 h-9 text-accent-primary" />
        {/* Single decorative dot */}
        <motion.div
          className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-accent-primary opacity-40"
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.h2
        className="text-xl font-medium mb-3 text-primary"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        欢迎使用自动化写作软件
      </motion.h2>

      <motion.div
        className="flex items-center gap-2 mb-6"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-default" />
        <span className="text-xs flex items-center gap-1.5 text-tertiary">
          <Wand2 className="w-3 h-3" />
          选择下方标签快速开始，或直接输入你的想法
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-default" />
      </motion.div>

      <motion.div
        className="flex flex-wrap justify-center gap-2.5"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {['玄幻修仙', '都市异能', '悬疑推理', '言情', '科幻未来', '历史穿越'].map((tag, i) => (
          <motion.button
            key={tag}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm cursor-pointer transition-all
                       bg-surface-base border border-default text-secondary"
            whileHover={{
              backgroundColor: 'var(--color-surface-raised)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
              y: -1,
              boxShadow: 'var(--shadow-elevated)',
            }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.04, duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
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

  // Determine typing indicator state:
  // Show when loading (waiting for AI response) but NOT when streaming (content already arriving)
  const showTypingIndicator = isLoading && !isStreaming && messages.length > 0

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-4 bg-ink-gradient">
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

      {showTypingIndicator && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <TypingIndicator />
        </motion.div>
      )}
    </div>
  )
}

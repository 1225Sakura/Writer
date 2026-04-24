import { useState, useEffect, useRef } from 'react'
import { useChatStore, ChatMessage, ExtractedEntity } from '@/store'
import { Bot, User, Pencil, Trash2, Check, X, Sparkles, MessageSquareText, Wand2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TypingIndicator } from './TypingIndicator'
import { EntityTag } from './EntityTag'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { ChatSkeleton } from '@/components/shared/SmartSkeleton'

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
   TYPING EFFECT HOOK — Optimized to prevent re-init on parent re-render
   ============================================================ */

function useTypingEffect(text: string, speed: number = 18, enabled: boolean = true) {
  const [displayed, setDisplayed] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const indexRef = useRef(0)
  const rafRef = useRef<number>()
  const textRef = useRef(text)

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text)
      setIsComplete(true)
      textRef.current = text
      return
    }

    // Only reset if text content actually changed
    const textChanged = textRef.current !== text
    if (textChanged) {
      setDisplayed('')
      setIsComplete(false)
      indexRef.current = 0
      textRef.current = text
    }

    let lastTime = 0
    const tick = (time: number) => {
      if (time - lastTime >= speed) {
        lastTime = time
        indexRef.current += 1
        setDisplayed(textRef.current.slice(0, indexRef.current))
        if (indexRef.current >= textRef.current.length) {
          setIsComplete(true)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    // Only start RAF if not complete
    if (indexRef.current < text.length || textChanged) {
      rafRef.current = requestAnimationFrame(tick)
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
   AI AVATAR with breathing animation
   ============================================================ */

function AIAvatar({ isThinking = false }: { isThinking?: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      className="relative flex-shrink-0"
      animate={isThinking && !prefersReducedMotion ? {
        scale: [1, 1.05, 1],
      } : undefined}
      transition={prefersReducedMotion ? { duration: 0 } : isThinking ? {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      } : {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <AnimatePresence>
        {isThinking && (
          <motion.div
            className="absolute inset-0 rounded-full bg-accent-muted/30"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={prefersReducedMotion ? {} : { scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
      {!isThinking && (
        <motion.div
          className="absolute inset-0 rounded-full bg-accent-muted/20"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
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
  const getRelativeTime = (date: Date) => {
    const now = Date.now()
    const diff = now - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-secondary/70">
      <span>{getRelativeTime(timestamp)}</span>
      {status === 'sending' && (
        <motion.span
          className="inline-flex items-center gap-1 text-accent-primary/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="w-1 h-1 rounded-full bg-accent-primary/60" />
          <span className="text-[10px]">发送中</span>
        </motion.span>
      )}
      {status === 'sent' && (
        <motion.span
          className="text-[var(--color-success)]/60"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Check className="w-3 h-3" />
        </motion.span>
      )}
      {status === 'error' && (
        <motion.span
          className="text-[var(--color-danger)]/80 text-[10px] flex items-center gap-0.5"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <X className="w-3 h-3" />
          <span>发送失败</span>
        </motion.span>
      )}
    </div>
  )
}

/* ============================================================
   CHAT BUBBLE with staggered slide-up entrance
   ============================================================ */

interface ChatBubbleProps {
  message: ChatMessage
  onEdit?: (id: string, content: string) => void
  onDelete?: (id: string) => void
  onConfirmEntity?: (id: string) => void
  index: number
  isGrouped?: boolean
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
}

function ChatBubble({ message, onEdit, onDelete, onConfirmEntity, index, isGrouped = false, isFirstInGroup = true }: ChatBubbleProps) {
  const isAssistant = message.role === 'assistant'
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showActions, setShowActions] = useState(false)
  const isLatest = index === 0
  const prefersReducedMotion = usePrefersReducedMotion()

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

  // Different glow colors for AI vs user messages
  const bubbleGlowColor = isAssistant
    ? 'rgba(94, 106, 210, 0.15)'
    : 'rgba(94, 106, 210, 0.25)'

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
      transition={
        prefersReducedMotion
          ? { duration: 0.15 }
          : {
              type: 'spring',
              stiffness: 400,
              damping: 30,
              delay: Math.min(index * 0.06, 0.2),
            }
      }
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} ${isGrouped && !isFirstInGroup ? 'mb-1' : 'mb-5'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex gap-3 max-w-[80%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Avatar - only show for first message in group */}
        <motion.div
          className="flex-shrink-0 mt-1"
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          style={{ visibility: isFirstInGroup ? 'visible' : 'hidden', width: isFirstInGroup ? 'auto' : '32px' }}
        >
          {isAssistant ? (
            <AIAvatar />
          ) : (
            <motion.div
              className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-primary shadow-glow-sm"
              whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
            >
              <User className="w-4 h-4 text-white" />
            </motion.div>
          )}
        </motion.div>

        {/* Bubble */}
        <div className="relative">
          <motion.div
            className={`relative px-4 py-3.5 transition-all duration-200 ${
              isAssistant
                ? `bg-surface-raised text-primary ${isFirstInGroup ? 'rounded-2xl rounded-tl-2xl rounded-tr-lg rounded-bl-md rounded-br-lg' : 'rounded-lg rounded-tl-md rounded-tr-lg rounded-bl-md rounded-br-lg'}`
                : `bg-accent-primary text-white ${isFirstInGroup ? 'rounded-2xl rounded-tl-lg rounded-tr-2xl rounded-bl-lg rounded-br-md' : 'rounded-lg rounded-tl-lg rounded-tr-md rounded-bl-lg rounded-br-md'}`
            }`}
            style={{
              boxShadow: isAssistant
                ? `0 2px 8px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px ${bubbleGlowColor}`
                : `0 2px 8px rgba(94,106,210,0.25), 0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 24px ${bubbleGlowColor}`,
            }}
            whileHover={prefersReducedMotion ? {} : { scale: 1.01, y: -1 }}
          >
            {/* Accent border for AI messages */}
            {isAssistant && (
              <motion.div
                className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-gradient-to-b from-accent-primary/60 via-accent-primary to-accent-primary/30"
                initial={prefersReducedMotion ? {} : { scaleY: 0, originY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              />
            )}

            {/* Action buttons for user messages */}
            <AnimatePresence>
              {!isAssistant && showActions && !isEditing && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.9 }}
                  transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute -top-10 right-0 flex gap-1.5 bg-surface-raised/95 backdrop-blur-sm rounded-xl p-1.5 shadow-lg border border-border-default/50"
                >
                  <motion.button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-white/10 transition-all duration-150"
                    title="编辑"
                    whileHover={prefersReducedMotion ? {} : { y: -1 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.button
                    onClick={() => onDelete?.(message.id)}
                    className="p-1.5 rounded-lg text-secondary hover:text-[var(--color-vermillion)] hover:bg-white/10 transition-all duration-150"
                    title="删除"
                    whileHover={prefersReducedMotion ? {} : { y: -1 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content */}
            <div className="min-w-0">
              {isEditing ? (
                <motion.div
                  className="flex flex-col gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full resize-none min-h-[60px] p-2.5 text-sm rounded-lg bg-surface-base/80 text-primary
                               border border-border-focus outline-none focus:ring-2 focus:ring-accent-primary/30 transition-all"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <motion.button
                      onClick={handleCancel}
                      className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-white/10 transition-colors"
                      whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </motion.button>
                    <motion.button
                      onClick={handleSave}
                      className="p-1.5 rounded-lg text-[var(--color-ifline)] hover:text-[var(--color-success)] hover:bg-white/10 transition-colors"
                      whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <>
                  <HighlightedContent
                    content={isAssistant && !isComplete ? displayed : message.content}
                    entities={message.entities}
                  />
                  {isAssistant && !isComplete && (
                    <motion.span
                      className="inline-block w-2 h-4 ml-1 rounded-sm align-middle bg-accent-primary"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
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
          <motion.div
            className={`mt-1.5 ${isAssistant ? 'ml-1' : 'mr-1 text-right'}`}
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.2 }}
          >
            <MessageStatus timestamp={new Date(message.createdAt)} />
            {message.editedAt && (
              <motion.span
                className="text-[10px] opacity-50 text-secondary ml-1.5 italic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
              >
                (已编辑)
              </motion.span>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================
   STREAMING BUBBLE
   ============================================================ */

function StreamingBubble({ content }: { content: string }) {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
      transition={prefersReducedMotion ? { duration: 0.15 } : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="flex justify-start mb-5"
    >
      <div className="flex gap-3 max-w-[80%]">
        <motion.div
          className="flex-shrink-0 mt-1"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <AIAvatar isThinking />
        </motion.div>
        <div className="relative">
          <motion.div
            className="relative px-4 py-3.5 bg-surface-raised rounded-2xl rounded-tl-2xl rounded-tr-lg rounded-bl-md rounded-br-lg overflow-hidden"
            style={{
              boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1), 0 0 20px rgba(94, 106, 210, 0.12)',
            }}
          >
            <motion.div
              className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent-primary via-accent-primary to-transparent"
              animate={prefersReducedMotion ? {} : { opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-primary">
              {content}
              <motion.span
                className="inline-block w-2 h-4 ml-1 rounded-sm align-middle bg-accent-primary"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
          <motion.div
            className="mt-1.5 ml-1 flex items-center gap-2"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <span className="relative flex h-2 w-2">
              <motion.span
                className="absolute inline-flex h-full w-full rounded-full bg-accent-primary"
                animate={prefersReducedMotion ? {} : {
                  scale: [1, 1.8, 1],
                  opacity: [0.4, 0, 0.4],
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-primary" />
            </span>
            <span className="text-xs text-secondary/70">AI 正在输入</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================
   EMPTY STATE
   ============================================================ */

function EmptyState() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6 relative"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0.2 } : { duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-6
                   bg-accent-muted border border-border-focus"
        style={{
          boxShadow: '0 0 20px rgba(94, 106, 210, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.15 } : { delay: 0.1, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <Sparkles className="w-9 h-9 text-accent-primary" />
        {!prefersReducedMotion && (
          <motion.div
            className="absolute -inset-1 rounded-2xl border border-accent-primary/20"
            animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <motion.div
          className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-accent-primary"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.h2
        className="text-xl font-medium mb-3 text-primary"
        initial={prefersReducedMotion ? {} : { y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.1 } : { delay: 0.15, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        欢迎使用自动化写作软件
      </motion.h2>

      <motion.div
        className="inline-flex items-center gap-2 mb-6"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.1 } : { delay: 0.2, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-strong to-transparent" />
        <span className="inline-flex items-center gap-1.5 text-xs text-tertiary">
          <span className="flex-shrink-0"><Wand2 className="w-3 h-3" /></span>
          <span>选择下方标签快速开始，或直接输入你的想法</span>
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border-strong to-transparent" />
      </motion.div>

      <motion.div
        className="flex flex-wrap justify-center gap-2.5"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.1 } : { delay: 0.25, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {['玄幻修仙', '都市异能', '悬疑推理', '言情', '科幻未来', '历史穿越'].map((tag, i) => (
          <motion.button
            key={tag}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm cursor-pointer transition-all
                       bg-surface-base border border-default text-secondary"
            style={{ whiteSpace: 'nowrap' }}
            whileHover={prefersReducedMotion ? {} : {
              backgroundColor: 'var(--color-surface-raised)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
              y: -2,
              boxShadow: 'var(--shadow-elevated)',
            }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0.1 } : { delay: 0.3 + i * 0.04, duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <span className="flex-shrink-0"><MessageSquareText className="w-3.5 h-3.5 opacity-60" /></span>
            <span>{tag}</span>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  )
}

/* ============================================================
   CHAT AREA - Main component
   ============================================================ */

export function ChatArea() {
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

  const showTypingIndicator = isLoading && !isStreaming && messages.length > 0

  return (
    <motion.div
      className="flex-1 flex flex-col min-w-0"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex-1 overflow-hidden relative">
        {isLoading && messages.length === 0 ? (
          <div className="h-full overflow-y-auto p-4">
            <ChatSkeleton count={3} />
          </div>
        ) : (
          <div ref={scrollRef} className="h-full overflow-y-auto p-4 bg-ink-gradient">
            {messages.length === 0 && !isStreaming && (
              <EmptyState />
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg, index) => {
                // Determine message grouping
                const prevMsg = index > 0 ? messages[index - 1] : null
                const nextMsg = index < messages.length - 1 ? messages[index + 1] : null
                const isGrouped = prevMsg?.role === msg.role
                const isFirstInGroup = prevMsg?.role !== msg.role
                const isLastInGroup = nextMsg?.role !== msg.role

                return (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    index={index}
                    onEdit={editMessage}
                    onDelete={deleteMessage}
                    onConfirmEntity={confirmEntity}
                    isGrouped={isGrouped}
                    isFirstInGroup={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                  />
                )
              })}
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
        )}
      </div>
    </motion.div>
  )
}

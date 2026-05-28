/**
 * ChatBubble - Message bubble components for ChatArea
 *
 * Contains ChatBubble and StreamingBubble.
 * Helper components imported from MessageBubble.tsx.
 */

import { useState } from 'react'
import type { ChatMessage } from '@/store'
import { Pencil, Trash2, Check, X, User, RotateCcw } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import {
  useTypingEffect,
  HighlightedContent,
  EntityChips,
  AIAvatar,
  MessageStatus,
} from './MessageBubble'

/* ============================================================
   CHAT BUBBLE
   ============================================================ */

export interface ChatBubbleProps {
  message: ChatMessage
  onEdit?: (id: string, content: string) => void
  onDelete?: (id: string) => void
  onRetry?: (id: string) => void
  onConfirmEntity?: (id: string) => void
  index: number
  isGrouped?: boolean
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
}

export function ChatBubble({ message, onEdit, onDelete, onRetry, onConfirmEntity, index, isGrouped = false, isFirstInGroup = true }: ChatBubbleProps) {
  const isAssistant = message.role === 'assistant'
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showActions, setShowActions] = useState(false)
  const isLatest = index === 0
  const prefersReducedMotion = usePrefersReducedMotion()

  const { displayed, isComplete } = useTypingEffect(
    message.content,
    16,
    isAssistant && isLatest && !message.editedAt,
    message.id
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
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
      transition={
        prefersReducedMotion
          ? { duration: 0.15 }
          : {
              type: 'spring',
              stiffness: 350,
              damping: 30,
              delay: Math.min(index * 0.05, 0.2),
            }
      }
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} ${isGrouped && !isFirstInGroup ? 'mb-2' : 'mb-5'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex gap-3 max-w-[85%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Avatar */}
        <motion.div
          className="flex-shrink-0 mt-0.5"
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.2) + 0.1 }}
          style={{ visibility: isFirstInGroup ? 'visible' : 'hidden', width: isFirstInGroup ? 'auto' : '36px' }}
        >
          {isAssistant ? (
            <AIAvatar />
          ) : (
            <motion.div
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-accent-primary to-accent-primary/70"
              style={{
                boxShadow: '0 4px 14px color-mix(in srgb, var(--accent-primary) 30%, transparent)',
              }}
              whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.94 }}
            >
              <Icon icon={User} size="sm" className="text-white" />
            </motion.div>
          )}
        </motion.div>

        {/* Bubble */}
        <div className="relative">
          <GlassCard
            intensity={isAssistant ? 'light' : 'medium'}
            border={isAssistant ? 'subtle' : 'none'}
            variant="default"
            rounded="2xl"
            padding="md"
            hover={false}
            className={`relative ${isAssistant ? 'rounded-tl-sm' : 'rounded-tr-sm'}`}
            style={{
              background: isAssistant
                ? 'var(--color-surface-raised)'
                : 'linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 85%, var(--accent-hover)))',
              color: isAssistant ? 'var(--text-primary)' : 'white',
              boxShadow: isAssistant
                ? 'var(--shadow-card)'
                : '0 4px 20px color-mix(in srgb, var(--accent-primary) 25%, transparent), 0 2px 8px color-mix(in srgb, var(--ink-100) 10%, transparent)',
            }}
          >
            {isAssistant && (
              <motion.div
                className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full"
                style={{
                  background: 'linear-gradient(180deg, transparent 0%, var(--accent-primary) 30%, color-mix(in srgb, var(--accent-primary) 60%, transparent) 70%, transparent 100%)',
                }}
                initial={prefersReducedMotion ? {} : { scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: DURATION.SLOW, delay: Math.min(index * 0.05, 0.2) + 0.15, ease: EASE.SMOOTH }}
              />
            )}

            {/* Action buttons for user messages */}
            <AnimatePresence>
              {!isAssistant && showActions && !isEditing && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.9 }}
                  transition={{ duration: DURATION.INSTANT, ease: EASE.STANDARD }}
                  className="absolute -top-10 right-0 flex gap-1.5 bg-surface-raised rounded-xl p-1.5 shadow-lg border border-border-default/50"
                >
                  <motion.button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-white/10 transition-all duration-150"
                    aria-label="编辑消息"
                    title="编辑"
                    whileHover={prefersReducedMotion ? {} : { y: -1 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                  >
                    <Icon icon={Pencil} size="xs" />
                  </motion.button>
                  <motion.button
                    onClick={() => onDelete?.(message.id)}
                    className="p-1.5 rounded-lg text-secondary hover:text-[var(--color-vermillion)] hover:bg-white/10 transition-all duration-150"
                    aria-label="删除消息"
                    title="删除"
                    whileHover={prefersReducedMotion ? {} : { y: -1 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                  >
                    <Icon icon={Trash2} size="xs" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content */}
            <div className="min-w-0">
              {isEditing ? (
                <motion.div className="flex flex-col gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full resize-none min-h-[60px] p-2.5 text-sm rounded-lg bg-surface-base/80 text-primary
                               border border-border-focus outline-none focus:ring-2 focus:ring-accent-primary/30 transition-all"
                    aria-label="编辑消息内容"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <motion.button
                      onClick={handleCancel}
                      className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-white/10 transition-colors"
                      whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                      aria-label="取消编辑"
                    >
                      <Icon icon={X} size="xs" />
                    </motion.button>
                    <motion.button
                      onClick={handleSave}
                      className="p-1.5 rounded-lg text-[var(--color-ifline)] hover:text-[var(--color-success)] hover:bg-white/10 transition-colors"
                      whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                      aria-label="保存编辑"
                    >
                      <Icon icon={Check} size="xs" />
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
                      className="inline-flex items-center ml-1.5"
                      animate={prefersReducedMotion ? {} : { opacity: [0.4, 1, 0.4] }}
                      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-primary mr-0.5" />
                      <span className="w-1 h-1 rounded-full bg-accent-primary mr-0.5" />
                      <span className="w-1 h-1 rounded-full bg-accent-primary" />
                    </motion.span>
                  )}
                  {message.entities && message.entities.length > 0 && (
                    <EntityChips entities={message.entities} onConfirm={onConfirmEntity} />
                  )}
                </>
              )}
            </div>
          </GlassCard>

          {/* Timestamp */}
          <motion.div
            className={`mt-2 ${isAssistant ? 'ml-1' : 'mr-1 text-right'}`}
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.06, 0.25) + 0.15 }}
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

          {/* Retry button for failed messages */}
          {!isAssistant && message.failed && (
            <motion.div
              className={`mt-1.5 ${isAssistant ? 'ml-1' : 'mr-1 text-right'}`}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.button
                onClick={() => onRetry?.(message.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           text-[var(--color-vermillion)] bg-[var(--color-vermillion)]/10
                           hover:bg-[var(--color-vermillion)]/20 transition-all duration-150"
                aria-label="重试发送"
                title="重试"
                whileHover={prefersReducedMotion ? {} : { scale: 1.04 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
              >
                <Icon icon={RotateCcw} size="xs" />
                <span>发送失败，点击重试</span>
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// StreamingBubble re-exported from ChatStreamingBubble.tsx
export { StreamingBubble } from './ChatStreamingBubble'

/**
 * AIGuideBubble - Message bubble components for AIGuidePanel
 *
 * Contains ChatBubble and StreamingBubble for the AI guide panel.
 * Helper components imported from AIGuideMessageHelpers.tsx.
 */

import { useState } from 'react'
import type { ChatMessage } from '@/store'
import { Pencil, Trash2, User } from 'lucide-react'
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
} from './AIGuideMessageHelpers'

/* ============================================================
   CHAT BUBBLE
   ============================================================ */

export function ChatBubble({ message, onEdit, onDelete, onConfirmEntity, index }: {
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

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
      transition={
        prefersReducedMotion
          ? { duration: 0.15 }
          : {
              type: 'spring',
              stiffness: 400,
              damping: 30,
              delay: Math.min(index * 0.04, 0.15),
            }
      }
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-5`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex gap-3 max-w-[80%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Avatar */}
        <motion.div
          className="flex-shrink-0 mt-1"
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          {isAssistant ? (
            <AIAvatar />
          ) : (
            <motion.div
              className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-primary"
              style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--accent-primary) 30%, transparent)' }}
              whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
            >
              <User className="w-4 h-4 text-white" />
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
                ? '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.03)'
                : '0 4px 20px color-mix(in srgb, var(--accent-primary) 25%, transparent), 0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            {isAssistant && (
              <motion.div
                className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-gradient-to-b from-accent-primary/60 via-accent-primary to-accent-primary/30"
                initial={prefersReducedMotion ? {} : { scaleY: 0, originY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: DURATION.SLOW, delay: 0.15, ease: EASE.SMOOTH }}
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
                    <Pencil className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.button
                    onClick={() => onDelete?.(message.id)}
                    className="p-1.5 rounded-lg text-secondary hover:text-[var(--color-vermillion)] hover:bg-white/10 transition-all duration-150"
                    aria-label="删除消息"
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
                      <span className="w-3.5 h-3.5 block text-center text-xs">X</span>
                    </motion.button>
                    <motion.button
                      onClick={handleSave}
                      className="p-1.5 rounded-lg text-[var(--color-ifline)] hover:text-[var(--color-success)] hover:bg-white/10 transition-colors"
                      whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                      aria-label="保存编辑"
                    >
                      <span className="w-3.5 h-3.5 block text-center text-xs">OK</span>
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
                      animate={prefersReducedMotion ? {} : { opacity: [1, 0, 1] }}
                      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
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
            className={`mt-1.5 ${isAssistant ? 'ml-1' : 'mr-1 text-right'}`}
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.FAST, delay: 0.2, ease: EASE.SMOOTH }}
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

// StreamingBubble re-exported from AIGuideStreamingBubble.tsx
export { StreamingBubble } from './AIGuideStreamingBubble'

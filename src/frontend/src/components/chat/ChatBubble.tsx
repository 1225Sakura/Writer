/**
 * ChatBubble - Message bubble components for ChatArea
 *
 * Contains ChatBubble and StreamingBubble.
 * Helper components imported from MessageBubble.tsx.
 */

import { useState, useCallback } from 'react'
import type { ChatMessage } from '@/store'
import { Pencil, Trash2, Check, X, User, RotateCcw, Copy, ThumbsUp, ThumbsDown, Plus, GitBranch } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import type { ExtractedEntityLocal } from '@/store/chatStore'
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
  onRegenerate?: (id: string) => void
  onRate?: (id: string, rating: 'up' | 'down') => void
  onConfirmEntity?: (id: string) => void
  onBranch?: (id: string) => void
  index: number
  isGrouped?: boolean
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
}

const entityTypeOptions: { type: ExtractedEntityLocal['type']; label: string }[] = [
  { type: 'world', label: '世界观' },
  { type: 'character', label: '角色' },
  { type: 'item', label: '物品' },
  { type: 'location', label: '地点' },
  { type: 'faction', label: '势力' },
  { type: 'rule', label: '规则' },
  { type: 'ifline', label: 'IF线' },
]

export function ChatBubble({ message, onEdit, onDelete, onRetry, onRegenerate, onRate, onConfirmEntity, onBranch, index, isGrouped = false, isFirstInGroup = true }: ChatBubbleProps) {
  const isAssistant = message.role === 'assistant'
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showActions, setShowActions] = useState(false)
  const [showEntityTypeDialog, setShowEntityTypeDialog] = useState(false)
  const addExtractedEntity = useChatStore((state) => state.addExtractedEntity)
  const isLatest = index === 0
  const prefersReducedMotion = usePrefersReducedMotion()

  const handleCreateAsEntity = useCallback((type: ExtractedEntityLocal['type']) => {
    addExtractedEntity({
      type,
      name: message.content.slice(0, 30).replace(/[#\n]/g, ' ').trim() || '未命名实体',
      description: message.content,
      confirmed: false,
      sourceMessageId: message.id,
    })
    setShowEntityTypeDialog(false)
  }, [message.id, message.content, addExtractedEntity])

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

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).catch(() => {
      // Fallback: ignore clipboard errors
    })
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
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} ${isGrouped && !isFirstInGroup ? 'mb-[10px]' : 'mb-[18px]'}`}
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
        <div className="relative group">
          <motion.div
            whileHover={prefersReducedMotion ? {} : { scale: 1.002 }}
            transition={{ duration: DURATION.INSTANT, ease: EASE.SMOOTH }}
          >
          <GlassCard
            intensity={isAssistant ? 'light' : 'medium'}
            border={isAssistant ? 'subtle' : 'none'}
            variant="default"
            rounded="2xl"
            padding="md"
            hover={false}
            className={`relative ${isAssistant ? 'rounded-tl-sm' : 'rounded-tr-sm'} transition-shadow duration-200
                         hover:shadow-[0_6px_24px_color-mix(in_srgb,_var(--ink-100),_18%,_transparent),0_2px_8px_color-mix(in_srgb,_var(--ink-100),_8%,_transparent)]`}
            style={{
              background: isAssistant
                ? 'var(--color-surface-raised)'
                : 'linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 88%, var(--accent-hover)))',
              color: isAssistant ? 'var(--text-primary)' : 'white',
              boxShadow: isAssistant
                ? '0 2px 12px color-mix(in srgb, var(--ink-100) 8%, transparent), 0 1px 4px color-mix(in srgb, var(--ink-100) 4%, transparent)'
                : '0 4px 20px color-mix(in srgb, var(--accent-primary) 25%, transparent), 0 2px 8px color-mix(in srgb, var(--ink-100) 10%, transparent)',
              transition: 'box-shadow 0.2s ease',
            }}
          >
            {isAssistant && (
              <motion.div
                className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full"
                style={{
                  background: 'linear-gradient(180deg, transparent 0%, var(--accent-primary) 15%, color-mix(in srgb, var(--accent-primary) 70%, transparent) 50%, color-mix(in srgb, var(--accent-primary) 40%, transparent) 85%, transparent 100%)',
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
                    onClick={() => setShowEntityTypeDialog(true)}
                    className="p-1.5 rounded-lg text-secondary hover:text-[var(--color-ifline)] hover:bg-white/10 transition-all duration-150"
                    aria-label="创建为实体"
                    title="创建为实体"
                    whileHover={prefersReducedMotion ? {} : { y: -1 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                  >
                    <Icon icon={Plus} size="xs" />
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

            {/* Entity type selection dialog */}
            <AnimatePresence>
              {showEntityTypeDialog && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 4 }}
                  transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                  className="absolute -top-2 right-0 -translate-y-full z-50 bg-surface-raised rounded-xl p-2 shadow-lg border border-border-default/50 min-w-[140px]"
                >
                  <p className="text-[10px] text-tertiary px-2 pb-1.5 mb-1 border-b border-border-default/30">选择实体类型</p>
                  <div className="flex flex-col gap-0.5">
                    {entityTypeOptions.map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => handleCreateAsEntity(opt.type)}
                        className="w-full text-left px-2 py-1.5 text-xs rounded-lg text-primary hover:bg-surface-hover transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowEntityTypeDialog(false)}
                    className="w-full text-center text-[10px] text-tertiary mt-1 pt-1 border-t border-border-default/30 hover:text-primary transition-colors"
                  >
                    取消
                  </button>
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

            {/* Action buttons for AI messages */}
            {isAssistant && isComplete && (
              <div
                className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                role="toolbar"
                aria-label="消息操作"
              >
                <motion.button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-base/50 transition-colors"
                  aria-label="复制消息"
                  title="复制"
                  whileHover={prefersReducedMotion ? {} : { y: -1 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                >
                  <Icon icon={Copy} size="xs" />
                </motion.button>
                <motion.button
                  onClick={() => onRegenerate?.(message.id)}
                  className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-base/50 transition-colors"
                  aria-label="重新生成"
                  title="重新生成"
                  whileHover={prefersReducedMotion ? {} : { y: -1 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                >
                  <Icon icon={RotateCcw} size="xs" />
                </motion.button>
                <motion.button
                  onClick={() => onRate?.(message.id, 'up')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    message.rating === 'up'
                      ? 'text-[var(--color-ifline)]'
                      : 'text-secondary hover:text-primary hover:bg-surface-base/50'
                  }`}
                  aria-label="点赞"
                  title="点赞"
                  whileHover={prefersReducedMotion ? {} : { y: -1 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                >
                  <Icon icon={ThumbsUp} size="xs" />
                </motion.button>
                <motion.button
                  onClick={() => onRate?.(message.id, 'down')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    message.rating === 'down'
                      ? 'text-[var(--color-vermillion)]'
                      : 'text-secondary hover:text-primary hover:bg-surface-base/50'
                  }`}
                  aria-label="点踩"
                  title="点踩"
                  whileHover={prefersReducedMotion ? {} : { y: -1 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                >
                  <Icon icon={ThumbsDown} size="xs" />
                </motion.button>
                <motion.button
                  onClick={() => onBranch?.(message.id)}
                  className="p-1.5 rounded-lg text-secondary hover:text-[var(--color-ifline)] hover:bg-surface-base/50 transition-colors"
                  aria-label="分支对话"
                  title="分支对话"
                  whileHover={prefersReducedMotion ? {} : { y: -1 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                >
                  <Icon icon={GitBranch} size="xs" />
                </motion.button>
              </div>
            )}
          </GlassCard>
          </motion.div>

          {/* Timestamp */}
          <motion.div
            className={`mt-1 ${isAssistant ? 'ml-1' : 'mr-1 text-right'}`}
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

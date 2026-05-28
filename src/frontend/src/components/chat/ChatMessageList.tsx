/**
 * ChatMessageList - Message list with scroll container, empty state, and grouping
 *
 * Renders the scrollable message area with auto-scroll, empty state,
 * and message grouping logic.
 */

import { useRef, useEffect } from 'react'
import type { ChatMessage } from '@/store'
import { useChatStore } from '@/store/chatStore'
import { Sparkles, MessageSquareText, Wand2 } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { TypingIndicator } from './TypingIndicator'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { ChatBubble, StreamingBubble } from './ChatBubble'

/* ============================================================
   EMPTY STATE
   ============================================================ */

function EmptyState() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const setPendingInput = useChatStore((s) => s.setPendingInput)

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6 relative"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: DURATION.FAST } : { duration: DURATION.SLOW, ease: EASE.STANDARD }}
    >
      <motion.div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.FAST } : { delay: 0.1, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        <GlassCard
          intensity="medium"
          border="subtle"
          variant="elevated"
          rounded="2xl"
          padding="none"
          className="w-full h-full flex items-center justify-center"
        >
          <Icon icon={Sparkles} size="lg" color="accent" className="scale-150" />
        </GlassCard>
        {!prefersReducedMotion && (
          <motion.div
            className="absolute -inset-1 rounded-2xl border border-accent-primary/20"
            animate={{ scale: [1, 1.06, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <motion.div
          className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-accent-primary"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.h2
        className="text-xl font-medium mb-3 text-primary"
        initial={prefersReducedMotion ? {} : { y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.INSTANT } : { delay: 0.15, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        欢迎使用自动化写作软件
      </motion.h2>

      <motion.div
        className="inline-flex items-center gap-2 mb-6"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.INSTANT } : { delay: 0.2, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-strong to-transparent" />
        <span className="inline-flex items-center gap-1.5 text-xs text-tertiary">
          <span className="flex-shrink-0"><Icon icon={Wand2} size="xs" /></span>
          <span>选择下方标签快速开始，或直接输入你的想法</span>
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border-strong to-transparent" />
      </motion.div>

      <motion.div
        className="flex flex-wrap justify-center gap-2.5"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.INSTANT } : { delay: 0.25, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        {['玄幻修仙', '都市异能', '悬疑推理', '言情', '科幻未来', '历史穿越'].map((tag) => (
          <GlassCard
            key={tag}
            intensity="light"
            border="subtle"
            variant="default"
            rounded="xl"
            padding="sm"
            hover
            className="inline-flex items-center gap-1.5 text-sm cursor-pointer text-secondary hover:text-primary"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => setPendingInput(`我想写一本${tag}小说`)}
          >
            <span className="flex-shrink-0 opacity-60"><Icon icon={MessageSquareText} size="xs" /></span>
            <span>{tag}</span>
          </GlassCard>
        ))}
      </motion.div>
    </motion.div>
  )
}

/* ============================================================
   MESSAGE LIST
   ============================================================ */

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  currentStreamContent: string
  isLoading: boolean
  editMessage: (id: string, content: string) => void
  deleteMessage: (id: string) => void
  retryMessage: (id: string) => void
  confirmEntity: (id: string) => void
}

export function MessageList({
  messages,
  isStreaming,
  currentStreamContent,
  isLoading,
  editMessage,
  deleteMessage,
  retryMessage,
  confirmEntity,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, currentStreamContent])

  const showTypingIndicator = isLoading && !isStreaming && messages.length > 0

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto scrollbar-thin p-4 bg-ink-gradient" role="log" aria-live="polite" aria-label="聊天消息列表">
      {messages.length === 0 && !isStreaming && (
        <EmptyState />
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg, index) => {
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
              onRetry={retryMessage}
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
          transition={{ duration: DURATION.FAST, ease: EASE.STANDARD }}
        >
          <TypingIndicator />
        </motion.div>
      )}
    </div>
  )
}

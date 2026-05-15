/**
 * AIGuidePanel - AI guide panel for chat initialization
 *
 * Thin wrapper that composes ChatBubble, StreamingBubble, and AIGuideEmptyState.
 * Sub-modules:
 * - AIGuideBubble: Message bubble components and helpers
 * - AIGuideEmptyState: Empty state with tips section
 */

import { useRef, useEffect } from 'react'
import { useChatStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import { TypingIndicator } from './TypingIndicator'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

// Re-export sub-components for consumers
export { ChatBubble, StreamingBubble } from './AIGuideBubble'
export { useTypingEffect } from './AIGuideMessageHelpers'
export { AIGuideEmptyState } from './AIGuideEmptyState'

import { ChatBubble, StreamingBubble } from './AIGuideBubble'
import { AIGuideEmptyState } from './AIGuideEmptyState'

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

  const showTypingIndicator = isLoading && !isStreaming && messages.length > 0

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-4 bg-ink-gradient">
      {messages.length === 0 && !isStreaming && (
        <AIGuideEmptyState />
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
          transition={{ duration: DURATION.FAST, ease: EASE.STANDARD }}
        >
          <TypingIndicator />
        </motion.div>
      )}
    </div>
  )
}

/**
 * ChatArea - Main chat area component
 *
 * Thin wrapper that composes ChatBubble, StreamingBubble, and MessageList.
 * Sub-modules:
 * - ChatBubble: Message bubble components and helpers
 * - ChatMessageList: Message list with scroll, empty state, grouping
 */

import { useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { motion } from 'framer-motion'
import { ChatSkeleton } from '@/components/shared/SmartSkeleton'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

// Re-export sub-components for consumers
export { ChatBubble, StreamingBubble } from './ChatBubble'
export { useTypingEffect, HighlightedContent, EntityChips, AIAvatar, MessageStatus } from './MessageBubble'
export { MessageList } from './ChatMessageList'

import { MessageList } from './ChatMessageList'

/* ============================================================
   CHAT AREA - Main component
   ============================================================ */

export function ChatArea() {
  const { messages, isStreaming, currentStreamContent, isLoading, editMessage, deleteMessage, confirmEntity, extractEntitiesFromMessage } = useChatStore()

  // Extract entities from new assistant messages
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.role === 'assistant' && !msg.entities) {
        extractEntitiesFromMessage(msg.id)
      }
    })
  }, [messages, extractEntitiesFromMessage])

  return (
    <motion.div
      className="flex-1 flex flex-col min-w-0"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: DURATION.SLOW, delay: 0.1, ease: EASE.OUT }}
    >
      <div className="flex-1 overflow-hidden relative">
        {isLoading && messages.length === 0 ? (
          <div className="h-full overflow-y-auto p-4">
            <ChatSkeleton count={3} />
          </div>
        ) : (
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            currentStreamContent={currentStreamContent}
            isLoading={isLoading}
            editMessage={editMessage}
            deleteMessage={deleteMessage}
            confirmEntity={confirmEntity}
          />
        )}
      </div>
    </motion.div>
  )
}

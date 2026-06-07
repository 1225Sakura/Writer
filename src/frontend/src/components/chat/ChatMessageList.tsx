/**
 * ChatMessageList - Message list with virtual scrolling, empty state, and grouping
 *
 * Uses react-window v2 List for efficient rendering of 500+ messages.
 * Preserves smart scroll, streaming bubble, typing indicator, and all callbacks.
 */

import { useRef, useEffect, useState, useCallback, useMemo, type CSSProperties } from 'react'
import { List, useListCallbackRef } from 'react-window'
import type { ChatMessage } from '@/store'
import { useChatStore } from '@/store/chatStore'
import { Sparkles, MessageSquareText, Wand2, ArrowDown, GitBranch } from 'lucide-react'
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

function useSuggestionStage(extractedEntities: { type: string }[]) {
  return useMemo(() => {
    const types = new Set(extractedEntities.map((e) => e.type))
    if (types.size === 0) return 'genre' as const
    if (!types.has('world')) return 'worldview' as const
    if (!types.has('character')) return 'character' as const
    return 'plot' as const
  }, [extractedEntities])
}

const SUGGESTIONS_BY_STAGE: Record<string, { label: string; prompt: string }[]> = {
  genre: [
    { label: '玄幻修仙', prompt: '我想写一本玄幻修仙小说' },
    { label: '都市异能', prompt: '我想写一本都市异能小说' },
    { label: '悬疑推理', prompt: '我想写一本悬疑推理小说' },
    { label: '言情', prompt: '我想写一本言情小说' },
    { label: '科幻未来', prompt: '我想写一本科幻未来小说' },
    { label: '历史穿越', prompt: '我想写一本历史穿越小说' },
  ],
  worldview: [
    { label: '构建世界观', prompt: '告诉我你的世界观设定' },
    { label: '设定修炼体系', prompt: '我想设计一个修炼体系' },
    { label: '地图与势力', prompt: '帮我规划世界地图和主要势力' },
    { label: '魔法/科技体系', prompt: '我想设计一个独特的魔法体系' },
  ],
  character: [
    { label: '描述你的主角', prompt: '描述你的主角' },
    { label: '设计反派角色', prompt: '帮我设计一个有深度的反派' },
    { label: '角色关系网', prompt: '帮我设计主要角色之间的关系' },
    { label: '配角设定', prompt: '帮我设计几个有特色的配角' },
  ],
  plot: [
    { label: '设计故事主线', prompt: '帮我设计故事主线' },
    { label: '规划章节大纲', prompt: '帮我规划前二十章的大纲' },
    { label: '设计冲突与高潮', prompt: '帮我设计主要的冲突和高潮情节' },
    { label: '伏笔与悬念', prompt: '帮我设计伏笔和悬念线' },
  ],
}

function EmptyState() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const setPendingInput = useChatStore((s) => s.setPendingInput)
  const extractedEntities = useChatStore((s) => s.extractedEntities)
  const stage = useSuggestionStage(extractedEntities)
  const suggestions = SUGGESTIONS_BY_STAGE[stage]

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
        key={stage}
        className="flex flex-wrap justify-center gap-2.5"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.INSTANT } : { delay: 0.25, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        {suggestions.map(({ label, prompt }) => (
          <GlassCard
            key={label}
            intensity="light"
            border="subtle"
            variant="default"
            rounded="xl"
            padding="sm"
            hover
            className="inline-flex items-center gap-1.5 text-sm cursor-pointer text-secondary hover:text-primary"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => setPendingInput(prompt)}
          >
            <span className="flex-shrink-0 opacity-60"><Icon icon={MessageSquareText} size="xs" /></span>
            <span>{label}</span>
          </GlassCard>
        ))}
      </motion.div>
    </motion.div>
  )
}

/* ============================================================
   HEIGHT ESTIMATION
   ============================================================ */

/** Base height: avatar area + padding */
const BASE_HEIGHT = 60
/** Height per content line (~50 chars per line, ~20px per line) */
const CHAR_HEIGHT = 20
/** Characters per line estimate for width calculation */
const CHARS_PER_LINE = 50
/** Action bar height for AI messages */
const ACTION_BAR_HEIGHT = 40
/** Grouped (same sender) gap */
const GROUPED_GAP = 10
/** Ungrouped (different sender) gap */
const UNGROUPED_GAP = 18

/**
 * Estimate the pixel height of a single message.
 * Used as initial estimate before the row is rendered and measured.
 */
function estimateMessageHeight(message: ChatMessage, isGrouped: boolean): number {
  const contentLength = message.content?.length ?? 0
  const estimatedLines = Math.max(1, Math.ceil(contentLength / CHARS_PER_LINE))
  const contentHeight = estimatedLines * CHAR_HEIGHT
  const actionBar = message.role === 'assistant' ? ACTION_BAR_HEIGHT : 0
  const entityHeight = message.entities && message.entities.length > 0 ? 32 : 0
  const retryHeight = message.failed ? 36 : 0
  const gap = isGrouped ? GROUPED_GAP : UNGROUPED_GAP
  return BASE_HEIGHT + contentHeight + actionBar + entityHeight + retryHeight + gap
}

/* ============================================================
   ROW PROPS & ROW COMPONENT (for react-window v2)
   ============================================================ */

interface MessageRowProps {
  messages: ChatMessage[]
  editMessage: (id: string, content: string) => void
  deleteMessage: (id: string) => void
  retryMessage: (id: string) => void
  regenerateMessage: (id: string) => Promise<void>
  rateMessage: (id: string, rating: 'up' | 'down') => Promise<void>
  confirmEntity: (id: string) => void
  branchMessage: (id: string) => void
}

/**
 * Row component for react-window v2 List.
 * Receives `index` and `style` automatically from the List,
 * plus all fields from MessageRowProps via `rowProps`.
 */
function MessageRow({
  index,
  style,
  messages,
  editMessage,
  deleteMessage,
  retryMessage,
  regenerateMessage,
  rateMessage,
  confirmEntity,
  branchMessage,
}: { index: number; style: CSSProperties } & MessageRowProps) {
  const msg = messages[index]
  if (!msg) return null

  const prevMsg = index > 0 ? messages[index - 1] : null
  const nextMsg = index < messages.length - 1 ? messages[index + 1] : null
  const isGrouped = prevMsg?.role === msg.role
  const isFirstInGroup = prevMsg?.role !== msg.role
  const isLastInGroup = nextMsg?.role !== msg.role

  return (
    <div style={style}>
      <ChatBubble
        key={msg.id}
        message={msg}
        index={index}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onRetry={retryMessage}
        onRegenerate={regenerateMessage}
        onRate={rateMessage}
        onConfirmEntity={confirmEntity}
        onBranch={branchMessage}
        isGrouped={isGrouped}
        isFirstInGroup={isFirstInGroup}
        isLastInGroup={isLastInGroup}
      />
    </div>
  )
}

/* ============================================================
   MESSAGE LIST (with virtual scrolling)
   ============================================================ */

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  currentStreamContent: string
  isLoading: boolean
  editMessage: (id: string, content: string) => void
  deleteMessage: (id: string) => void
  retryMessage: (id: string) => void
  regenerateMessage: (id: string) => Promise<void>
  rateMessage: (id: string, rating: 'up' | 'down') => Promise<void>
  confirmEntity: (id: string) => void
  branchMessage: (id: string) => void
  activeBranchId?: string | null
  onSwitchBranch?: (branchId: string | null) => void
}

export function MessageList({
  messages,
  isStreaming,
  currentStreamContent,
  isLoading,
  editMessage,
  deleteMessage,
  retryMessage,
  regenerateMessage,
  rateMessage,
  confirmEntity,
  branchMessage,
  activeBranchId,
  onSwitchBranch,
}: MessageListProps) {
  const [listApi, listApiRef] = useListCallbackRef()
  const outerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const prevMessageCountRef = useRef(messages.length)

  /* ---- height estimation callback for VariableSizeList ---- */
  const getRowHeight = useCallback(
    (index: number, rowProps: MessageRowProps): number => {
      const msg = rowProps.messages[index]
      if (!msg) return BASE_HEIGHT + UNGROUPED_GAP
      const prevMsg = index > 0 ? rowProps.messages[index - 1] : null
      const isGrouped = prevMsg?.role === msg.role
      return estimateMessageHeight(msg, isGrouped)
    },
    [],
  )

  /* ---- scroll detection via onResize ---- */
  const handleResize = useCallback(
    (_size: { height: number; width: number }) => {
      // When the outer element resizes, check if we should update scroll state
      if (!listApi) return
      const el = listApi.element
      if (!el) return
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
      setIsAtBottom(atBottom)
    },
    [listApi],
  )

  /* ---- scroll event listener for position detection ---- */
  useEffect(() => {
    if (!listApi) return
    const el = listApi.element
    if (!el) return

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
      setIsAtBottom(atBottom)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [listApi])

  /* ---- auto-scroll only when at bottom ---- */
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      listApi?.scrollToRow({
        index: messages.length - 1,
        align: 'end',
        behavior: 'instant',
      })
    }
    // Detect new messages arriving while not at bottom
    if (messages.length > prevMessageCountRef.current && !isAtBottom) {
      setIsAtBottom(false)
    }
    prevMessageCountRef.current = messages.length
  }, [messages, currentStreamContent, isAtBottom, listApi])

  const showTypingIndicator = isLoading && !isStreaming && messages.length > 0
  const showJumpToLatest = !isAtBottom && messages.length > 0

  const scrollToBottom = useCallback(() => {
    if (messages.length > 0) {
      listApi?.scrollToRow({
        index: messages.length - 1,
        align: 'end',
        behavior: 'smooth',
      })
    }
    setIsAtBottom(true)
  }, [messages.length, listApi])

  /* ---- rowProps passed to every row ---- */
  const rowProps = useMemo<MessageRowProps>(
    () => ({
      messages,
      editMessage,
      deleteMessage,
      retryMessage,
      regenerateMessage,
      rateMessage,
      confirmEntity,
      branchMessage,
    }),
    [messages, editMessage, deleteMessage, retryMessage, regenerateMessage, rateMessage, confirmEntity, branchMessage],
  )

  // Extract source message index from branch ID for display
  const branchSourceIndex = useMemo(() => {
    if (!activeBranchId) return -1
    // branch ID format: branch-${sourceMessageId}-${timestamp}
    const parts = activeBranchId.split('-')
    // Reconstruct the source message ID: everything between "branch-" and the last timestamp segment
    if (parts.length < 3) return -1
    const sourceId = parts.slice(1, -1).join('-')
    // Find the index of that message in the main (cached) messages
    const cached = messages
    return cached.findIndex((m) => m.id === sourceId)
  }, [activeBranchId, messages])

  return (
    <div className="relative h-full">
      {/* Branch indicator banner */}
      {activeBranchId && (
        <motion.div
          className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center px-4 py-2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: DURATION.FAST, ease: EASE.STANDARD }}
        >
          <GlassCard
            intensity="medium"
            border="subtle"
            variant="elevated"
            rounded="xl"
            padding="sm"
            className="inline-flex items-center gap-2 text-xs shadow-lg"
          >
            <Icon icon={GitBranch} size="xs" className="text-[var(--color-ifline)]" />
            <span className="text-secondary">
              从消息 {branchSourceIndex >= 0 ? branchSourceIndex + 1 : ''} 分叉
            </span>
            <span className="text-tertiary">·</span>
            <button
              onClick={() => onSwitchBranch?.(null)}
              className="text-[var(--color-ifline)] hover:underline transition-colors"
            >
              切换回主分支
            </button>
          </GlassCard>
        </motion.div>
      )}

      {messages.length === 0 && !isStreaming ? (
        <EmptyState />
      ) : (
        <div
          ref={outerRef}
          className="h-full"
          role="log"
          aria-live="polite"
          aria-label="聊天消息列表"
        >
          <List
            listRef={listApiRef as any}
            rowComponent={MessageRow}
            rowCount={messages.length}
            rowHeight={getRowHeight}
            rowProps={rowProps}
            overscanCount={5}
            className="scrollbar-thin bg-ink-gradient h-full"
            style={{ height: '100%', width: '100%' }}
            onResize={handleResize}
          />
        </div>
      )}

      {/* Streaming bubble — rendered outside the virtual list so it's always visible */}
      {isStreaming && currentStreamContent && (
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <StreamingBubble content={currentStreamContent} />
          </div>
        </div>
      )}

      {/* Typing indicator — rendered outside the virtual list */}
      {showTypingIndicator && (
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DURATION.FAST, ease: EASE.STANDARD }}
            className="pointer-events-auto"
          >
            <TypingIndicator />
          </motion.div>
        </div>
      )}

      {/* Jump to latest button */}
      <AnimatePresence>
        {showJumpToLatest && (
          <motion.div
            className="absolute bottom-4 left-0 right-0 flex justify-center z-10 pointer-events-none"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: DURATION.FAST, ease: EASE.STANDARD }}
          >
            <GlassCard
              intensity="medium"
              border="subtle"
              variant="elevated"
              rounded="xl"
              padding="sm"
              hover
              className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-secondary hover:text-primary pointer-events-auto shadow-lg"
              onClick={scrollToBottom}
            >
              <Icon icon={ArrowDown} size="xs" />
              <span>跳到最新</span>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * ChatStreamingBubble - Streaming (in-progress AI response) bubble
 *
 * Shows the AI's current streaming response with typing indicator.
 */

import { motion } from 'framer-motion'
import { Square } from 'lucide-react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useMarkdownBuffer } from '@/hooks/useMarkdownBuffer'
import { GlassCard } from '@/components/ui/GlassCard'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { AIAvatar } from './MessageBubble'
import { useChatStore } from '@/store/chatStore'

export function StreamingBubble({ content }: { content: string }) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const abortStreaming = useChatStore((s) => s.abortStreaming)
  const { rendered } = useMarkdownBuffer(content, true)

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
      transition={prefersReducedMotion ? { duration: DURATION.FAST } : { duration: DURATION.NORMAL, ease: EASE.OUT }}
      className="flex justify-start mb-6"
    >
      <div className="flex gap-3 max-w-[85%]">
        <motion.div
          className="flex-shrink-0 mt-1"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.03, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <AIAvatar isThinking />
        </motion.div>
        <div className="relative">
          <GlassCard
            intensity="light"
            border="subtle"
            variant="default"
            rounded="2xl"
            padding="md"
            hover={false}
            className="relative rounded-tl-sm overflow-visible"
            style={{
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <button
              onClick={abortStreaming}
              className="absolute -top-2 -right-2 p-1.5 rounded-full bg-surface-raised border border-[var(--color-vermillion)]/30 text-[var(--color-vermillion)] hover:bg-[var(--color-vermillion)]/10 transition-colors z-10"
              title="停止生成"
            >
              <Icon icon={Square} size="xs" />
            </button>
            <motion.div
              className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full"
              style={{
                background: 'linear-gradient(180deg, var(--accent-primary) 0%, color-mix(in srgb, var(--accent-primary) 50%, transparent) 100%)',
              }}
              animate={prefersReducedMotion ? {} : { opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-primary">
              {rendered}
              <motion.span
                className="inline-block w-2 h-4 ml-1 rounded-sm align-middle bg-accent-primary"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </GlassCard>
          <motion.div
            className="mt-2 ml-1 flex items-center gap-2"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
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

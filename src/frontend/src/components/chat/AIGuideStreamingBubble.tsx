/**
 * AIGuideStreamingBubble - Streaming bubble for AIGuidePanel
 *
 * Shows the AI's current streaming response with typing indicator.
 */

import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { AIAvatar } from './AIGuideMessageHelpers'

export function StreamingBubble({ content }: { content: string }) {
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
            className="relative rounded-tl-sm overflow-hidden"
            style={{
              boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
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
                animate={prefersReducedMotion ? {} : { opacity: [1, 0, 1] }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </GlassCard>
          <motion.div
            className="mt-1.5 ml-1 flex items-center gap-2"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.FAST, delay: 0.1, ease: EASE.SMOOTH }}
          >
            <span className="relative flex h-2 w-2">
              <motion.span
                className="absolute inline-flex h-full w-full rounded-full bg-accent-primary"
                animate={prefersReducedMotion ? {} : {
                  scale: [1, 1.8, 1],
                  opacity: [0.4, 0, 0.4],
                }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
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

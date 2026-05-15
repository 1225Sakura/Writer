/**
 * AIGuideEmptyState - Empty state for the AI guide panel
 *
 * Shows welcome message, genre tags, and tips when no messages exist.
 */

import { Sparkles, MessageSquareText, Wand2, Lightbulb, PenTool } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

export function AIGuideEmptyState() {
  const prefersReducedMotion = usePrefersReducedMotion()

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
          <Sparkles className="w-9 h-9 text-accent-primary" />
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
          <span className="flex-shrink-0"><Wand2 className="w-3 h-3" /></span>
          <span>选择下方标签快速开始，或直接输入你的想法</span>
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border-strong to-transparent" />
      </motion.div>

      <motion.div
        className="flex flex-wrap justify-center gap-2.5 mb-8"
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
          >
            <span className="flex-shrink-0 opacity-60"><MessageSquareText className="w-3.5 h-3.5" /></span>
            <span>{tag}</span>
          </GlassCard>
        ))}
      </motion.div>

      {/* Tips section */}
      <motion.div
        className="w-full max-w-sm"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.1 } : { delay: 0.45, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="flex items-center gap-2 mb-3 px-1">
          <Lightbulb className="w-3.5 h-3.5 text-accent-primary/70" />
          <span className="text-xs text-tertiary font-medium">小贴士</span>
        </div>
        <div className="space-y-2">
          {[
            { icon: PenTool, text: '描述你的世界设定，AI 会自动提取关键信息' },
            { icon: Sparkles, text: '随时点击已收集的设定进行确认或修改' },
            { icon: Wand2, text: '完成设定后可进入编辑器开始正式写作' },
          ].map((tip) => (
            <GlassCard
              key={tip.text}
              intensity="light"
              border="subtle"
              variant="default"
              rounded="lg"
              padding="sm"
              className="flex items-start gap-3"
            >
              <tip.icon className="w-4 h-4 text-accent-primary/60 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-secondary leading-relaxed text-left">{tip.text}</span>
            </GlassCard>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

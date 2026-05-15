/**
 * EmptyState - Empty entity list placeholder
 *
 * Animated empty state with floating book illustration
 * and helpful tips for the user.
 */

import { BookOpen, Feather, Lightbulb, Wand2, PenTool } from 'lucide-react'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

export function EmptyState() {
  const prefersReducedMotion = usePrefersReducedMotion()
  return (
    <motion.div
      className="text-center py-10 px-4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      {/* Floating book illustration */}
      <motion.div
        className="relative w-20 h-20 mx-auto mb-5"
        animate={prefersReducedMotion ? {} : { y: [0, -6, 0] }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <GlassCard
          intensity="medium"
          border="subtle"
          variant="elevated"
          rounded="2xl"
          padding="none"
          className="w-full h-full flex items-center justify-center"
        >
          <BookOpen className="w-8 h-8 text-secondary" />
        </GlassCard>
        <motion.div
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center z-20"
          animate={prefersReducedMotion ? {} : { rotate: [0, 10, -10, 0] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          <GlassCard
            intensity="strong"
            border="subtle"
            rounded="full"
            padding="none"
            className="w-full h-full flex items-center justify-center"
          >
            <Feather className="w-3 h-3 text-accent-primary" />
          </GlassCard>
        </motion.div>
      </motion.div>

      <motion.p
        className="text-sm text-secondary font-medium"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        开始对话后，这里将显示收集到的设定信息
      </motion.p>
      <motion.p
        className="text-xs mt-2 text-secondary opacity-50"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 0.5, y: 0 }}
        transition={{ delay: 0.25, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        AI 会自动识别并提取关键设定
      </motion.p>

      {/* Tips */}
      <motion.div
        className="mt-6 space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35 }}
      >
        {[
          { icon: Lightbulb, text: '描述你的世界设定，AI 会自动提取' },
          { icon: Wand2, text: '提及角色、物品、地点等关键词' },
          { icon: PenTool, text: '点击确认将设定保存到右侧面板' },
        ].map((tip) => (
          <GlassCard
            key={tip.text}
            intensity="light"
            border="subtle"
            variant="default"
            rounded="lg"
            padding="sm"
            className="flex items-center gap-2.5"
          >
            <tip.icon className="w-3.5 h-3.5 text-accent-primary/60 flex-shrink-0" />
            <span className="text-[11px] text-secondary leading-relaxed text-left">{tip.text}</span>
          </GlassCard>
        ))}
      </motion.div>

      {/* Decorative dots */}
      <div className="flex items-center justify-center gap-1.5 mt-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-secondary opacity-30"
            animate={prefersReducedMotion ? {} : { opacity: [0.2, 0.5, 0.2], scale: [1, 1.2, 1] }}
            transition={prefersReducedMotion ? { duration: 0 } : {
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

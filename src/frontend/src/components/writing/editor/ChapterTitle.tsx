import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

interface ChapterTitleProps {
  title: string
}

export function ChapterTitle({ title }: ChapterTitleProps) {
  return (
    <>
      <motion.h1
        className="font-serif-cn text-2xl font-semibold tracking-tight cjk-punctuation-hang"
        style={{
          color: 'var(--writing-text)',
          lineHeight: 'var(--leading-tight)',
          letterSpacing: 'var(--tracking-tight)',
          transition: 'color var(--transition-normal)',
          fontFamily: 'var(--font-serif-cn)',
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        {title}
      </motion.h1>
      {/* Ink wash underline decoration */}
      <motion.div
        className="mt-5 flex items-center gap-2"
        initial={{ opacity: 0, scaleX: 0.8 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: DURATION.SLOW, delay: 0.1, ease: EASE.SMOOTH }}
      >
        <div className="h-px flex-1 ink-divider" />
        <div
          className="w-8 h-[2px] rounded-full"
          style={{
            background: 'linear-gradient(90deg, color-mix(in srgb, var(--color-character) 40%, transparent), color-mix(in srgb, var(--color-vermillion) 40%, transparent))',
            boxShadow: '0 0 6px color-mix(in srgb, var(--color-character) 15%, transparent)',
          }}
        />
        <div className="h-px flex-1 ink-divider" />
      </motion.div>
    </>
  )
}
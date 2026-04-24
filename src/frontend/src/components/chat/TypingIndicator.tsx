import { motion } from 'framer-motion'
import { Bot, Brain, Loader2 } from 'lucide-react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */

function AIAvatarBubble({ icon, isThinking = false }: { icon: React.ReactNode; isThinking?: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      className="flex-shrink-0 mt-1"
      animate={isThinking && !prefersReducedMotion ? { scale: [1, 1.05, 1] } : undefined}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-accent-muted border border-border-focus">
        {icon}
      </div>
    </motion.div>
  )
}

function ThinkingBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start mb-5">
      <div className="flex gap-3 max-w-[75%]">
        {children}
      </div>
    </div>
  )
}

function MessageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="rounded-2xl px-4 py-3 bg-surface-raised border border-default rounded-tl-[20px] rounded-tr-[20px] rounded-br-[20px] rounded-bl-[4px]">
        {children}
      </div>
    </div>
  )
}

/* ============================================================
   VARIANT 1: Classic bouncing dots (default)
   ============================================================ */

export function TypingIndicator() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <ThinkingBubble>
      <AIAvatarBubble icon={<Bot className="w-4 h-4 text-accent-primary" />} />
      <MessageContainer>
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary">AI 正在思考</span>
          <div className="flex gap-1 ml-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="inline-block w-1.5 h-1.5 rounded-full bg-accent-primary"
                animate={prefersReducedMotion ? {} : {
                  opacity: [0.3, 1, 0.3],
                  y: [0, -6, 0],
                  scale: [0.85, 1.15, 0.85],
                }}
                transition={prefersReducedMotion ? { duration: 0 } : {
                  duration: 1.4,
                  repeat: Infinity,
                  delay: i * 0.16,
                  ease: [0.45, 0, 0.55, 1],
                }}
              />
            ))}
          </div>
        </div>
      </MessageContainer>
    </ThinkingBubble>
  )
}

/* ============================================================
   VARIANT 2: Brain pulse - for deep thinking states
   ============================================================ */

export function TypingIndicatorBrain() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <ThinkingBubble>
      <motion.div
        className="flex-shrink-0 mt-1 relative"
        animate={prefersReducedMotion ? {} : { scale: [1, 1.08, 1] }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-accent-muted/30"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="w-7 h-7 rounded-full flex items-center justify-center relative bg-accent-muted border border-border-focus">
          <Brain className="w-4 h-4 text-accent-primary" />
        </div>
      </motion.div>
      <MessageContainer>
        <div className="flex items-center gap-3">
          <span className="text-xs text-secondary">深度思考中</span>
          <div className="flex items-center gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="w-0.5 rounded-full bg-accent-primary"
                animate={prefersReducedMotion ? {} : {
                  height: [4, 16, 4],
                  opacity: [0.3, 0.85, 0.3],
                }}
                transition={prefersReducedMotion ? { duration: 0 } : {
                  duration: 0.9,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: [0.45, 0, 0.55, 1],
                }}
              />
            ))}
          </div>
        </div>
      </MessageContainer>
    </ThinkingBubble>
  )
}

/* ============================================================
   VARIANT 3: Orbital dots - for creative generation
   ============================================================ */

export function TypingIndicatorOrbital() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <ThinkingBubble>
      <AIAvatarBubble icon={<Bot className="w-4 h-4 text-accent-primary" />} />
      <MessageContainer>
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary">创作中</span>
          <div className="relative w-6 h-6">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-accent-primary"
                style={{
                  top: '50%',
                  left: '50%',
                  marginTop: -3,
                  marginLeft: -3,
                }}
                animate={prefersReducedMotion ? {} : {
                  x: [0, Math.cos((i * 120 * Math.PI) / 180) * 8, 0],
                  y: [0, Math.sin((i * 120 * Math.PI) / 180) * 8, 0],
                  opacity: [0.4, 1, 0.4],
                  scale: [0.9, 1.2, 0.9],
                }}
                transition={prefersReducedMotion ? { duration: 0 } : {
                  duration: 1.6,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: [0.45, 0, 0.55, 1],
                }}
              />
            ))}
          </div>
        </div>
      </MessageContainer>
    </ThinkingBubble>
  )
}

/* ============================================================
   VARIANT 4: Spinner with text - for loading states
   ============================================================ */

export function TypingIndicatorLoading() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <ThinkingBubble>
      <AIAvatarBubble icon={<Bot className="w-4 h-4 text-accent-primary" />} />
      <MessageContainer>
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={prefersReducedMotion ? {} : { rotate: 360 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.5, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-3.5 h-3.5 text-accent-primary" />
          </motion.div>
          <span className="text-xs text-secondary">处理中...</span>
        </div>
      </MessageContainer>
    </ThinkingBubble>
  )
}

/* ============================================================
   VARIANT 5: Wave bars - for analysis states
   ============================================================ */

export function TypingIndicatorWave() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <ThinkingBubble>
      <AIAvatarBubble icon={<Bot className="w-4 h-4 text-accent-primary" />} />
      <MessageContainer>
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary">分析中</span>
          <div className="flex items-end gap-0.5 h-3.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-0.5 rounded-full bg-accent-primary"
                animate={prefersReducedMotion ? {} : {
                  height: [3, 12, 3],
                  opacity: [0.3, 0.75, 0.3],
                }}
                transition={prefersReducedMotion ? { duration: 0 } : {
                  duration: 0.7,
                  repeat: Infinity,
                  delay: i * 0.07,
                  ease: [0.45, 0, 0.55, 1],
                }}
              />
            ))}
          </div>
        </div>
      </MessageContainer>
    </ThinkingBubble>
  )
}

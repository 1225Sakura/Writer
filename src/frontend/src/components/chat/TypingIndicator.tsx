import { motion } from 'framer-motion'
import { Bot, Brain, Loader2 } from 'lucide-react'

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */

function AIAvatarBubble({ icon, isThinking = false }: { icon: React.ReactNode; isThinking?: boolean }) {
  return (
    <motion.div
      className="flex-shrink-0 mt-1"
      animate={isThinking ? { scale: [1, 1.05, 1] } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
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
                animate={{
                  opacity: [0.2, 1, 0.2],
                  y: [0, -5, 0],
                  scale: [0.8, 1.1, 0.8],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: 'easeInOut',
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
  return (
    <ThinkingBubble>
      <motion.div
        className="flex-shrink-0 mt-1 relative"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-accent-muted/30"
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
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
                animate={{
                  height: [4, 16, 4],
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: 'easeInOut',
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
                animate={{
                  x: [0, Math.cos((i * 120 * Math.PI) / 180) * 8, 0],
                  y: [0, Math.sin((i * 120 * Math.PI) / 180) * 8, 0],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeInOut',
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
  return (
    <ThinkingBubble>
      <AIAvatarBubble icon={<Bot className="w-4 h-4 text-accent-primary" />} />
      <MessageContainer>
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
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
                animate={{
                  height: [3, 12, 3],
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </div>
      </MessageContainer>
    </ThinkingBubble>
  )
}

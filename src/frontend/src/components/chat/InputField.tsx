import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Loader2, RefreshCw } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const MAX_INPUT_LENGTH = 500

interface InputFieldProps {
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onNewChat: () => void
  isLoading: boolean
  isStreaming: boolean
  canSend: boolean
}

export function InputField({
  input,
  onInputChange,
  onSend,
  onNewChat,
  isLoading,
  isStreaming,
  canSend,
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  const charCount = input.length
  const isNearLimit = charCount >= MAX_INPUT_LENGTH * 0.9
  const isAtLimit = charCount >= MAX_INPUT_LENGTH

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="flex gap-2 items-end">
      {/* New chat button */}
      <motion.button
        className="min-w-11 min-h-11 flex-shrink-0 rounded-xl bg-surface-raised border border-default touch-target-min
                   flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-hover"
        title="开始新对话"
        onClick={onNewChat}
        whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        <Icon icon={RefreshCw} size="md" />
      </motion.button>

      {/* Input area with enhanced focus effects */}
      <div className="flex-1 relative min-w-0">
        <motion.div
          className="relative"
          animate={{
            boxShadow: isFocused
              ? '0 0 0 2px var(--accent-primary), 0 0 0 4px rgba(201, 169, 110, 0.08), 0 0 24px rgba(201, 169, 110, 0.1)'
              : '0 0 0 1px var(--border-default), 0 2px 8px rgba(0,0,0,0.04)',
          }}
          transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
          style={{ borderRadius: 'var(--radius-xl)' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              if (e.target.value.length <= MAX_INPUT_LENGTH) {
                onInputChange(e.target.value)
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="输入你的回答... (Enter 发送，Shift+Enter 换行)"
            className="w-full resize-none min-h-[48px] max-h-32 py-3 px-4 pr-16 text-sm
                       bg-surface-input text-primary font-sans rounded-xl
                       border-2 outline-none transition-all duration-150
                       placeholder:text-tertiary"
            style={{
              borderColor: isFocused ? 'var(--accent-primary)' : 'var(--border-default)',
            }}
            rows={1}
          />

          {/* Character counter */}
          <motion.div
            className="absolute bottom-2 right-12 pointer-events-none select-none"
            initial={{ opacity: 0, y: 4 }}
            animate={{
              opacity: isFocused || isNearLimit ? 1 : 0,
              y: 0,
              color: isAtLimit
                ? 'var(--color-danger)'
                : isNearLimit
                  ? 'var(--color-warning)'
                  : 'var(--text-tertiary)'
            }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          >
            <span
              className="text-xs font-mono tabular-nums"
              style={{
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
              }}
            >
              {charCount}/{MAX_INPUT_LENGTH}
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* Send button with glow effect */}
      <motion.button
        onClick={onSend}
        disabled={!canSend}
        className="px-5 py-2.5 flex items-center gap-2 text-sm font-medium flex-shrink-0
                   rounded-xl text-primary disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-150 relative overflow-hidden touch-target-min"
        style={{
          backgroundColor: canSend ? 'var(--accent-primary)' : 'var(--color-surface-input)',
          border: canSend ? '1px solid transparent' : '1px solid var(--border-default)',
          color: canSend ? 'white' : 'var(--text-secondary)',
        }}
        whileHover={canSend && !prefersReducedMotion ? {
          scale: 1.04,
          boxShadow: '0 0 24px color-mix(in srgb, var(--accent-primary) 40%, transparent), 0 4px 12px color-mix(in srgb, var(--accent-primary) 20%, transparent)',
        } : {}}
        whileTap={canSend && !prefersReducedMotion ? { scale: 0.95 } : {}}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        {isLoading || isStreaming ? (
          <motion.div
            animate={prefersReducedMotion ? {} : { rotate: 360 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Icon icon={Loader2} size="sm" />
          </motion.div>
        ) : (
          <Icon icon={Send} size="sm" />
        )}
        <span>{isLoading || isStreaming ? '发送中...' : '发送'}</span>
      </motion.button>
    </div>
  )
}

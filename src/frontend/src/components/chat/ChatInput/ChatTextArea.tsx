/**
 * ChatTextArea — the textarea + char counter wrapper with focus glow.
 *
 * Extracted from InputField.tsx (Phase 0b.2 split).
 */
import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { MAX_INPUT_LENGTH } from './types'

interface ChatTextAreaProps {
  value: string
  onChange: (value: string, cursorPos: number) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onFocus: () => void
  onBlur: () => void
  isFocused: boolean
}

export const ChatTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>(
  function ChatTextArea({ value, onChange, onKeyDown, onFocus, onBlur, isFocused }, ref) {
    const charCount = value.length
    const isNearLimit = charCount >= MAX_INPUT_LENGTH * 0.9
    const isAtLimit = charCount >= MAX_INPUT_LENGTH

    return (
      <motion.div
        className="relative"
        animate={{
          boxShadow: isFocused
            ? '0 0 0 2px var(--accent-primary), 0 0 0 4px var(--accent-muted), 0 0 24px var(--glow-primary-sm)'
            : '0 0 0 1px var(--border-default), 0 2px 8px color-mix(in srgb, var(--ink-100) 4%, transparent)',
        }}
        transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
        style={{ borderRadius: 'var(--radius-xl)' }}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= MAX_INPUT_LENGTH) {
              onChange(e.target.value, e.target.selectionStart)
            }
          }}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="输入你的回答... (Enter 发送，Shift+Enter 换行，#提及实体)"
          aria-label="消息输入框"
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
                : 'var(--text-tertiary)',
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
    )
  },
)
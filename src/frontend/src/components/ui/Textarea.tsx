import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, AlertCircle } from 'lucide-react'

export type TextareaStatus = 'default' | 'focus' | 'error' | 'success' | 'disabled'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  status?: TextareaStatus
  errorMessage?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, status = 'default', errorMessage, disabled, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)

    const statusColors = {
      default: {
        border: 'var(--border-default)',
        ring: 'transparent',
        glow: 'transparent',
      },
      focus: {
        border: 'var(--accent-primary)',
        ring: 'var(--accent-muted)',
        glow: 'inset 0 0 12px var(--accent-muted)',
      },
      error: {
        border: 'var(--color-vermillion)',
        ring: 'rgba(196, 92, 92, 0.2)',
        glow: 'inset 0 0 12px rgba(196, 92, 92, 0.06)',
      },
      success: {
        border: 'var(--color-ifline)',
        ring: 'rgba(126, 184, 74, 0.2)',
        glow: 'inset 0 0 12px rgba(126, 184, 74, 0.06)',
      },
      disabled: {
        border: 'var(--border-subtle)',
        ring: 'transparent',
        glow: 'transparent',
      },
    }

    const currentStatus = disabled ? 'disabled' : isFocused ? 'focus' : status
    const colors = statusColors[currentStatus]

    return (
      <div className="relative">
        <textarea
          ref={ref}
          disabled={disabled}
          className={twMerge(
            clsx(
              'flex min-h-[80px] w-full rounded-[var(--radius-input)] bg-[var(--color-surface-input)] px-3 py-2 text-sm',
              'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
              'transition-all duration-200',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'resize-y'
            ),
            className
          )}
          style={{
            border: `1px solid ${colors.border}`,
            boxShadow: `${colors.ring !== 'transparent' ? `0 0 0 3px ${colors.ring}` : ''}, ${colors.glow !== 'transparent' ? colors.glow : ''}`.trim().replace(/^,\s*/, '') || 'none',
            outline: 'none',
          }}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
          {...props}
        />

        {/* Status icons */}
        <AnimatePresence>
          {(status === 'success' || status === 'error') && !disabled && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="absolute right-3 top-3"
            >
              {status === 'success' && (
                <Check className="w-4 h-4 text-[var(--icon-success)]" />
              )}
              {status === 'error' && (
                <AlertCircle className="w-4 h-4 text-[var(--icon-danger)]" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error shake animation */}
        <AnimatePresence>
          {status === 'error' && !disabled && (
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: [0, -4, 4, -4, 4, 0] }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="absolute inset-0 rounded-[var(--radius-input)] pointer-events-none"
              style={{ border: `1px solid ${colors.border}` }}
            />
          )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence>
          {status === 'error' && errorMessage && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="absolute -bottom-5 left-0 text-xs" style={{ color: 'var(--color-vermillion)' }}
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

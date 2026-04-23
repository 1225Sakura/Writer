import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, AlertCircle } from 'lucide-react'

export type InputStatus = 'default' | 'focus' | 'error' | 'success' | 'disabled'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  status?: InputStatus
  errorMessage?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
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
        <input
          ref={ref}
          disabled={disabled}
          className={twMerge(
            clsx(
              'flex h-10 w-full rounded-[var(--radius-input)] bg-[var(--color-surface-input)] px-4 py-2 text-sm font-[510]',
              'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
              'transition-all duration-200',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border-subtle)]'
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
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              {status === 'success' && (
                <Check className="w-4 h-4" style={{ color: 'var(--color-ifline)' }} />
              )}
              {status === 'error' && (
                <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-vermillion)' }} />
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
Input.displayName = 'Input'

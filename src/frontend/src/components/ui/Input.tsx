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
        border: 'rgba(255,255,255,0.08)',
        ring: 'transparent',
        glow: 'transparent',
      },
      focus: {
        border: 'var(--accent-primary)',
        ring: 'rgba(94,106,210,0.3)',
        glow: 'inset 0 0 12px rgba(94,106,210,0.08)',
      },
      error: {
        border: 'var(--color-error)',
        ring: 'rgba(217,58,58,0.3)',
        glow: 'inset 0 0 12px rgba(217,58,58,0.08)',
      },
      success: {
        border: 'var(--color-ifline)',
        ring: 'rgba(126,183,74,0.3)',
        glow: 'inset 0 0 12px rgba(126,183,74,0.08)',
      },
      disabled: {
        border: 'rgba(255,255,255,0.04)',
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
              'flex h-10 w-full rounded-[6px] bg-[rgba(255,255,255,0.02)] px-4 py-2 text-sm font-[510]',
              'text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]',
              'transition-all duration-200',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[rgba(255,255,255,0.04)]'
            ),
            className
          )}
          style={{
            border: `1px solid ${colors.border}`,
            boxShadow: `${colors.ring ? `0 0 0 3px ${colors.ring}` : ''}, ${colors.glow}`,
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
                <Check className="w-4 h-4" style={{ color: 'var(--color-location)' }} />
              )}
              {status === 'error' && (
                <AlertCircle className="w-4 h-4" style={{ color: 'var(--vermillion)' }} />
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
              className="absolute inset-0 rounded-[6px] pointer-events-none"
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
              className="absolute -bottom-5 left-0 text-xs" style={{ color: 'var(--vermillion)' }}
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

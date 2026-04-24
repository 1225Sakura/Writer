import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, AlertCircle, Eye, EyeOff } from 'lucide-react'

export type InputStatus = 'default' | 'focus' | 'error' | 'success' | 'disabled'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  status?: InputStatus
  errorMessage?: string
  label?: string
  helperText?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  showPasswordToggle?: boolean
}

const sizeClasses = {
  sm: 'h-8 text-xs px-3',
  md: 'h-10 text-sm px-4',
  lg: 'h-12 text-base px-5',
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    status = 'default',
    errorMessage,
    disabled,
    label,
    helperText,
    prefix,
    suffix,
    size = 'md',
    showPasswordToggle,
    type,
    value,
    ...props
  }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const [showPassword, setShowPassword] = React.useState(false)

    const hasValue = typeof value !== 'undefined' && value !== ''
    const hasPasswordToggle = type === 'password' && showPasswordToggle
    const inputType = hasPasswordToggle && showPassword ? 'text' : type

    const statusColors = {
      default: {
        border: 'var(--border-default)',
        ring: 'transparent',
        glow: 'transparent',
        labelColor: 'var(--text-secondary)',
      },
      focus: {
        border: 'var(--accent-100)',
        ring: 'rgba(94, 106, 210, 0.2)',
        glow: 'inset 0 0 24px rgba(94, 106, 210, 0.08)',
        labelColor: 'var(--accent-100)',
      },
      error: {
        border: 'var(--vermillion-100)',
        ring: 'rgba(196, 92, 92, 0.25)',
        glow: 'inset 0 0 20px rgba(196, 92, 92, 0.10)',
        labelColor: 'var(--vermillion-100)',
      },
      success: {
        border: 'var(--color-ifline)',
        ring: 'rgba(126, 184, 74, 0.25)',
        glow: 'inset 0 0 20px rgba(126, 184, 74, 0.10)',
        labelColor: 'var(--color-ifline)',
      },
      disabled: {
        border: 'var(--border-subtle)',
        ring: 'transparent',
        glow: 'transparent',
        labelColor: 'var(--text-disabled)',
      },
    }

    const currentStatus = disabled ? 'disabled' : isFocused ? 'focus' : status
    const colors = statusColors[currentStatus]

    return (
      <div className="relative w-full">
        {/* Floating label */}
        <AnimatePresence>
          {label && (
            <motion.label
              initial={{ y: 0, scale: 1, opacity: 0.6 }}
              animate={{
                y: isFocused || hasValue ? -26 : 0,
                scale: isFocused || hasValue ? 0.8 : 1,
                opacity: isFocused ? 1 : (hasValue ? 0.5 : 0.6),
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="absolute left-4 pointer-events-none origin-left z-10"
              style={{
                color: colors.labelColor,
                top: size === 'sm' ? '50%' : size === 'lg' ? '18px' : '50%',
                transform: size === 'lg' ? 'none' : 'translateY(-50%)',
              }}
            >
              {label}
            </motion.label>
          )}
        </AnimatePresence>

        {/* Input container */}
        <div
          className={twMerge(
            clsx(
              'relative flex items-center rounded-[var(--radius-input)] bg-[var(--color-surface-input)]',
              'transition-all duration-200 ease-out',
              'border',
              disabled && 'opacity-50 cursor-not-allowed'
            ),
            className
          )}
          style={{
            borderColor: colors.border,
            boxShadow: colors.ring !== 'transparent' ? `0 0 0 3px ${colors.ring}` : 'none',
          }}
        >
          {/* Focus inner glow */}
          <AnimatePresence>
            {isFocused && !disabled && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 rounded-[var(--radius-input)] pointer-events-none"
                style={{
                  boxShadow: `inset 0 0 24px rgba(94, 106, 210, 0.1)`,
                }}
              />
            )}
          </AnimatePresence>

          {/* Prefix */}
          {prefix && (
            <span className="pl-3 flex-shrink-0 text-[var(--text-tertiary)]">
              {prefix}
            </span>
          )}

          {/* Input */}
          <input
            ref={ref}
            type={inputType}
            disabled={disabled}
            value={value}
            className={twMerge(
              clsx(
                'flex-1 bg-transparent outline-none appearance-none',
                'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                'transition-all duration-200',
                sizeClasses[size],
                prefix && 'pl-2',
                (suffix || hasPasswordToggle) && 'pr-2',
                disabled && 'cursor-not-allowed'
              )
            )}
            style={{
              boxShadow: colors.glow !== 'transparent' ? colors.glow : 'none',
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

          {/* Suffix */}
          {suffix && (
            <span className="pr-3 flex-shrink-0 text-[var(--text-tertiary)]">
              {suffix}
            </span>
          )}

          {/* Password toggle */}
          {hasPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="pr-3 flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {/* Status icons */}
          <AnimatePresence>
            {(status === 'success' || status === 'error') && !disabled && !hasPasswordToggle && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {status === 'success' && (
                  <Check className="w-4 h-4 text-[var(--color-ifline)]" />
                )}
                {status === 'error' && (
                  <AlertCircle className="w-4 h-4 text-[var(--vermillion-100)]" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error shake animation */}
        <AnimatePresence>
          {status === 'error' && !disabled && (
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: [0, -6, 6, -6, 6, 0] }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-0 rounded-[var(--radius-input)] pointer-events-none"
              style={{ border: `2px solid var(--vermillion-100)` }}
            />
          )}
        </AnimatePresence>

        {/* Helper text / Error message */}
        <AnimatePresence mode="wait">
          {(errorMessage || helperText) && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="absolute -bottom-5 left-0 text-xs mt-1"
              style={{ color: errorMessage ? 'var(--vermillion-100)' : 'var(--text-tertiary)' }}
            >
              {errorMessage || helperText}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)
Input.displayName = 'Input'
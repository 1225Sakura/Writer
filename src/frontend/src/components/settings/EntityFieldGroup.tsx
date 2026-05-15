/**
 * EntityFieldGroup — Reusable form field primitives for entity editing.
 * Extracted from EntityEditor.tsx.
 */

import { useState } from 'react'
import { Loader2, AlertCircle, Check } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE, SPRING } from '@/components/shared/AnimationConfig'
import {
  inputStyle,
  inputFocusGlow,
  labelStyle,
  inputPadding,
  type FieldValidation,
} from './EntityFieldStyles'

// Re-export for consumers
export { inputStyle, inputFocusGlow, paperTextureStyle, labelStyle, inputPadding } from './EntityFieldStyles'
export type { ValidationState, FieldValidation } from './EntityFieldStyles'

// ============================================
// SectionDivider
// ============================================

export function SectionDivider() {
  return (
    <div className="relative h-px my-4 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, var(--border-subtle) 20%, var(--accent-primary)40 50%, var(--border-subtle) 80%, transparent 100%)',
        }}
      />
    </div>
  )
}

// ============================================
// FloatingLabelInput
// ============================================

export function FloatingLabelInput({
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
  onKeyDown,
  validation,
  required,
  maxLength,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent) => void
  validation?: FieldValidation
  required?: boolean
  maxLength?: number
}) {
  const [isFocused, setIsFocused] = useState(false)
  const isActive = isFocused || value.length > 0

  const getBorderColor = () => {
    if (!validation) return isFocused ? 'var(--border-focus)' : 'var(--border-default)'
    switch (validation.state) {
      case 'invalid':
      case 'error':
        return 'var(--color-danger)'
      case 'valid':
      case 'saved':
        return 'var(--color-success)'
      case 'saving':
        return 'var(--border-focus)'
      default:
        return isFocused ? 'var(--border-focus)' : 'var(--border-default)'
    }
  }

  const getLabelColor = () => {
    if (!validation) return isFocused ? 'var(--accent-primary)' : 'var(--text-secondary)'
    switch (validation.state) {
      case 'invalid':
      case 'error':
        return 'var(--color-danger)'
      case 'valid':
      case 'saved':
        return 'var(--color-success)'
      default:
        return isFocused ? 'var(--accent-primary)' : 'var(--text-secondary)'
    }
  }

  const getGlowColor = () => {
    if (!validation) return undefined
    switch (validation.state) {
      case 'invalid':
      case 'error':
        return 'var(--vermillion-muted)'
      case 'valid':
      case 'saved':
        return 'color-mix(in srgb, var(--color-success) 15%, transparent)'
      default:
        return undefined
    }
  }

  return (
    <div className="relative">
      <motion.label
        className="absolute left-3 pointer-events-none origin-left z-10"
        style={{ color: getLabelColor(), ...labelStyle }}
        animate={{
          y: isActive ? -20 : 12,
          scale: isActive ? 0.8 : 1,
        }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        {label}
        {required && <span className="ml-0.5" style={{ color: 'var(--color-danger)' }}>*</span>}
      </motion.label>
      <motion.input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={onKeyDown}
        placeholder={isActive ? placeholder : ''}
        autoFocus={autoFocus}
        maxLength={maxLength}
        className="w-full rounded-md focus:outline-none"
        style={{
          ...inputStyle,
          ...inputPadding,
          borderColor: getBorderColor(),
        }}
        animate={inputFocusGlow(isFocused, getGlowColor() || (getBorderColor() !== 'var(--border-default)' ? getBorderColor() : undefined))}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      />
      {/* Validation indicator */}
      <AnimatePresence>
        {validation && validation.state !== 'idle' && (
          <motion.div
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={SPRING.BADGE}
          >
            {validation.state === 'saving' && (
              <Icon icon={Loader2} size="sm" color="accent" className="animate-spin motion-reduce:animate-none" />
            )}
            {validation.state === 'saved' && (
              <Icon icon={Check} size="sm" color="success" />
            )}
            {(validation.state === 'invalid' || validation.state === 'error') && (
              <Icon icon={AlertCircle} size="sm" color="danger" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Validation message */}
      <AnimatePresence>
        {validation?.message && (validation.state === 'invalid' || validation.state === 'error') && (
          <motion.p
            className="text-xs mt-1.5 ml-1 flex items-center gap-1"
            style={{ color: 'var(--color-danger)' }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <Icon icon={AlertCircle} size="xs" color="danger" />
            {validation.message}
          </motion.p>
        )}
      </AnimatePresence>
      {/* Character count */}
      {maxLength && value.length > 0 && (
        <span
          className="absolute right-3 -bottom-5 text-xs"
          style={{ color: value.length > maxLength * 0.9 ? 'var(--color-danger)' : 'var(--text-tertiary)' }}
        >
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  )
}

// FloatingLabelTextarea extracted to ./FloatingTextarea.tsx
export { FloatingLabelTextarea } from './FloatingTextarea'

// SaveStateIndicator extracted to ./SaveStateIndicator.tsx
export { SaveStateIndicator } from './SaveStateIndicator'

// Re-export SectionHeader and EmptyState from their own module
export { SectionHeader, EmptyState } from './EntitySectionUI'

/**
 * FloatingTextarea — Floating label textarea with validation states.
 * Extracted from EntityFieldGroup.tsx.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import {
  inputStyle,
  inputFocusGlow,
  paperTextureStyle,
  labelStyle,
  type FieldValidation,
} from './EntityFieldStyles'

export function FloatingLabelTextarea({
  value,
  onChange,
  placeholder,
  label,
  rows = 3,
  validation,
  maxLength,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  rows?: number
  validation?: FieldValidation
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
      default:
        return isFocused ? 'var(--border-focus)' : 'var(--border-default)'
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
        style={{ color: isFocused ? 'var(--accent-primary)' : 'var(--text-secondary)', ...labelStyle }}
        animate={{
          y: isActive ? -20 : 12,
          scale: isActive ? 0.8 : 1,
        }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        {label}
      </motion.label>
      <motion.textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isActive ? placeholder : ''}
        rows={rows}
        maxLength={maxLength}
        className="w-full rounded-md text-sm focus:outline-none resize-none"
        style={{
          ...inputStyle,
          ...paperTextureStyle,
          paddingLeft: '12px',
          paddingRight: '12px',
          paddingTop: '18px',
          paddingBottom: '10px',
          borderColor: getBorderColor(),
        }}
        animate={inputFocusGlow(isFocused, getGlowColor() || (getBorderColor() !== 'var(--border-default)' ? getBorderColor() : undefined))}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      />
      {/* Bottom glow bar on focus */}
      <motion.div
        className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full pointer-events-none"
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{
          opacity: isFocused ? 1 : 0,
          scaleX: isFocused ? 1 : 0,
        }}
        transition={{ duration: DURATION.SLOW, ease: EASE.OUT }}
        style={{
          background: `linear-gradient(90deg, transparent, ${getGlowColor() || 'var(--accent-primary)'}, transparent)`,
        }}
      />
      {maxLength && value.length > 0 && (
        <span
          className="absolute right-3 bottom-2 text-xs"
          style={{ color: value.length > maxLength * 0.9 ? 'var(--color-danger)' : 'var(--text-tertiary)' }}
        >
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  )
}

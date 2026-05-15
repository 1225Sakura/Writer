/**
 * EntityFieldStyles — Shared styles and types for entity form fields.
 * Extracted from EntityFieldGroup.tsx.
 */

// ============================================
// Shared Styles
// ============================================

export const inputStyle = {
  backgroundColor: 'var(--color-surface-input)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
  borderRadius: '6px',
  fontSize: '14px',
  lineHeight: '1.5',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
}

export const inputFocusGlow = (isFocused: boolean, color?: string) =>
  isFocused
    ? {
        boxShadow: `0 0 0 3px ${color || 'var(--accent-muted)'}, 0 0 12px ${color || 'var(--accent-muted)'}`,
        borderColor: color || 'var(--border-focus)',
      }
    : {}

export const paperTextureStyle = {
  backgroundImage: `
    linear-gradient(180deg, var(--color-surface-input) 0%, var(--color-surface-input) 100%),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 31px,
      var(--border-subtle) 31px,
      var(--border-subtle) 32px
    )
  `,
  backgroundBlendMode: 'normal',
}

export const labelStyle = {
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.01em',
}

export const inputPadding = { paddingLeft: '12px', paddingRight: '12px', paddingTop: '18px', paddingBottom: '8px' }

// ============================================
// Types
// ============================================

export type ValidationState = 'idle' | 'valid' | 'invalid' | 'saving' | 'saved' | 'error'

export interface FieldValidation {
  state: ValidationState
  message?: string
}

/**
 * EntityForm — Generic entity edit form and add-entity form.
 * Extracted from EntityEditor.tsx.
 */

import { useState } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cardStyle } from './EntityCard'
import {
  FloatingLabelInput,
  FloatingLabelTextarea,
  SaveStateIndicator,
  SectionDivider,
  type ValidationState,
  type FieldValidation,
} from './EntityFieldGroup'

// ============================================
// EntityForm — generic entity editor form
// ============================================

const formFieldVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

export function EntityForm<T extends { name?: string; title?: string; description?: string }>({
  entity,
  onSave,
  onCancel,
  fields,
  extraFields,
}: {
  entity?: T
  onSave: (data: T) => void
  onCancel: () => void
  fields: Array<{ key: keyof T; label: string; type?: 'text' | 'textarea'; required?: boolean; maxLength?: number }>
  extraFields?: React.ReactNode
}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [formData, setFormData] = useState<T>(() => {
    if (entity) return { ...entity }
    const empty = {} as T
    return empty
  })
  const [saveState, setSaveState] = useState<ValidationState>('idle')
  const [fieldValidations, setFieldValidations] = useState<Record<string, FieldValidation>>({})

  const validateField = (_key: string, value: string, required?: boolean): FieldValidation => {
    if (required && !value.trim()) {
      return { state: 'invalid', message: '此字段为必填项' }
    }
    if (value.trim().length > 0) {
      return { state: 'valid' }
    }
    return { state: 'idle' }
  }

  const handleFieldChange = (key: keyof T, value: string, required?: boolean) => {
    setFormData({ ...formData, [key]: value as T[keyof T] })
    const validation = validateField(key as string, value, required)
    setFieldValidations((prev) => ({ ...prev, [key as string]: validation }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const validations: Record<string, FieldValidation> = {}
    let hasError = false
    fields.forEach(({ key, required }) => {
      const value = (formData[key] as string) || ''
      const validation = validateField(key as string, value, required)
      validations[key as string] = validation
      if (validation.state === 'invalid') hasError = true
    })
    setFieldValidations(validations)

    if (hasError) {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2000)
      return
    }

    setSaveState('saving')
    setTimeout(() => {
      onSave(formData)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    }, 300)
  }

  const isValid = fields.every(({ key, required }) => {
    if (!required) return true
    const value = (formData[key] as string) || ''
    return value.trim().length > 0
  })

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-4 p-4 rounded-lg relative"
      style={cardStyle}
      initial="hidden"
      animate="visible"
    >
      {fields.map(({ key, label, type, required, maxLength }, index) => (
        <motion.div key={key as string} custom={index} variants={formFieldVariants}>
          {type === 'textarea' ? (
            <FloatingLabelTextarea
              value={(formData[key] as string) || ''}
              onChange={(value) => handleFieldChange(key, value, required)}
              placeholder={`输入${label}...`}
              label={label}
              validation={fieldValidations[key as string]}
              maxLength={maxLength}
            />
          ) : (
            <FloatingLabelInput
              value={(formData[key] as string) || ''}
              onChange={(value) => handleFieldChange(key, value, required)}
              placeholder={`输入${label}...`}
              label={label}
              validation={fieldValidations[key as string]}
              required={required}
              maxLength={maxLength}
            />
          )}
        </motion.div>
      ))}
      {extraFields && (
        <motion.div custom={fields.length} variants={formFieldVariants}>
          {extraFields}
        </motion.div>
      )}
      <SectionDivider />
      <motion.div
        className="flex items-center justify-between pt-2"
        custom={fields.length + (extraFields ? 1 : 0)}
        variants={formFieldVariants}
      >
        <SaveStateIndicator state={saveState} />
        <div className="flex gap-3">
          <motion.button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border-default)'
            }}
            whileTap={{ scale: 0.97 }}
          >
            取消
          </motion.button>
          <motion.button
            type="submit"
            disabled={!isValid || saveState === 'saving'}
            className="px-5 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 relative overflow-hidden"
            style={{
              backgroundColor: isValid && saveState !== 'saving' ? 'var(--accent-primary)' : 'var(--color-surface-overlay)',
              color: isValid && saveState !== 'saving' ? 'var(--paper-100)' : 'var(--text-tertiary)',
              border: '1px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (isValid && saveState !== 'saving') {
                e.currentTarget.style.backgroundColor = 'var(--accent-hover)'
              }
            }}
            onMouseLeave={(e) => {
              if (isValid && saveState !== 'saving') {
                e.currentTarget.style.backgroundColor = 'var(--accent-primary)'
              }
            }}
            whileTap={{ scale: 0.97 }}
          >
            {isValid && saveState === 'idle' && !prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 rounded-md pointer-events-none"
                animate={{
                  boxShadow: [
                    '0 0 0 0 transparent',
                    '0 0 0 4px var(--accent-muted)',
                    '0 0 0 0 transparent',
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
            {saveState === 'saving' ? (
              <>
                <Icon icon={Loader2} size="sm" color="inherit" className="animate-spin motion-reduce:animate-none" />
                保存中...
              </>
            ) : (
              <>
                <Icon icon={Save} size="sm" color="inherit" />
                保存
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.form>
  )
}

// Re-export AddEntityForm from its own module
export { AddEntityForm } from './AddEntityForm'

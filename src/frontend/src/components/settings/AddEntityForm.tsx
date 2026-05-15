/**
 * AddEntityForm — Simple inline add-entity form.
 * Extracted from EntityForm.tsx.
 */

import { useState, useCallback } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion } from 'framer-motion'
import { cardStyle } from './EntityCard'
import { FloatingLabelInput, SaveStateIndicator, type ValidationState, type FieldValidation } from './EntityFieldGroup'

export function AddEntityForm({
  placeholder,
  onAdd,
  onCancel,
}: {
  placeholder: string
  onAdd: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [saveState, setSaveState] = useState<ValidationState>('idle')
  const [validation, setValidation] = useState<FieldValidation>({ state: 'idle' })

  const handleAdd = useCallback(() => {
    if (!name.trim()) {
      setValidation({ state: 'invalid', message: '名称不能为空' })
      setSaveState('error')
      setTimeout(() => {
        setValidation({ state: 'idle' })
        setSaveState('idle')
      }, 2000)
      return
    }
    setSaveState('saving')
    setTimeout(() => {
      onAdd(name.trim())
      setSaveState('saved')
      setName('')
      setTimeout(() => setSaveState('idle'), 1500)
    }, 300)
  }, [name, onAdd])

  return (
    <div className="p-3 rounded-lg" style={cardStyle}>
      <div className="relative">
        <FloatingLabelInput
          value={name}
          onChange={(value) => {
            setName(value)
            if (validation.state === 'invalid') setValidation({ state: 'idle' })
          }}
          placeholder={placeholder}
          label="名称"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) handleAdd()
            if (e.key === 'Escape') onCancel()
          }}
          validation={validation}
          required
          maxLength={50}
        />
      </div>
      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <SaveStateIndicator state={saveState} />
        <div className="flex gap-2">
          <motion.button
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
            onClick={handleAdd}
            disabled={!name.trim() || saveState === 'saving'}
            className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{
              backgroundColor: name.trim() && saveState !== 'saving' ? 'var(--accent-primary)' : 'var(--color-surface-overlay)',
              color: name.trim() && saveState !== 'saving' ? 'var(--paper-100)' : 'var(--text-tertiary)',
            }}
            onMouseEnter={(e) => {
              if (name.trim() && saveState !== 'saving') e.currentTarget.style.backgroundColor = 'var(--accent-hover)'
            }}
            onMouseLeave={(e) => {
              if (name.trim() && saveState !== 'saving') e.currentTarget.style.backgroundColor = 'var(--accent-primary)'
            }}
            whileTap={{ scale: 0.97 }}
          >
            {saveState === 'saving' ? (
              <Icon icon={Loader2} size="sm" color="inherit" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Icon icon={Plus} size="sm" color="inherit" />
            )}
            添加
          </motion.button>
        </div>
      </div>
    </div>
  )
}

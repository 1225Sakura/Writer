import { useSettingsStore, type CharacterLocal, UIState, Chapter } from '@/store'
import { Trash2, Edit2, Users, Plus, FileText, X, Sparkles, Check, AlertCircle, Loader2, Save } from 'lucide-react'
import { useState, useCallback } from 'react'
import { TagInput } from './TagInput'
import { EntityCard, entityColors, cardStyle } from './EntityCard'
import { motion, AnimatePresence } from 'framer-motion'

interface EntityEditorProps {
  category: UIState['settingsCategory']
}

// Common input style using CSS variables
const inputStyle = {
  backgroundColor: 'var(--color-surface-input)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
  borderRadius: '6px',
  fontSize: '14px',
  lineHeight: '1.5',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
}

// Focus glow style for inputs
const inputFocusGlow = (isFocused: boolean, color?: string) =>
  isFocused
    ? {
        boxShadow: `0 0 0 3px ${color || 'rgba(94, 106, 210, 0.15)'}, 0 0 12px ${color || 'rgba(94, 106, 210, 0.08)'}`,
        borderColor: color || 'var(--border-focus)',
      }
    : {}

const labelStyle = {
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.01em',
}

const inputPadding = { paddingLeft: '12px', paddingRight: '12px', paddingTop: '18px', paddingBottom: '8px' }

// Validation state type
type ValidationState = 'idle' | 'valid' | 'invalid' | 'saving' | 'saved' | 'error'

interface FieldValidation {
  state: ValidationState
  message?: string
}

// Floating label input with validation
function FloatingLabelInput({
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
        return 'rgba(196, 92, 92, 0.2)'
      case 'valid':
      case 'saved':
        return 'rgba(94, 184, 106, 0.15)'
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
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
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
        transition={{ duration: 0.2 }}
      />
      {/* Validation indicator */}
      <AnimatePresence>
        {validation && validation.state !== 'idle' && (
          <motion.div
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            {validation.state === 'saving' && (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" style={{ color: 'var(--accent-primary)' }} />
            )}
            {validation.state === 'saved' && (
              <Check className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
            )}
            {(validation.state === 'invalid' || validation.state === 'error') && (
              <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
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
            <AlertCircle className="w-3 h-3" />
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

// Floating label textarea with validation
function FloatingLabelTextarea({
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
        return 'rgba(196, 92, 92, 0.2)'
      case 'valid':
      case 'saved':
        return 'rgba(94, 184, 106, 0.15)'
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
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
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
          paddingLeft: '12px',
          paddingRight: '12px',
          paddingTop: '18px',
          paddingBottom: '10px',
          borderColor: getBorderColor(),
        }}
        animate={inputFocusGlow(isFocused, getGlowColor() || (getBorderColor() !== 'var(--border-default)' ? getBorderColor() : undefined))}
        transition={{ duration: 0.2 }}
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

// Save state indicator component
function SaveStateIndicator({ state, message }: { state: ValidationState; message?: string }) {
  return (
    <AnimatePresence mode="wait">
      {state === 'saving' && (
        <motion.div
          key="saving"
          className="flex items-center gap-1.5"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" style={{ color: 'var(--accent-primary)' }} />
          <span className="text-xs" style={{ color: 'var(--accent-primary)' }}>保存中...</span>
        </motion.div>
      )}
      {state === 'saved' && (
        <motion.div
          key="saved"
          className="flex items-center gap-1.5"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          >
            <Check className="w-3.5 h-3.5 text-[var(--icon-success)]" />
          </motion.div>
          <span className="text-xs" style={{ color: 'var(--color-success)' }}>{message || '已保存'}</span>
        </motion.div>
      )}
      {(state === 'invalid' || state === 'error') && (
        <motion.div
          key="error"
          className="flex items-center gap-1.5"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
        >
          <AlertCircle className="w-3.5 h-3.5 text-[var(--icon-danger)]" />
          <span className="text-xs" style={{ color: 'var(--color-danger)' }}>{message || '保存失败'}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Section header with add and AI generate buttons
function SectionHeader({
  title,
  count,
  onAdd,
  onGenerate,
}: {
  title: string
  count: number
  onAdd: () => void
  onGenerate?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <motion.span
          key={count}
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--color-surface-overlay)', color: 'var(--text-tertiary)' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          {count}
        </motion.span>
      </div>
      <div className="flex items-center gap-2">
        {onGenerate && (
          <motion.button
            onClick={onGenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: 'var(--accent-muted)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary)30',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)25'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-muted)'
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI生成
          </motion.button>
        )}
        <motion.button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-overlay)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)'
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-3.5 h-3.5" />
          新增
        </motion.button>
      </div>
    </div>
  )
}

// Character tier badges
const tierLabels: Record<string, string> = {
  core: '核心',
  supporting: '配角',
  minor: '路人',
}

// 通用实体编辑表单 with validation
function EntityForm<T extends { name: string; description?: string }>({
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

    // Validate all required fields
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
    // Simulate save delay for UX feedback
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

  // Stagger animation variants for form fields
  const formFieldVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.06, duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
    }),
  }

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
      <motion.div
        className="flex items-center justify-between pt-4 mt-4"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
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
            className="px-5 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{
              backgroundColor: isValid && saveState !== 'saving' ? 'var(--accent-primary)' : 'var(--color-surface-overlay)',
              color: isValid && saveState !== 'saving' ? '#fff' : 'var(--text-tertiary)',
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
            {saveState === 'saving' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.form>
  )
}

// 角色卡片 with expanded fields
function CharacterCard({ character }: { character: CharacterLocal }) {
  const { updateCharacter, deleteCharacter } = useSettingsStore()
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const color = entityColors.character

  const handleSave = (data: { name: string; description?: string }) => {
    updateCharacter(character.id, data)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <EntityForm
        entity={character}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
        fields={[
          { key: 'name', label: '姓名', required: true, maxLength: 50 },
          { key: 'description', label: '描述', type: 'textarea', maxLength: 500 },
        ]}
      />
    )
  }

  return (
    <motion.div
      className="p-4 rounded-lg"
      style={{
        ...cardStyle,
        backgroundColor: isHovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        borderColor: isHovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
            {character.name}
          </h3>
          <motion.span
            className="text-xs px-2 py-0.5 rounded font-medium"
            style={{ backgroundColor: color.bg, color: color.text }}
            whileHover={{ scale: 1.05 }}
          >
            {tierLabels[character.tier]}
          </motion.span>
        </div>
        <div className="flex gap-1">
          <motion.button
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded transition-all"
            style={{ color: 'var(--text-tertiary)' }}
            whileHover={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'var(--text-primary)',
              scale: 1.1,
            }}
            whileTap={{ scale: 0.9 }}
          >
            <Edit2 className="w-4 h-4" />
          </motion.button>
          <motion.button
            onClick={() => deleteCharacter(character.id)}
            className="p-1.5 rounded transition-all"
            style={{ color: 'var(--text-tertiary)' }}
            whileHover={{
              backgroundColor: 'rgba(196,92,92,0.15)',
              color: 'var(--color-danger)',
              scale: 1.1,
            }}
            whileTap={{ scale: 0.9 }}
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
      {character.description && (
        <p className="text-xs line-clamp-2 mb-2" style={{ color: 'var(--text-tertiary)' }}>
          {character.description}
        </p>
      )}
      {character.personality && (
        <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
          性格: {character.personality}
        </p>
      )}
      {character.cultivationRealm && (
        <p className="text-xs mb-2" style={{ color: 'var(--color-location)' }}>
          境界: {character.cultivationRealm}
        </p>
      )}
      <TagInput entityType="character" entityId={character.id} tags={character.tags} />
      {character.relationships.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {character.relationships.length} 条关系
          </span>
        </div>
      )}
    </motion.div>
  )
}

// 新建角色表单 with expanded fields
function NewCharacterForm() {
  const { addCharacter } = useSettingsStore()
  const [showForm, setShowForm] = useState(false)

  const handleSave = (data: { name: string; description?: string }) => {
    addCharacter({ ...data, tier: 'supporting', tags: [] })
    setShowForm(false)
  }

  if (showForm) {
    return (
      <EntityForm
        onSave={handleSave}
        onCancel={() => setShowForm(false)}
        fields={[
          { key: 'name', label: '姓名', required: true, maxLength: 50 },
          { key: 'description', label: '描述', type: 'textarea', maxLength: 500 },
        ]}
      />
    )
  }

  return (
    <motion.button
      onClick={() => setShowForm(true)}
      className="w-full p-4 rounded-lg transition-all flex items-center justify-center gap-2"
      style={{
        ...cardStyle,
        borderStyle: 'dashed',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.borderColor = 'rgba(94,106,210,0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      }}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.99 }}
    >
      <Plus className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
      <span className="text-sm" style={{ color: 'var(--accent-primary)' }}>
        添加角色
      </span>
    </motion.button>
  )
}

// Generic add form for entities
function AddEntityForm({
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
              color: name.trim() && saveState !== 'saving' ? '#fff' : 'var(--text-tertiary)',
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
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            添加
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// 大纲编辑器
function OutlineEditor() {
  const { outline, chapters, addChapter, updateChapter, deleteChapter } = useSettingsStore()
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [summaryModalChapterId, setSummaryModalChapterId] = useState<number | null>(null)
  const [isCreatingOutline, setIsCreatingOutline] = useState(false)
  const [newOutlineTitle, setNewOutlineTitle] = useState('')
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [showAddChapter, setShowAddChapter] = useState(false)

  const handleCreateOutline = () => {
    if (newOutlineTitle.trim()) {
      useSettingsStore.getState().setOutline({
        id: Date.now(),
        title: newOutlineTitle.trim(),
        description: '',
      })
      setIsCreatingOutline(false)
      setNewOutlineTitle('')
    }
  }

  const handleAddChapter = () => {
    if (newChapterTitle.trim()) {
      addChapter({
        title: newChapterTitle.trim(),
        summary: '',
        status: 'planning',
        word_count: 0,
        chapter_order: chapters.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      setNewChapterTitle('')
      setShowAddChapter(false)
    }
  }

  const startEditTitle = (chapter: Chapter) => {
    setEditingChapterId(chapter.id)
    setEditingTitle(chapter.title || '')
  }

  const handleSaveTitle = (chapterId: number) => {
    if (editingTitle.trim()) {
      updateChapter(chapterId, { title: editingTitle.trim() })
    }
    setEditingChapterId(null)
    setEditingTitle('')
  }

  const handleKeyDown = (e: React.KeyboardEvent, chapterId: number) => {
    if (e.key === 'Enter') {
      handleSaveTitle(chapterId)
    } else if (e.key === 'Escape') {
      setEditingChapterId(null)
      setEditingTitle('')
    }
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    planning: { bg: 'var(--color-surface-overlay)', text: 'var(--text-tertiary)' },
    writing: { bg: 'var(--accent-muted)', text: 'var(--accent-primary)' },
    completed: { bg: 'rgba(126,184,74,0.15)', text: 'var(--color-ifline)' },
  }

  const statusLabels: Record<string, string> = {
    planning: '规划中',
    writing: '写作中',
    completed: '已完成',
  }

  // 无大纲状态
  if (!outline) {
    return (
      <div>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          大纲管理
        </h2>
        <div className="rounded-lg p-8 text-center" style={cardStyle}>
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
            尚未创建故事大纲
          </p>
          {isCreatingOutline ? (
            <div className="space-y-3 max-w-sm mx-auto">
              <div className="relative">
                <FloatingLabelInput
                  value={newOutlineTitle}
                  onChange={setNewOutlineTitle}
                  placeholder="输入大纲标题..."
                  label="标题"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateOutline()
                    if (e.key === 'Escape') setIsCreatingOutline(false)
                  }}
                  required
                  maxLength={100}
                />
              </div>
              <div className="flex gap-2 justify-center">
                <motion.button
                  onClick={() => setIsCreatingOutline(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-tertiary)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  取消
                </motion.button>
                <motion.button
                  onClick={handleCreateOutline}
                  disabled={!newOutlineTitle.trim()}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40 flex items-center gap-2"
                  style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Plus className="w-4 h-4" />
                  创建
                </motion.button>
              </div>
            </div>
          ) : (
            <motion.button
              onClick={() => setIsCreatingOutline(true)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              创建大纲
            </motion.button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            大纲管理
          </h2>
          <motion.span
            key={chapters.length}
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: 'rgba(91,142,232,0.15)', color: 'var(--color-outline)' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            {chapters.length} 章节
          </motion.span>
        </div>
        <motion.button
          onClick={() => setShowAddChapter(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: 'var(--text-secondary)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-3.5 h-3.5" />
          新增章节
        </motion.button>
      </div>

      <div className="mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {outline.title}
        </h3>
      </div>

      {/* 章节列表 */}
      <div className="space-y-2">
        {chapters.length === 0 && !showAddChapter ? (
          <div className="rounded-lg p-6 text-center" style={cardStyle}>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              暂无章节
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
              点击右上角按钮添加第一章
            </p>
          </div>
        ) : (
          chapters.map((chapter, index) => (
            <motion.div
              key={chapter.id}
              className="p-3 rounded-lg group"
              style={{
                ...cardStyle,
                backgroundColor: 'rgba(255,255,255,0.02)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'
              }}
              whileHover={{ x: 2 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-start gap-3">
                {/* 章节序号 */}
                <span
                  className="text-sm font-mono mt-0.5"
                  style={{ minWidth: '24px', color: 'var(--color-outline)', opacity: 0.7 }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                {/* 章节内容 */}
                <div className="flex-1 min-w-0">
                  {editingChapterId === chapter.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveTitle(chapter.id)}
                      onKeyDown={(e) => handleKeyDown(e, chapter.id)}
                      autoFocus
                      className="w-full px-2 py-1 rounded border text-sm focus:outline-none"
                      style={{
                        backgroundColor: 'var(--color-surface-base)',
                        borderColor: 'var(--color-outline)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => startEditTitle(chapter)}
                      className="font-medium text-sm cursor-pointer transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-outline)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-primary)'
                      }}
                    >
                      {chapter.title || '未命名章节'}
                    </div>
                  )}

                  {/* 章节摘要 */}
                  {chapter.summary && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
                      {chapter.summary}
                    </p>
                  )}

                  {/* 章节元信息 */}
                  <div className="flex items-center gap-3 mt-2">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: statusColors[chapter.status].bg,
                        color: statusColors[chapter.status].text,
                      }}
                    >
                      {statusLabels[chapter.status]}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {chapter.word_count.toLocaleString()} 字
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <motion.button
                    onClick={() => startEditTitle(chapter)}
                    className="p-1.5 rounded transition-all"
                    style={{ color: 'var(--text-tertiary)' }}
                    whileHover={{
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)',
                    }}
                    whileTap={{ scale: 0.9 }}
                    title="编辑标题"
                  >
                    <Edit2 className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    onClick={() => setSummaryModalChapterId(chapter.id)}
                    className="p-1.5 rounded transition-all"
                    style={{ color: 'var(--text-tertiary)' }}
                    whileHover={{
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)',
                    }}
                    whileTap={{ scale: 0.9 }}
                    title="编辑摘要"
                  >
                    <FileText className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    onClick={() => deleteChapter(chapter.id)}
                    className="p-1.5 rounded transition-all"
                    style={{ color: 'var(--text-tertiary)' }}
                    whileHover={{
                      backgroundColor: 'rgba(196,92,92,0.15)',
                      color: 'var(--color-danger)',
                    }}
                    whileTap={{ scale: 0.9 }}
                    title="删除章节"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* 添加章节输入框 */}
      <AnimatePresence>
        {showAddChapter && (
          <motion.div
            className="mt-3 p-3 rounded-lg"
            style={cardStyle}
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="relative">
              <FloatingLabelInput
                value={newChapterTitle}
                onChange={setNewChapterTitle}
                placeholder="输入章节标题..."
                label="章节标题"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddChapter()
                  if (e.key === 'Escape') {
                    setShowAddChapter(false)
                    setNewChapterTitle('')
                  }
                }}
                required
                maxLength={100}
              />
            </div>
            <div className="flex gap-2 justify-end mt-3">
              <motion.button
                onClick={() => {
                  setShowAddChapter(false)
                  setNewChapterTitle('')
                }}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-tertiary)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                whileTap={{ scale: 0.97 }}
              >
                取消
              </motion.button>
              <motion.button
                onClick={handleAddChapter}
                disabled={!newChapterTitle.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40 flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--color-outline)', color: '#fff' }}
                whileTap={{ scale: 0.97 }}
              >
                <Plus className="w-3.5 h-3.5" />
                添加
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 章节摘要编辑 Modal */}
      {summaryModalChapterId && (
        <ChapterSummaryModal
          chapter={chapters.find((c) => c.id === summaryModalChapterId)!}
          onSave={(summary) => {
            updateChapter(summaryModalChapterId, { summary })
            setSummaryModalChapterId(null)
          }}
          onClose={() => setSummaryModalChapterId(null)}
        />
      )}
    </div>
  )
}

// 章节摘要编辑弹窗
function ChapterSummaryModal({
  chapter,
  onSave,
  onClose,
}: {
  chapter: Chapter
  onSave: (summary: string) => void
  onClose: () => void
}) {
  const [summary, setSummary] = useState(chapter.summary || '')
  const [saveState, setSaveState] = useState<ValidationState>('idle')

  const handleSave = () => {
    setSaveState('saving')
    setTimeout(() => {
      onSave(summary)
      setSaveState('saved')
    }, 200)
  }

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-lg p-5"
        style={{ backgroundColor: 'var(--color-surface-base)', border: '1px solid var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            编辑章节摘要
          </h3>
          <motion.button
            onClick={onClose}
            className="p-1 rounded transition-all"
            style={{ color: 'var(--text-tertiary)' }}
            whileHover={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'var(--text-primary)',
            }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
          {chapter.title}
        </p>
        <FloatingLabelTextarea
          value={summary}
          onChange={setSummary}
          placeholder="编写章节摘要..."
          label="摘要"
          rows={4}
          maxLength={500}
        />
        <div className="flex items-center justify-between mt-4">
          <SaveStateIndicator state={saveState} />
          <div className="flex gap-2">
            <motion.button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              whileTap={{ scale: 0.97 }}
            >
              取消
            </motion.button>
            <motion.button
              onClick={handleSave}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2"
              style={{ backgroundColor: 'var(--color-outline)', color: '#fff' }}
              whileTap={{ scale: 0.97 }}
            >
              <Save className="w-4 h-4" />
              保存
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function EntityEditor({ category }: EntityEditorProps) {
  const {
    characters,
    items,
    locations,
    factions,
    worldSettings,
    rules,
    ifLines,
    generate,
    generateRelations,
  } = useSettingsStore()

  const [showAddForm, setShowAddForm] = useState(false)

  const handleGenerate = (type: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule') => {
    generate(type)
  }

  switch (category) {
    case 'character':
      return (
        <div>
          <SectionHeader
            title="角色管理"
            count={characters.length}
            onAdd={() => setShowAddForm(true)}
            onGenerate={() => handleGenerate('character')}
          />
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {characters.map((char) => (
                <motion.div
                  key={char.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <CharacterCard character={char} />
                </motion.div>
              ))}
            </AnimatePresence>
            {characters.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无角色</p>
                <p className="text-xs mt-1 opacity-70">点击下方按钮创建第一个角色</p>
              </div>
            )}
            <NewCharacterForm />
          </div>
        </div>
      )

    case 'item':
      return (
        <div>
          <SectionHeader
            title="物品管理"
            count={items.length}
            onAdd={() => setShowAddForm(true)}
            onGenerate={() => handleGenerate('item')}
          />
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <EntityCard
                    name={item.name}
                    description={item.description}
                    badge={item.owner ? `持有者: ${item.owner}` : undefined}
                    badgeColor={entityColors.item}
                    tags={item.tags}
                    entityType="item"
                    entityId={item.id}
                    onDelete={() => useSettingsStore.getState().deleteItem(item.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {items.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                <p className="text-sm">暂无物品</p>
              </div>
            )}
            {showAddForm && (
              <AddEntityForm
                placeholder="输入物品名称..."
                onAdd={(name) => {
                  useSettingsStore.getState().addItem({ name })
                  setShowAddForm(false)
                }}
                onCancel={() => setShowAddForm(false)}
              />
            )}
          </div>
        </div>
      )

    case 'location':
      return (
        <div>
          <SectionHeader
            title="地点管理"
            count={locations.length}
            onAdd={() => setShowAddForm(true)}
            onGenerate={() => handleGenerate('location')}
          />
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {locations.map((loc) => (
                <motion.div
                  key={loc.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <EntityCard
                    name={loc.name}
                    description={loc.description}
                    badge={loc.importance === 'major' ? '重要地点' : '次要地点'}
                    badgeColor={entityColors.location}
                    tags={loc.tags}
                    entityType="location"
                    entityId={loc.id}
                    onDelete={() => useSettingsStore.getState().deleteLocation(loc.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {locations.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                <p className="text-sm">暂无地点</p>
              </div>
            )}
            {showAddForm && (
              <AddEntityForm
                placeholder="输入地点名称..."
                onAdd={(name) => {
                  useSettingsStore.getState().addLocation({ name, importance: 'minor' })
                  setShowAddForm(false)
                }}
                onCancel={() => setShowAddForm(false)}
              />
            )}
          </div>
        </div>
      )

    case 'faction':
      return (
        <div>
          <SectionHeader
            title="势力管理"
            count={factions.length}
            onAdd={() => setShowAddForm(true)}
            onGenerate={() => handleGenerate('faction')}
          />
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {factions.map((fac) => (
                <motion.div
                  key={fac.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <EntityCard
                    name={fac.name}
                    description={fac.description}
                    badge={fac.type}
                    badgeColor={entityColors.faction}
                    tags={fac.tags}
                    entityType="faction"
                    entityId={fac.id}
                    onDelete={() => useSettingsStore.getState().deleteFaction(fac.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {factions.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                <p className="text-sm">暂无势力</p>
              </div>
            )}
            {showAddForm && (
              <AddEntityForm
                placeholder="输入势力名称..."
                onAdd={(name) => {
                  useSettingsStore.getState().addFaction({ name, type: 'other' })
                  setShowAddForm(false)
                }}
                onCancel={() => setShowAddForm(false)}
              />
            )}
          </div>
        </div>
      )

    case 'world':
      return (
        <div>
          <SectionHeader
            title="世界观设定"
            count={worldSettings.length}
            onAdd={() => setShowAddForm(true)}
            onGenerate={() => handleGenerate('world')}
          />
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {worldSettings.map((world) => (
                <motion.div
                  key={world.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <EntityCard
                    name={world.name}
                    description={world.description}
                    badgeColor={entityColors.world}
                    tags={world.tags}
                    entityType="world"
                    entityId={world.id}
                    onDelete={() => useSettingsStore.getState().deleteWorldSetting(world.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {worldSettings.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                <p className="text-sm">暂无世界观设定</p>
              </div>
            )}
            {showAddForm && (
              <AddEntityForm
                placeholder="输入世界观设定名称..."
                onAdd={(name) => {
                  useSettingsStore.getState().addWorldSetting({ name, description: '' })
                  setShowAddForm(false)
                }}
                onCancel={() => setShowAddForm(false)}
              />
            )}
          </div>
        </div>
      )

    case 'rule':
      return (
        <div>
          <SectionHeader
            title="规则设定"
            count={rules.length}
            onAdd={() => setShowAddForm(true)}
            onGenerate={() => handleGenerate('rule')}
          />
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {rules.map((rule) => (
                <motion.div
                  key={rule.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <EntityCard
                    name={rule.name}
                    description={rule.description}
                    badge={rule.type}
                    badgeColor={entityColors.rule}
                    tags={rule.tags}
                    entityType="rule"
                    entityId={rule.id}
                    onDelete={() => useSettingsStore.getState().deleteRule(rule.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {rules.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                <p className="text-sm">暂无规则设定</p>
              </div>
            )}
            {showAddForm && (
              <AddEntityForm
                placeholder="输入规则名称..."
                onAdd={(name) => {
                  useSettingsStore.getState().addRule({ name, description: '', type: 'other' })
                  setShowAddForm(false)
                }}
                onCancel={() => setShowAddForm(false)}
              />
            )}
          </div>
        </div>
      )

    case 'outline':
      return <OutlineEditor />

    case 'ifline':
      return (
        <div>
          <SectionHeader
            title="IF线管理"
            count={ifLines.length}
            onAdd={() => setShowAddForm(true)}
            onGenerate={generateRelations}
          />
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {ifLines.map((ifline) => (
                <motion.div
                  key={ifline.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <EntityCard
                    name={ifline.title}
                    description={ifline.description}
                    badge={ifline.sync_mode === 'auto' ? '自动同步' : '手动同步'}
                    badgeColor={entityColors.ifline}
                    tags={ifline.tags}
                    entityType="ifline"
                    entityId={ifline.id}
                    onDelete={() => useSettingsStore.getState().deleteIFLine(ifline.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {ifLines.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                <p className="text-sm">暂无IF线</p>
              </div>
            )}
            {showAddForm && (
              <AddEntityForm
                placeholder="输入IF线标题..."
                onAdd={(title) => {
                  useSettingsStore.getState().addIFLine({ title, sync_mode: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                  setShowAddForm(false)
                }}
                onCancel={() => setShowAddForm(false)}
              />
            )}
          </div>
        </div>
      )

    default:
      return (
        <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
          <p>选择左侧分类开始编辑</p>
        </div>
      )
  }
}

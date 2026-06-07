/**
 * SchemaFieldComponents — Fallback field renderers and batch UI for SchemaDrivenEditor.
 * Extracted to keep the main component under 300 lines.
 */

import { useState } from 'react'
import { Plus, CheckSquare, Square, Trash2, Tag, X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { FieldDef } from '@/shared/entitySchema'
import { FloatingLabelInput, FloatingLabelTextarea } from './EntityFieldGroup'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { inputStyle, inputPadding } from './EntityFieldStyles'

// ============================================
// SchemaFieldRenderer — renders a single field by type
// ============================================

export function SchemaFieldRenderer({
  field,
  value,
  onChange,
  allEntities,
}: {
  field: FieldDef
  value: any
  onChange: (key: string, value: any) => void
  allEntities?: Array<Record<string, any>>
}) {
  const handleChange = (v: any) => onChange(field.key, v)

  switch (field.type) {
    case 'text':
      return (
        <FloatingLabelInput
          value={value ?? ''}
          onChange={handleChange}
          placeholder={field.placeholder}
          label={field.label}
          required={field.required}
          maxLength={field.maxLength}
        />
      )

    case 'textarea':
    case 'markdown':
      return (
        <FloatingLabelTextarea
          value={value ?? ''}
          onChange={handleChange}
          placeholder={field.placeholder}
          label={field.label}
          maxLength={field.maxLength}
        />
      )

    case 'select':
      return <SelectFieldFallback field={field} value={value ?? ''} onChange={handleChange} />

    case 'number':
      return <NumberFieldFallback field={field} value={value ?? ''} onChange={handleChange} />

    case 'date':
      return <DateFieldFallback field={field} value={value ?? ''} onChange={handleChange} />

    case 'array':
      return <ArrayFieldFallback field={field} value={value ?? []} onChange={handleChange} />

    case 'entity_ref':
      return (
        <EntityRefFieldFallback
          field={field}
          value={value ?? ''}
          onChange={handleChange}
          allEntities={allEntities}
        />
      )

    default:
      return (
        <FloatingLabelInput
          value={value ?? ''}
          onChange={handleChange}
          placeholder={field.placeholder}
          label={field.label}
        />
      )
  }
}

// ============================================
// Fallback field components
// ============================================

function SelectFieldFallback({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const [isFocused, setIsFocused] = useState(false)
  return (
    <div className="relative">
      <label className="block text-xs font-medium mb-1.5" style={{ color: isFocused ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
        {field.label}
        {field.required && <span className="ml-0.5" style={{ color: 'var(--color-danger)' }}>*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-full rounded-md text-sm focus:outline-none appearance-none cursor-pointer"
        style={{ ...inputStyle, ...inputPadding, paddingTop: '10px', paddingBottom: '10px', borderColor: isFocused ? 'var(--border-focus)' : 'var(--border-default)' }}
      >
        <option value="">{field.placeholder || `选择${field.label}`}</option>
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function NumberFieldFallback({ field, value, onChange }: { field: FieldDef; value: string | number; onChange: (v: string) => void }) {
  return <FloatingLabelInput value={String(value ?? '')} onChange={(v) => onChange(v)} placeholder={field.placeholder} label={field.label} required={field.required} />
}

function DateFieldFallback({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const [isFocused, setIsFocused] = useState(false)
  return (
    <div className="relative">
      <label className="block text-xs font-medium mb-1.5" style={{ color: isFocused ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{field.label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-full rounded-md text-sm focus:outline-none"
        style={{ ...inputStyle, ...inputPadding, paddingTop: '10px', paddingBottom: '10px', borderColor: isFocused ? 'var(--border-focus)' : 'var(--border-default)' }}
      />
    </div>
  )
}

function ArrayFieldFallback({ field, value, onChange }: { field: FieldDef; value: string[]; onChange: (v: string[]) => void }) {
  const [inputVal, setInputVal] = useState('')
  const tags: string[] = Array.isArray(value) ? value : []

  const addTag = () => {
    const trimmed = inputVal.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
      setInputVal('')
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{field.label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--accent-muted)', color: 'var(--accent-primary)' }}>
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="hover:opacity-70">
              <Icon icon={X} size="xs" color="inherit" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder={field.placeholder || '输入后按 Enter 添加'}
          className="flex-1 rounded-md text-sm focus:outline-none"
          style={{ ...inputStyle, ...inputPadding, paddingTop: '10px', paddingBottom: '10px' }}
        />
        <motion.button type="button" onClick={addTag} className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ backgroundColor: 'var(--accent-muted)', color: 'var(--accent-primary)' }} whileTap={{ scale: 0.95 }}>
          <Icon icon={Plus} size="xs" color="inherit" />
        </motion.button>
      </div>
    </div>
  )
}

function EntityRefFieldFallback({ field, value, onChange, allEntities }: { field: FieldDef; value: string; onChange: (v: string) => void; allEntities?: Array<Record<string, any>> }) {
  const [isFocused, setIsFocused] = useState(false)
  return (
    <div className="relative">
      <label className="block text-xs font-medium mb-1.5" style={{ color: isFocused ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{field.label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-full rounded-md text-sm focus:outline-none appearance-none cursor-pointer"
        style={{ ...inputStyle, ...inputPadding, paddingTop: '10px', paddingBottom: '10px', borderColor: isFocused ? 'var(--border-focus)' : 'var(--border-default)' }}
      >
        <option value="">{field.placeholder || `选择${field.entityType || '关联实体'}`}</option>
        {allEntities?.map((entity) => (
          <option key={entity.id} value={entity.id}>{entity.name || entity.title || `#${entity.id}`}</option>
        ))}
      </select>
    </div>
  )
}

// ============================================
// BatchSelectionCheckbox
// ============================================

export function BatchSelectionCheckbox({ checked, onChange, accentColor }: { checked: boolean; onChange: () => void; accentColor: string }) {
  return (
    <motion.button
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className="flex-shrink-0 p-1 rounded transition-colors"
      style={{ color: checked ? accentColor : 'var(--text-tertiary)' }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      <Icon icon={checked ? CheckSquare : Square} size="sm" color="inherit" />
    </motion.button>
  )
}

// ============================================
// BatchToolbar
// ============================================

export function BatchToolbar({
  selectedCount, totalCount, onBatchDelete, onBatchTagUpdate, onClearSelection, onSelectAll, accentColor,
}: {
  selectedCount: number; totalCount: number; onBatchDelete: () => void; onBatchTagUpdate: (tags: string[]) => void
  onClearSelection: () => void; onSelectAll: () => void; accentColor: string
}) {
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInputValue, setTagInputValue] = useState('')

  const handleTagSubmit = () => {
    const tags = tagInputValue.split(',').map((t) => t.trim()).filter(Boolean)
    if (tags.length > 0) { onBatchTagUpdate(tags); setTagInputValue(''); setShowTagInput(false) }
  }

  return (
    <motion.div
      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-3"
      style={{ backgroundColor: 'color-mix(in srgb, var(--accent-primary) 8%, var(--color-surface-raised))', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)', boxShadow: 'var(--shadow-card)' }}
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <motion.button onClick={onSelectAll} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all" style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Icon icon={CheckSquare} size="xs" color="inherit" />
          {selectedCount === totalCount ? '取消全选' : '全选'}
        </motion.button>
        <span className="text-xs font-medium" style={{ color: accentColor }}>已选 {selectedCount} 项</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {showTagInput ? (
          <div className="flex items-center gap-1">
            <input type="text" value={tagInputValue} onChange={(e) => setTagInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleTagSubmit(); if (e.key === 'Escape') setShowTagInput(false) }} placeholder="标签名(逗号分隔)" className="px-2 py-1 rounded text-xs outline-none" style={{ backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--border-focus)', color: 'var(--text-primary)', width: '160px' }} autoFocus />
            <motion.button onClick={handleTagSubmit} className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: 'var(--accent-muted)', color: 'var(--accent-primary)' }} whileTap={{ scale: 0.95 }}>确定</motion.button>
            <motion.button onClick={() => setShowTagInput(false)} className="p-1 rounded text-[var(--text-tertiary)]" whileTap={{ scale: 0.95 }}><Icon icon={X} size="xs" color="inherit" /></motion.button>
          </div>
        ) : (
          <>
            <motion.button onClick={() => setShowTagInput(true)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all" style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Icon icon={Tag} size="xs" color="inherit" /> 批量标签更新
            </motion.button>
            <motion.button onClick={onBatchDelete} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 15%, transparent)' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Icon icon={Trash2} size="xs" color="inherit" /> 批量删除
            </motion.button>
          </>
        )}
        <motion.button onClick={onClearSelection} className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Icon icon={X} size="xs" color="inherit" />
        </motion.button>
      </div>
    </motion.div>
  )
}

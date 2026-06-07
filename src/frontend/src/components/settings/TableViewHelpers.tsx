import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, ArrowDown, ChevronDown, EyeOff } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import type { FieldDef } from '@/shared/entitySchema'

/* ---- Sort direction ---- */

export type SortDir = 'asc' | 'desc' | null

/* ---- Inline Cell Editor ---- */

export function CellEditor({
  value,
  field,
  onSave,
  onCancel,
}: {
  value: string
  field: FieldDef
  onSave: (v: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const handleBlur = useCallback(() => {
    onSave(ref.current?.value ?? value)
  }, [onSave, value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSave(ref.current?.value ?? value)
      }
    },
    [onCancel, onSave, value],
  )

  if (field.type === 'textarea' || field.type === 'markdown') {
    return (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        defaultValue={value}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        rows={2}
        className="w-full bg-[var(--color-surface-raised)] text-[var(--text-primary)] text-xs px-1.5 py-1 rounded border border-[var(--accent-primary)] outline-none resize-none"
      />
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <select
        defaultValue={value}
        onChange={(e) => onSave(e.target.value)}
        onBlur={handleBlur}
        className="w-full bg-[var(--color-surface-raised)] text-[var(--text-primary)] text-xs px-1.5 py-1 rounded border border-[var(--accent-primary)] outline-none"
        autoFocus
      >
        <option value="">--</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type={field.type === 'number' ? 'number' : 'text'}
      defaultValue={value}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full bg-[var(--color-surface-raised)] text-[var(--text-primary)] text-xs px-1.5 py-1 rounded border border-[var(--accent-primary)] outline-none"
    />
  )
}

/* ---- Column Filter Dropdown ---- */

export function ColumnFilter({
  values,
  activeValues,
  onToggle,
  onClose,
}: {
  values: string[]
  activeValues: Set<string>
  onToggle: (v: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      className="absolute top-full left-0 mt-1 z-30 min-w-[160px] max-h-[200px] overflow-y-auto rounded-lg py-1 bg-[var(--color-surface-raised)] border border-[var(--border-default)] shadow-lg"
    >
      {values.map((v) => {
        const active = activeValues.has(v)
        return (
          <button
            key={v}
            onClick={() => onToggle(v)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <span
              className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0"
              style={{
                borderColor: active ? 'var(--accent-primary)' : 'var(--border-default)',
                backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
              }}
            >
              {active && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            <span className="text-[var(--text-primary)] truncate">{v || '(空)'}</span>
          </button>
        )
      })}
      {values.length === 0 && (
        <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">无数据</div>
      )}
    </motion.div>
  )
}

/* ---- Checkbox (shared) ---- */

export function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-3.5 h-3.5 rounded accent-[var(--accent-primary)] cursor-pointer"
    />
  )
}

/* ---- Header Cell ---- */

export function HeaderCell({
  field,
  sortDir,
  filterValues,
  activeFilterValues,
  onSort,
  onToggleFilter,
  onToggleVisibility,
}: {
  field: FieldDef
  sortDir: SortDir
  filterValues: string[]
  activeFilterValues: Set<string>
  onSort: () => void
  onToggleFilter: (v: string) => void
  onToggleVisibility: () => void
}) {
  const [showFilter, setShowFilter] = useState(false)
  const isFiltered = activeFilterValues.size < filterValues.length && filterValues.length > 0

  return (
    <th
      className="relative px-3 py-2 text-left text-[11px] font-semibold text-[var(--text-secondary)] select-none group"
      style={{ height: 36, borderBottom: '1px solid var(--border-default)' }}
    >
      <div className="flex items-center gap-1">
        <button onClick={onSort} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
          <span>{field.label}</span>
          {field.required && <span className="text-[var(--color-danger)]">*</span>}
          {sortDir === 'asc' && <Icon icon={ArrowUp} size="xs" color="accent" />}
          {sortDir === 'desc' && <Icon icon={ArrowDown} size="xs" color="accent" />}
        </button>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`p-0.5 rounded transition-colors ${isFiltered ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100'}`}
          title="筛选"
        >
          <Icon icon={ChevronDown} size="xs" color="inherit" />
        </button>
        <button
          onClick={onToggleVisibility}
          className="p-0.5 rounded text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-colors"
          title="隐藏列"
        >
          <Icon icon={EyeOff} size="xs" color="inherit" />
        </button>
      </div>
      <AnimatePresence>
        {showFilter && (
          <ColumnFilter
            values={filterValues}
            activeValues={activeFilterValues}
            onToggle={onToggleFilter}
            onClose={() => setShowFilter(false)}
          />
        )}
      </AnimatePresence>
    </th>
  )
}

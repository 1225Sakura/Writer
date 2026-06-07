/**
 * ListControls — Sort / Filter / Group toolbar for entity lists.
 * US-009: List view sort / filter / group controls.
 */

import { useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, Layers, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EntitySchema, FieldDef } from '@/shared/entitySchema'
import { FieldType } from '@/shared/entitySchema'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

// ============================================
// Types
// ============================================

export type SortDirection = 'asc' | 'desc'

export interface ListControlsProps {
  sortField: string | null
  sortDirection: SortDirection
  filterValues: Record<string, string>
  groupField: string | null
  schema: EntitySchema
  onSortChange: (field: string | null, direction: SortDirection) => void
  onFilterChange: (field: string, value: string) => void
  onGroupChange: (field: string | null) => void
}

// ============================================
// Helper: fields eligible for sorting (text, select, date, number)
// ============================================

const SORTABLE_TYPES = new Set<FieldType>([FieldType.text, FieldType.select, FieldType.date, FieldType.number])

function getSortableFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter((f) => SORTABLE_TYPES.has(f.type))
}

function getFilterableFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter((f) => f.type === FieldType.select)
}

function getGroupableFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter((f) => f.type === FieldType.select || f.key === 'name' || f.key === 'title')
}

// ============================================
// CompactSelect — lightweight inline select
// ============================================

function CompactSelect({
  value,
  options,
  placeholder,
  onChange,
  icon,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  placeholder: string
  onChange: (val: string) => void
  icon: typeof ArrowUpDown
}) {
  const isActive = value !== ''
  return (
    <div className="relative flex items-center gap-1">
      <Icon icon={icon} size="xs" color={isActive ? 'accent' : 'muted'} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md text-xs appearance-none cursor-pointer pr-5 pl-2 py-1.5 focus:outline-none transition-colors"
        style={{
          backgroundColor: isActive
            ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--color-surface-input))'
            : 'var(--color-surface-input)',
          border: `1px solid ${isActive ? 'var(--border-focus)' : 'var(--border-default)'}`,
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          minWidth: '90px',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

// ============================================
// SortDirectionToggle
// ============================================

function SortDirectionToggle({
  direction,
  onToggle,
  disabled,
}: {
  direction: SortDirection
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <motion.button
      onClick={onToggle}
      disabled={disabled}
      className="flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        backgroundColor: disabled ? 'transparent' : 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
        color: disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
      }}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      title={direction === 'asc' ? '升序 (点击切换)' : '降序 (点击切换)'}
    >
      <Icon icon={direction === 'asc' ? ArrowUp : ArrowDown} size="xs" color="inherit" />
    </motion.button>
  )
}

// ============================================
// FilterTag — small pill for active filter
// ============================================

function FilterTag({
  fieldLabel,
  valueLabel,
  onClear,
}: {
  fieldLabel: string
  valueLabel: string
  onClear: () => void
}) {
  return (
    <motion.span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--accent-primary) 10%, var(--color-surface-raised))',
        color: 'var(--accent-primary)',
        border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      {fieldLabel}: {valueLabel}
      <button
        onClick={onClear}
        className="ml-0.5 hover:opacity-60 transition-opacity"
        aria-label={`清除筛选: ${fieldLabel}`}
      >
        <Icon icon={X} size="xs" color="inherit" />
      </button>
    </motion.span>
  )
}

// ============================================
// ListControls — main component
// ============================================

export function ListControls({
  sortField,
  sortDirection,
  filterValues,
  groupField,
  schema,
  onSortChange,
  onFilterChange,
  onGroupChange,
}: ListControlsProps) {
  const sortableFields = useMemo(() => getSortableFields(schema.fields), [schema.fields])
  const filterableFields = useMemo(() => getFilterableFields(schema.fields), [schema.fields])
  const groupableFields = useMemo(() => getGroupableFields(schema.fields), [schema.fields])

  const sortOptions = useMemo(
    () => [
      { value: 'name', label: '名称' },
      { value: 'id', label: '创建顺序' },
      ...sortableFields
        .filter((f) => f.key !== 'name')
        .map((f) => ({ value: f.key, label: f.label })),
    ],
    [sortableFields],
  )

  const hasActiveFilters = Object.values(filterValues).some((v) => v !== '')

  const handleSortFieldChange = (field: string) => {
    if (field === '') {
      onSortChange(null, sortDirection)
    } else {
      onSortChange(field, sortDirection)
    }
  }

  const handleToggleDirection = () => {
    onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc')
  }

  const handleClearAllFilters = () => {
    for (const key of Object.keys(filterValues)) {
      if (filterValues[key] !== '') {
        onFilterChange(key, '')
      }
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg mb-3"
      style={{
        backgroundColor: 'var(--color-surface-base)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Sort controls */}
      <div className="flex items-center gap-1.5">
        <CompactSelect
          value={sortField || ''}
          options={sortOptions}
          placeholder="排序..."
          onChange={handleSortFieldChange}
          icon={ArrowUpDown}
        />
        <SortDirectionToggle
          direction={sortDirection}
          onToggle={handleToggleDirection}
          disabled={!sortField}
        />
      </div>

      {/* Divider */}
      {filterableFields.length > 0 && (
        <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
      )}

      {/* Filter controls */}
      {filterableFields.map((field) => (
        <CompactSelect
          key={field.key}
          value={filterValues[field.key] || ''}
          options={(field.options || []).map((o) => ({ value: o.value, label: o.label }))}
          placeholder={`筛选${field.label}...`}
          onChange={(val) => onFilterChange(field.key, val)}
          icon={Filter}
        />
      ))}

      {/* Group control */}
      {groupableFields.length > 0 && (
        <>
          <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
          <CompactSelect
            value={groupField || ''}
            options={groupableFields.map((f) => ({ value: f.key, label: f.label }))}
            placeholder="分组..."
            onChange={(val) => onGroupChange(val || null)}
            icon={Layers}
          />
        </>
      )}

      {/* Active filter tags */}
      <AnimatePresence>
        {hasActiveFilters && (
          <motion.div
            className="flex items-center gap-1.5 ml-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {filterableFields.map((field) => {
              const val = filterValues[field.key]
              if (!val) return null
              const opt = field.options?.find((o) => o.value === val)
              return (
                <FilterTag
                  key={field.key}
                  fieldLabel={field.label}
                  valueLabel={opt?.label || val}
                  onClear={() => onFilterChange(field.key, '')}
                />
              )
            })}
            <motion.button
              onClick={handleClearAllFilters}
              className="text-[11px] px-1.5 py-0.5 rounded font-medium transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              whileHover={{ color: 'var(--color-danger)' }}
              whileTap={{ scale: 0.95 }}
            >
              清除全部
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// Utility: apply sort / filter / group to entity arrays
// ============================================

/** Sort entities by a field */
export function sortEntities(
  entities: Array<Record<string, any>>,
  field: string | null,
  direction: SortDirection,
): Array<Record<string, any>> {
  if (!field) return entities
  const sorted = [...entities].sort((a, b) => {
    const aVal = a[field] ?? ''
    const bVal = b[field] ?? ''
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal
    }
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    if (aStr < bStr) return direction === 'asc' ? -1 : 1
    if (aStr > bStr) return direction === 'asc' ? 1 : -1
    return 0
  })
  return sorted
}

/** Filter entities by active filter values */
export function filterEntities(
  entities: Array<Record<string, any>>,
  filterValues: Record<string, string>,
): Array<Record<string, any>> {
  const activeFilters = Object.entries(filterValues).filter(([, v]) => v !== '')
  if (activeFilters.length === 0) return entities
  return entities.filter((entity) =>
    activeFilters.every(([key, val]) => String(entity[key] ?? '') === val),
  )
}

/** Group entities by a field, returns ordered array of { group, entities } */
export function groupEntities(
  entities: Array<Record<string, any>>,
  field: string | null,
): Array<{ group: string; entities: Array<Record<string, any>> }> {
  if (!field) return [{ group: '', entities }]
  const map = new Map<string, Array<Record<string, any>>>()
  for (const entity of entities) {
    const key = String(entity[field] ?? '未分类')
    const arr = map.get(key) || []
    arr.push(entity)
    map.set(key, arr)
  }
  return Array.from(map.entries()).map(([group, ents]) => ({ group, entities: ents }))
}

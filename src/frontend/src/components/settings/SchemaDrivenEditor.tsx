/**
 * SchemaDrivenEditor — Generic entity editor driven by EntitySchema.
 * Replaces the switch-case logic in EntityEditor.tsx.
 * US-003: Schema-Driven Editor Component
 * US-009: Integrated sort / filter / group controls
 */

import { useState, useCallback, useMemo } from 'react'
import { Plus, Users, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EntitySchema } from '@/shared/entitySchema'
import { FieldType } from '@/shared/entitySchema'
import { SectionHeader, EmptyState } from './EntityFieldGroup'
import { entityColors, cardStyle } from './EntityCard'
import { entityListVariants, entityItemVariants } from './EntityActions'
import { Icon } from '@/components/ui/Icon'
import { SchemaFieldRenderer, BatchSelectionCheckbox, BatchToolbar } from './SchemaFieldComponents'
import { ListControls, sortEntities, filterEntities, groupEntities } from './ListControls'
import type { SortDirection } from './ListControls'

// ============================================
// Props
// ============================================

interface SchemaDrivenEditorProps {
  schema: EntitySchema
  entities: Array<Record<string, any>>
  onAdd: (data: Record<string, any>) => void
  onUpdate: (id: number, data: Record<string, any>) => void
  onDelete: (id: number) => void
  onBatchDelete?: (ids: number[]) => void
  onBatchTagUpdate?: (ids: number[], tags: string[]) => void
  accentColor?: string
}

// ============================================
// AddEntityFormInline — schema-driven add form
// ============================================

function AddEntityFormInline({
  schema,
  accentColor,
  onAdd,
  onCancel,
}: {
  schema: EntitySchema
  accentColor: string
  onAdd: (data: Record<string, any>) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<Record<string, any>>({})

  const handleChange = useCallback((key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }, [])

  const isValid = schema.fields
    .filter((f) => f.required)
    .every((f) => {
      const v = formData[f.key]
      return typeof v === 'string' ? v.trim().length > 0 : v != null
    })

  return (
    <motion.div className="p-4 rounded-lg space-y-4" style={cardStyle} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      {schema.fields.map((field) => (
        <SchemaFieldRenderer key={field.key} field={field} value={formData[field.key]} onChange={handleChange} />
      ))}
      <div className="flex items-center justify-end gap-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <motion.button onClick={onCancel} className="px-4 py-2 rounded-md text-sm font-medium transition-all" style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }} whileTap={{ scale: 0.97 }}>
          取消
        </motion.button>
        <motion.button onClick={() => isValid && onAdd(formData)} disabled={!isValid} className="px-5 py-2 rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2" style={{ backgroundColor: isValid ? accentColor : 'var(--color-surface-overlay)', color: isValid ? 'var(--paper-100)' : 'var(--text-tertiary)' }} whileTap={{ scale: 0.97 }}>
          <Icon icon={Plus} size="sm" color="inherit" /> 添加
        </motion.button>
      </div>
    </motion.div>
  )
}

// ============================================
// InlineEditableCard — entity card with inline editing
// ============================================

function InlineEditableCard({
  entity, schema, accentColor, onUpdate, onDelete, batchCheckbox,
}: {
  entity: Record<string, any>
  schema: EntitySchema
  accentColor: string
  onUpdate: (id: number, data: Record<string, any>) => void
  onDelete: (id: number) => void
  batchCheckbox?: React.ReactNode
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, any>>({})

  const handleEdit = () => { setEditData({ ...entity }); setIsEditing(true) }
  const handleSave = () => { onUpdate(entity.id, editData); setIsEditing(false) }
  const handleCancel = () => { setIsEditing(false); setEditData({}) }

  const handleChange = useCallback((key: string, value: any) => {
    setEditData((prev) => ({ ...prev, [key]: value }))
  }, [])

  const displayName = entity.name || entity.title || entity[schema.fields[0]?.key] || `#${entity.id}`
  const displayDesc = entity.description || entity[schema.fields.find((f) => f.type === FieldType.textarea)?.key || '']

  if (isEditing) {
    return (
      <motion.div className="p-4 rounded-lg space-y-3" style={cardStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {schema.fields.map((field) => (
          <SchemaFieldRenderer key={field.key} field={field} value={editData[field.key]} onChange={handleChange} />
        ))}
        <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <motion.button onClick={handleCancel} className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }} whileTap={{ scale: 0.97 }}>取消</motion.button>
          <motion.button onClick={handleSave} className="px-4 py-1.5 rounded-md text-xs font-medium" style={{ backgroundColor: accentColor, color: 'var(--paper-100)' }} whileTap={{ scale: 0.97 }}>保存</motion.button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      {batchCheckbox}
      <div className="flex-1 min-w-0 p-3 rounded-lg group relative cursor-pointer" style={{ backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }} onClick={handleEdit}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-[var(--text-primary)]">{String(displayName)}</h3>
            {displayDesc && <p className="text-xs line-clamp-2 text-[var(--text-tertiary)] leading-relaxed mt-1">{String(displayDesc)}</p>}
          </div>
          <div className="flex gap-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <motion.button onClick={(e) => { e.stopPropagation(); handleEdit() }} className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Icon icon={Plus} size="xs" color="inherit" />
            </motion.button>
            <motion.button onClick={(e) => { e.stopPropagation(); onDelete(entity.id) }} className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--vermillion-muted)] hover:text-[var(--color-danger)]" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Icon icon={Trash2} size="xs" color="inherit" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// SchemaDrivenEditor — main exported component
// ============================================

export function SchemaDrivenEditor({
  schema, entities, onAdd, onUpdate, onDelete, onBatchDelete, onBatchTagUpdate, accentColor: accentColorProp,
}: SchemaDrivenEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // US-009: sort / filter / group state
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [groupField, setGroupField] = useState<string | null>(null)

  const handleSortChange = useCallback((field: string | null, direction: SortDirection) => {
    setSortField(field)
    setSortDirection(direction)
  }, [])

  const handleFilterChange = useCallback((field: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleGroupChange = useCallback((field: string | null) => {
    setGroupField(field)
  }, [])

  const accentColor = accentColorProp || entityColors[schema.entityType]?.text || 'var(--accent-primary)'
  const isBatchable = !!(onBatchDelete || onBatchTagUpdate)

  // US-009: compute processed entities (filter -> sort -> group)
  const filteredEntities = useMemo(() => filterEntities(entities, filterValues), [entities, filterValues])
  const sortedEntities = useMemo(() => sortEntities(filteredEntities, sortField, sortDirection), [filteredEntities, sortField, sortDirection])
  const groupedEntities = useMemo(() => groupEntities(sortedEntities, groupField), [sortedEntities, groupField])

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }, [])
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])
  const selectAll = useCallback(() => {
    setSelectedIds((prev) => prev.size === filteredEntities.length ? new Set() : new Set(filteredEntities.map((e) => e.id)))
  }, [filteredEntities])
  const handleBatchDelete = useCallback(() => { if (selectedIds.size > 0) { onBatchDelete?.(Array.from(selectedIds)); setSelectedIds(new Set()) } }, [selectedIds, onBatchDelete])
  const handleBatchTagUpdate = useCallback((tags: string[]) => { if (selectedIds.size > 0) { onBatchTagUpdate?.(Array.from(selectedIds), tags); setSelectedIds(new Set()) } }, [selectedIds, onBatchTagUpdate])

  /** Render a list of entity cards */
  const renderEntityList = (list: Array<Record<string, any>>) => (
    <AnimatePresence mode="popLayout">
      {list.map((entity) => (
        <motion.div key={entity.id} layout variants={entityItemVariants}>
          <InlineEditableCard
            entity={entity}
            schema={schema}
            accentColor={accentColor}
            onUpdate={onUpdate}
            onDelete={onDelete}
            batchCheckbox={isBatchable ? (
              <div className="pt-2 flex-shrink-0">
                <BatchSelectionCheckbox checked={selectedIds.has(entity.id)} onChange={() => toggleSelection(entity.id)} accentColor={accentColor} />
              </div>
            ) : undefined}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  )

  return (
    <div>
      <SectionHeader title={`${schema.entityType}管理`} count={entities.length} onAdd={() => setShowAddForm(true)} />

      {/* US-009: Sort / Filter / Group toolbar */}
      <ListControls
        sortField={sortField}
        sortDirection={sortDirection}
        filterValues={filterValues}
        groupField={groupField}
        schema={schema}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        onGroupChange={handleGroupChange}
      />

      <AnimatePresence>
        {isBatchable && selectedIds.size > 0 && (
          <BatchToolbar selectedCount={selectedIds.size} totalCount={filteredEntities.length} onBatchDelete={handleBatchDelete} onBatchTagUpdate={handleBatchTagUpdate} onClearSelection={clearSelection} onSelectAll={selectAll} accentColor={accentColor} />
        )}
      </AnimatePresence>

      <motion.div className="space-y-3" variants={entityListVariants} initial="hidden" animate="visible" exit="exit">
        {groupedEntities.length > 1 || (groupedEntities.length === 1 && groupedEntities[0].group !== '') ? (
          /* Grouped rendering */
          groupedEntities.map((g) => (
            <div key={g.group} className="space-y-3">
              <div
                className="flex items-center gap-2 px-1 pt-2 pb-1"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  {g.group}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--text-tertiary)' }}>
                  {g.entities.length}
                </span>
              </div>
              {renderEntityList(g.entities)}
            </div>
          ))
        ) : (
          /* Flat rendering */
          renderEntityList(sortedEntities)
        )}

        {filteredEntities.length === 0 && entities.length > 0 && (
          <EmptyState icon={Users} title="无匹配结果" subtitle="尝试调整筛选条件" color={accentColor} />
        )}

        {entities.length === 0 && (
          <EmptyState icon={Users} title={`暂无${schema.entityType}`} subtitle="点击下方按钮创建第一个" color={accentColor} />
        )}

        {showAddForm && (
          <motion.div variants={entityItemVariants}>
            <AddEntityFormInline schema={schema} accentColor={accentColor} onAdd={(data) => { onAdd(data); setShowAddForm(false) }} onCancel={() => setShowAddForm(false)} />
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

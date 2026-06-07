import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Eye } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { entityColors } from './EntityCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { CellEditor, HeaderCell, Checkbox } from './TableViewHelpers'
import type { EntitySchema } from '@/shared/entitySchema'

/* ---- Props ---- */

export interface TableViewProps {
  schema: EntitySchema
  entities: Array<Record<string, any>>
  onUpdate: (id: number, data: Record<string, any>) => void
  onDelete: (id: number) => void
  onBatchDelete?: (ids: number[]) => void
  accentColor?: string
}

/* ---- Main Component ---- */

export function TableView({
  schema,
  entities,
  onUpdate,
  onDelete,
  onBatchDelete,
  accentColor,
}: TableViewProps) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)
  const [filters, setFilters] = useState<Record<string, Set<string>>>({})
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editingCell, setEditingCell] = useState<{ id: number; key: string } | null>(null)
  const [showColConfig, setShowColConfig] = useState(false)

  const entityKey = schema.entityType as keyof typeof entityColors
  const color = accentColor || entityColors[entityKey]?.text || 'var(--accent-primary)'

  /* ---- Derived filter options per field ---- */

  const filterOptions = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const f of schema.fields) {
      const vals = new Set<string>()
      for (const e of entities) {
        const v = e[f.key]
        if (v != null && v !== '') vals.add(String(v))
      }
      map[f.key] = Array.from(vals).sort()
    }
    return map
  }, [schema.fields, entities])

  const visibleFields = useMemo(
    () => schema.fields.filter((f) => !hiddenCols.has(f.key)),
    [schema.fields, hiddenCols],
  )

  const processedEntities = useMemo(() => {
    let result = [...entities]
    for (const [key, allowed] of Object.entries(filters)) {
      if (allowed.size === 0) continue
      result = result.filter((e) => allowed.has(String(e[key] ?? '')))
    }
    if (sortKey && sortDir) {
      result.sort((a, b) => {
        const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'zh-CN')
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return result
  }, [entities, filters, sortKey, sortDir])

  /* ---- Handlers ---- */

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return }
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'))
      if (sortDir === 'desc') setSortKey(null)
    },
    [sortKey, sortDir],
  )

  const toggleFilter = useCallback((fieldKey: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      const set = new Set(next[fieldKey] ?? filterOptions[fieldKey])
      if (set.has(value)) set.delete(value); else set.add(value)
      next[fieldKey] = set.size === filterOptions[fieldKey].length ? new Set() : set
      return next
    })
  }, [filterOptions])

  const toggleCol = useCallback((key: string) => {
    setHiddenCols((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }, [])

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => prev.size === processedEntities.length ? new Set() : new Set(processedEntities.map((e) => e.id)))
  }, [processedEntities])

  const handleCellSave = useCallback(
    (id: number, key: string, value: string) => { onUpdate(id, { [key]: value }); setEditingCell(null) },
    [onUpdate],
  )

  const handleBatchDelete = useCallback(() => {
    if (selected.size === 0) return
    if (onBatchDelete) onBatchDelete(Array.from(selected))
    else for (const id of selected) onDelete(id)
    setSelected(new Set())
  }, [selected, onBatchDelete, onDelete])

  const allSelected = selected.size === processedEntities.length && processedEntities.length > 0

  /* ---- Render ---- */

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--border-subtle)]">
        <span className="text-xs text-[var(--text-tertiary)]">{processedEntities.length} 条记录</span>
        {selected.size > 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-[var(--accent-primary)]">已选 {selected.size} 项</span>
            <button onClick={handleBatchDelete} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-danger)] hover:bg-[var(--vermillion-muted)] transition-colors">
              <Icon icon={Trash2} size="xs" color="inherit" />删除
            </button>
          </motion.div>
        ) : (
          <div className="relative ml-auto">
            <button onClick={() => setShowColConfig(!showColConfig)} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
              <Icon icon={Eye} size="xs" color="inherit" />列配置
            </button>
            <AnimatePresence>
              {showColConfig && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }} className="absolute top-full right-0 mt-1 z-20 min-w-[140px] rounded-lg py-1 bg-[var(--color-surface-raised)] border border-[var(--border-default)] shadow-lg">
                  {schema.fields.map((f) => (
                    <button key={f.key} onClick={() => toggleCol(f.key)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-[var(--color-surface-hover)] transition-colors">
                      <span className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0" style={{ borderColor: !hiddenCols.has(f.key) ? 'var(--accent-primary)' : 'var(--border-default)', backgroundColor: !hiddenCols.has(f.key) ? 'var(--accent-primary)' : 'transparent' }}>
                        {!hiddenCols.has(f.key) && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      <span className="text-[var(--text-primary)]">{f.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-[var(--border-subtle)]" style={{ boxShadow: 'var(--shadow-card)' }}>
        <table className="w-full border-collapse" style={{ minWidth: visibleFields.length * 120 }}>
          <thead>
            <tr className="sticky top-0 z-10 bg-[var(--color-surface-raised)]">
              <th className="w-10 px-2 py-2 text-center" style={{ height: 36, borderBottom: '1px solid var(--border-default)' }}>
                <Checkbox checked={allSelected} onChange={toggleSelectAll} />
              </th>
              {visibleFields.map((f) => (
                <HeaderCell key={f.key} field={f} sortDir={sortKey === f.key ? sortDir : null} filterValues={filterOptions[f.key] ?? []} activeFilterValues={filters[f.key] ?? new Set()} onSort={() => handleSort(f.key)} onToggleFilter={(v) => toggleFilter(f.key, v)} onToggleVisibility={() => toggleCol(f.key)} />
              ))}
              <th className="w-16 px-2 py-2" style={{ height: 36, borderBottom: '1px solid var(--border-default)' }} />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {processedEntities.map((entity, idx) => {
                const isSelected = selected.has(entity.id)
                return (
                  <motion.tr key={entity.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }} className="group" style={{ backgroundColor: isSelected ? `color-mix(in srgb, ${color} 8%, transparent)` : idx % 2 === 0 ? 'transparent' : 'var(--color-surface-overlay)', borderLeft: isSelected ? `2px solid ${color}` : '2px solid transparent' }}>
                    <td className="px-2 text-center" style={{ height: 36 }}>
                      <Checkbox checked={isSelected} onChange={() => toggleSelect(entity.id)} />
                    </td>
                    {visibleFields.map((f) => {
                      const display = entity[f.key] != null ? String(entity[f.key]) : ''
                      const isEditing = editingCell?.id === entity.id && editingCell?.key === f.key
                      return (
                        <td key={f.key} className="px-3 text-xs text-[var(--text-primary)] max-w-[200px] truncate cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors" style={{ height: 36 }} onClick={() => { if (!isEditing) setEditingCell({ id: entity.id, key: f.key }) }}>
                          {isEditing ? (
                            <CellEditor value={display} field={f} onSave={(v) => handleCellSave(entity.id, f.key, v)} onCancel={() => setEditingCell(null)} />
                          ) : (
                            <span className="line-clamp-1" title={display}>{display || <span className="text-[var(--text-tertiary)] italic">空</span>}</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-2 text-center" style={{ height: 36 }}>
                      <motion.button onClick={() => onDelete(entity.id)} className="p-1 rounded text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 hover:bg-[var(--vermillion-muted)] hover:text-[var(--color-danger)] transition-all" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Icon icon={Trash2} size="xs" color="inherit" />
                      </motion.button>
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {processedEntities.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--text-tertiary)]">暂无数据</div>
        )}
      </div>
    </div>
  )
}

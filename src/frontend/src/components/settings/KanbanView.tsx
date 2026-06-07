import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { entityColors, cardStyle } from './EntityCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

/* ---- Types ---- */

interface GroupOption { value: string; label: string; color?: string }

export interface KanbanViewProps {
  entities: Array<Record<string, any>>
  groupField: string
  groupOptions: GroupOption[]
  onUpdate: (id: number, data: Record<string, any>) => void
  accentColor?: string
  onEntityClick?: (id: number) => void
}

/* ---- Sortable Card Wrapper ---- */

function SortableCard({
  entity, accentColor, onEntityClick,
}: Pick<KanbanViewProps, 'accentColor' | 'onEntityClick'> & { entity: Record<string, any> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entity.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
    >
      <KanbanCard
        entity={entity} accentColor={accentColor}
        onEntityClick={onEntityClick} dragHandleProps={listeners}
      />
    </div>
  )
}

/* ---- Card ---- */

function KanbanCard({
  entity, accentColor, onEntityClick, isDragOverlay, dragHandleProps,
}: {
  entity: Record<string, any>
  accentColor?: string
  onEntityClick?: (id: number) => void
  isDragOverlay?: boolean
  dragHandleProps?: Record<string, any>
}) {
  const [hovered, setHovered] = useState(false)
  const typeKey = entity.type as keyof typeof entityColors | undefined
  const colors = accentColor
    ? { text: accentColor, bg: `color-mix(in srgb, ${accentColor} 12%, transparent)`, border: `color-mix(in srgb, ${accentColor} 20%, transparent)` }
    : typeKey && entityColors[typeKey]

  return (
    <motion.div
      className="relative rounded-lg p-3 cursor-pointer group"
      style={{ ...cardStyle, boxShadow: isDragOverlay ? '0 8px 24px rgba(0,0,0,0.25)' : cardStyle.boxShadow }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onEntityClick?.(entity.id)}
      initial={false}
      animate={hovered && !isDragOverlay ? { y: -1 } : { y: 0 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      {colors && (
        <div className="absolute top-0 left-3 right-3 h-px rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={{ opacity: 0.15, scaleX: 0.4 }}
            animate={{ opacity: hovered ? 0.6 : 0.15, scaleX: hovered ? 1 : 0.4 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            style={{ background: `linear-gradient(90deg, transparent, ${colors.text}, transparent)` }}
          />
        </div>
      )}
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 p-0.5 rounded text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">{entity.name}</h4>
          {entity.description && (
            <p className="text-xs text-[var(--text-tertiary)] line-clamp-2 mt-1 leading-relaxed">
              {entity.description}
            </p>
          )}
          {Array.isArray(entity.tags) && entity.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {entity.tags.slice(0, 3).map((tag: string) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--text-secondary)' }}
                >{tag}</span>
              ))}
              {entity.tags.length > 3 && (
                <span className="text-[10px] text-[var(--text-tertiary)]">+{entity.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ---- Column ---- */

function KanbanColumn({
  option, entities, accentColor, onEntityClick,
}: {
  option: GroupOption
  entities: Array<Record<string, any>>
  accentColor?: string
  onEntityClick?: (id: number) => void
}) {
  const col = option.color || accentColor || 'var(--text-secondary)'

  return (
    <div className="flex flex-col min-w-[240px] max-w-[280px] flex-1">
      <div
        className="flex items-center gap-2 px-2 pb-2 mb-2 border-b"
        style={{ borderColor: `color-mix(in srgb, ${col} 20%, transparent)` }}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col }} />
        <span className="text-sm font-medium text-[var(--text-primary)]">{option.label}</span>
        <span
          className="text-[11px] ml-auto px-1.5 py-0.5 rounded-md font-medium"
          style={{ backgroundColor: `color-mix(in srgb, ${col} 12%, transparent)`, color: col }}
        >
          {entities.length}
        </span>
      </div>
      <SortableContext items={entities.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1 min-h-[120px] pb-2">
          <AnimatePresence initial={false}>
            {entities.map((entity) => (
              <motion.div
                key={entity.id} layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
              >
                <SortableCard entity={entity} accentColor={accentColor} onEntityClick={onEntityClick} />
              </motion.div>
            ))}
          </AnimatePresence>
          {entities.length === 0 && (
            <div className="text-xs text-[var(--text-tertiary)] text-center py-6 opacity-60">拖拽实体到此列</div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

/* ---- Main View ---- */

export function KanbanView({
  entities, groupField, groupOptions, onUpdate, accentColor, onEntityClick,
}: KanbanViewProps) {
  const [activeId, setActiveId] = useState<number | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const columns = useMemo(() => {
    const map = new Map<string, Record<string, any>[]>()
    for (const opt of groupOptions) map.set(opt.value, [])
    for (const entity of entities) {
      const key = String(entity[groupField] ?? '')
      const bucket = map.get(key)
      if (bucket) bucket.push(entity)
      else map.get(groupOptions[0]?.value ?? '')?.push(entity)
    }
    return map
  }, [entities, groupField, groupOptions])

  const findColumn = useCallback(
    (id: number | string): string | undefined => {
      for (const [key, bucket] of columns) {
        if (bucket.some((e) => e.id === id)) return key
      }
      return columns.has(String(id)) ? String(id) : undefined
    },
    [columns],
  )

  const activeEntity = useMemo(
    () => (activeId != null ? entities.find((e) => e.id === activeId) : undefined),
    [activeId, entities],
  )

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(e.active.id as number)
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return
      const activeCol = findColumn(active.id)
      const overCol = findColumn(over.id)
      if (!activeCol || !overCol || activeCol === overCol) return
      const entity = entities.find((e) => e.id === active.id)
      if (entity) {
        const target = groupOptions.find((o) => o.value === overCol)
        if (target) onUpdate(entity.id, { [groupField]: target.value })
      }
    },
    [entities, findColumn, groupField, groupOptions, onUpdate],
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    void event // same-column reorder handled visually via layout animation
  }, [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 px-1">
        {groupOptions.map((option) => (
          <KanbanColumn
            key={option.value}
            option={option}
            entities={columns.get(option.value) ?? []}
            accentColor={accentColor}
            onEntityClick={onEntityClick}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeEntity && (
          <KanbanCard entity={activeEntity} accentColor={accentColor} onEntityClick={onEntityClick} isDragOverlay />
        )}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * EntityDragList - Drag-and-drop sortable entity list
 *
 * Uses native HTML5 Drag API + framer-motion for smooth animations.
 * Supports dragstart, dragover, drop events with visual feedback.
 * Mobile uses long-press to initiate drag.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import type { ExtractedEntityLocal } from '@/store/chatStore'
import { EntityTag } from './EntityTag'
import { typeColors } from '@/lib/entityColors'
import { SPRING } from '@/components/shared/AnimationConfig'

/* ============================================================
   TYPES
   ============================================================ */

interface EntityDragListProps {
  entities: ExtractedEntityLocal[]
  onReorder: (entities: ExtractedEntityLocal[]) => void
}

/* ============================================================
   DRAGGABLE ENTITY ITEM
   ============================================================ */

function DraggableEntityItem({
  entity,
}: {
  entity: ExtractedEntityLocal
}) {
  const color = typeColors[entity.type] || 'var(--color-character)'

  return (
    <Reorder.Item
      value={entity}
      className="list-none"
      transition={SPRING.SNAPPY}
      whileDrag={{
        scale: 1.03,
        boxShadow: `0 8px 24px color-mix(in srgb, ${color} 20%, transparent)`,
        zIndex: 50,
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1
                   bg-[var(--color-surface-base)] border border-[var(--border-default)]
                   hover:bg-[var(--color-surface-hover)] transition-colors cursor-grab active:cursor-grabbing"
        style={{
          borderLeft: `3px solid ${color}`,
        }}
      >
        {/* Drag handle */}
        <div className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Entity content */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <EntityTag type={entity.type} size="small" />
          <span className="text-sm truncate text-[var(--text-primary)]">
            {entity.name}
          </span>
          {entity.description && (
            <span className="text-xs truncate text-[var(--text-tertiary)] hidden sm:inline">
              {entity.description}
            </span>
          )}
        </div>

        {/* Confirm indicator */}
        {entity.confirmed && (
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--color-ifline)' }}
          />
        )}
      </div>
    </Reorder.Item>
  )
}

/* ============================================================
   MOBILE LONG-PRESS HANDLER
   ============================================================ */

function useLongPress(callback: () => void, delay = 500) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const isLongPress = useRef(false)

  const start = useCallback(() => {
    isLongPress.current = false
    timeoutRef.current = setTimeout(() => {
      isLongPress.current = true
      callback()
    }, delay)
  }, [callback, delay])

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    return clear
  }, [clear])

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
  }
}

/* ============================================================
   ENTITY DRAG LIST - Main component
   ============================================================ */

export function EntityDragList({ entities, onReorder }: EntityDragListProps) {
  const [localEntities, setLocalEntities] = useState<ExtractedEntityLocal[]>(entities)
  const [isDragging, setIsDragging] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Sync with external entities
  useEffect(() => {
    setLocalEntities(entities)
  }, [entities])

  // Handle reorder
  const handleReorder = useCallback((newOrder: ExtractedEntityLocal[]) => {
    setLocalEntities(newOrder)
    onReorder(newOrder)
  }, [onReorder])

  // Long press for mobile
  const longPressHandlers = useLongPress(() => {
    setIsDragging(true)
  })

  if (localEntities.length === 0) {
    return (
      <div className="text-center py-6 px-4">
        <p className="text-xs text-[var(--text-tertiary)]">
          暂无实体可排序
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Mobile drag hint */}
      {isMobile && !isDragging && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] text-[var(--text-tertiary)] text-center mb-2 px-2"
        >
          长按拖拽排序
        </motion.div>
      )}

      {/* Reorder group */}
      <Reorder.Group
        axis="y"
        values={localEntities}
        onReorder={handleReorder}
        className="space-y-0"
        {...(isMobile ? longPressHandlers : {})}
      >
        <AnimatePresence mode="popLayout">
          {localEntities.map((entity) => (
            <DraggableEntityItem
              key={entity.id}
              entity={entity}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {/* Drag overlay for mobile */}
      <AnimatePresence>
        {isDragging && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsDragging(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}


/**
 * EntityHoverCard - Hover details card for entities
 *
 * Uses custom HoverCard component from shadcn/ui.
 * Shows: name, type, description, confirmed status.
 * Desktop: 300ms delay before showing.
 * Mobile: click to expand.
 */

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Circle } from 'lucide-react'
import { HoverCard } from '@/components/ui/HoverCard'
import { EntityTag } from './EntityTag'
import type { ExtractedEntityLocal } from '@/store/chatStore'
import { typeColors } from '@/lib/entityColors'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

/* ============================================================
   TYPES
   ============================================================ */

interface EntityHoverCardProps {
  entity: ExtractedEntityLocal
  children: React.ReactNode
  /** Delay in ms before showing (default 300) */
  delay?: number
  /** Side of the trigger to show on */
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/* ============================================================
   HOVER CARD CONTENT
   ============================================================ */

function EntityCardContent({ entity }: { entity: ExtractedEntityLocal }) {
  const color = typeColors[entity.type] || 'var(--color-character)'

  return (
    <div className="min-w-[200px] max-w-[280px] space-y-2.5">
      {/* Header: name + type */}
      <div className="flex items-center gap-2">
        <EntityTag type={entity.type} size="small" />
        <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">
          {entity.name}
        </h4>
      </div>

      {/* Description */}
      {entity.description && (
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
          {entity.description}
        </p>
      )}

      {/* Divider */}
      <div className="h-px bg-[var(--border-subtle)]" />

      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {entity.confirmed ? (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-[var(--color-ifline)]" />
              <span className="text-[11px] text-[var(--color-ifline)]">已确认</span>
            </>
          ) : (
            <>
              <Circle className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <span className="text-[11px] text-[var(--text-tertiary)]">待确认</span>
            </>
          )}
        </div>

        {/* Type indicator dot */}
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}

/* ============================================================
   MOBILE POPOVER - Click to expand on touch devices
   ============================================================ */

function MobileEntityPopover({
  entity,
  children,
  isOpen,
  onToggle,
}: {
  entity: ExtractedEntityLocal
  children: React.ReactNode
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="relative inline-block">
      <div onClick={onToggle} className="cursor-pointer">
        {children}
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.FAST }}
              className="fixed inset-0 z-40"
              onClick={onToggle}
            />

            {/* Popover content */}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
              className="absolute z-50 left-0 top-full mt-2
                         rounded-xl border border-[var(--border-default)]
                         bg-[var(--color-surface-overlay)] p-4
                         shadow-[var(--shadow-float)]"
            >
              <EntityCardContent entity={entity} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ============================================================
   ENTITY HOVER CARD - Main component
   ============================================================ */

export function EntityHoverCard({
  entity,
  children,
  delay = 300,
  side = 'right',
}: EntityHoverCardProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window)
  )

  // Detect mobile on mount and listen for changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches || 'ontouchstart' in window)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleToggle = useCallback(() => {
    setIsMobileOpen((prev) => !prev)
  }, [])

  // Mobile: click to expand
  if (isMobile) {
    return (
      <MobileEntityPopover
        entity={entity}
        isOpen={isMobileOpen}
        onToggle={handleToggle}
      >
        {children}
      </MobileEntityPopover>
    )
  }

  // Desktop: hover card with delay
  return (
    <HoverCard
      content={<EntityCardContent entity={entity} />}
      openDelay={delay}
      closeDelay={150}
      side={side}
      align="center"
      sideOffset={8}
    >
      {children}
    </HoverCard>
  )
}


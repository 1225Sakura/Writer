/**
 * EntityItem - Single entity display card
 *
 * GlassCard-based entity item with confirm button and
 * entrance animation via IntersectionObserver.
 */

import { useState, useRef } from 'react'
import { ExtractedEntity } from '@/store'
import { EntityTag } from './EntityTag'
import { CheckCircle, Circle } from 'lucide-react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { typeColors } from '@/lib/entityColors'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

export function EntityItem({ entity, onConfirm }: {
  entity: ExtractedEntity
  onConfirm?: (id: string) => void
}) {
  const [justConfirmed, setJustConfirmed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '50px' })
  const color = typeColors[entity.type] || 'var(--color-character)'

  const handleConfirm = () => {
    if (!entity.confirmed && onConfirm) {
      onConfirm(entity.id)
      setJustConfirmed(true)
      setTimeout(() => setJustConfirmed(false), 1200)
    } else {
      onConfirm?.(entity.id)
    }
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    >
      <GlassCard
        intensity="light"
        border="subtle"
        variant="default"
        rounded="lg"
        padding="sm"
        hover
        className="flex items-stretch gap-0 mb-2 group cursor-default"
        style={{
          borderLeft: `3px solid ${color}`,
        }}
      >
        {/* Content */}
        <div className="flex-1 min-w-0 py-2.5 px-3 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <EntityTag type={entity.type} size="small" />
            <div className="font-medium text-sm truncate text-primary">
              {entity.name}
            </div>
          </div>
          {entity.description && (
            <div className="text-xs truncate mt-1 text-secondary">
              {entity.description}
            </div>
          )}
        </div>

        {/* Confirm button */}
        <motion.button
          onClick={(e) => {
            e.stopPropagation()
            handleConfirm()
          }}
          className="flex items-center justify-center px-3 flex-shrink-0
                     text-secondary hover:text-primary transition-colors duration-200
                     border-l border-transparent hover:border-default/50"
          aria-label={entity.confirmed ? `${entity.name} 已确认` : `确认 ${entity.name}`}
          title={entity.confirmed ? '已确认' : '点击确认'}
          whileTap={{ scale: 0.7 }}
          animate={justConfirmed ? {
            scale: [1, 1.5, 1],
            rotate: [0, 20, 0],
          } : {}}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
        >
          <AnimatePresence mode="wait">
            {entity.confirmed ? (
              <motion.div
                key="confirmed"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 45 }}
                transition={{ type: 'spring', stiffness: 450, damping: 12 }}
              >
                <CheckCircle className="w-5 h-5 text-[var(--color-ifline)]" />
              </motion.div>
            ) : (
              <motion.div
                key="unconfirmed"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Circle className="w-5 h-5 text-secondary/60 group-hover:text-[var(--color-ifline)] transition-colors duration-200" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </GlassCard>
    </motion.div>
  )
}

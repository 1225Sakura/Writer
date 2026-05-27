/**
 * CategorySection - Collapsible entity category group
 *
 * Groups entities by type with expand/collapse, progress badge,
 * and animated chevron.
 */

import { useState } from 'react'
import { ExtractedEntity } from '@/store'
import { EntityItem } from './EntityItem'
import {
  CheckCircle,
  ChevronRight,
  Sparkles,
  User,
  Package,
  MapPin,
  Shield,
  Globe,
  Scale,
  GitBranch,
  FileText,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { typeColors } from '@/lib/entityColors'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

const categoryIcons: Record<string, React.ReactNode> = {
  world: <Globe className="w-3.5 h-3.5" />,
  character: <User className="w-3.5 h-3.5" />,
  item: <Package className="w-3.5 h-3.5" />,
  location: <MapPin className="w-3.5 h-3.5" />,
  faction: <Shield className="w-3.5 h-3.5" />,
  rule: <Scale className="w-3.5 h-3.5" />,
  ifline: <GitBranch className="w-3.5 h-3.5" />,
  outline: <FileText className="w-3.5 h-3.5" />,
}

export function CategorySection({
  title,
  entities,
  onConfirm,
  type,
}: {
  title: string
  entities: ExtractedEntity[]
  onConfirm?: (id: string) => void
  type: string
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const color = typeColors[type] || 'var(--color-character)'
  const confirmedCount = entities.filter((e) => e.confirmed).length

  if (entities.length === 0) return null

  return (
    <motion.div
      className="mb-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    >
      {/* Section header */}
      <motion.button
        className="flex items-center gap-2.5 w-full py-2.5 px-2 rounded-lg group
                   hover:bg-surface-base/80 transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
        whileTap={{ scale: 0.98 }}
      >
        {/* Animated chevron */}
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0, x: isExpanded ? 1 : 0 }}
          transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
          className="flex items-center justify-center w-4 h-4"
        >
          <ChevronRight className="w-3.5 h-3.5 text-secondary group-hover:text-primary transition-colors duration-150" />
        </motion.span>

        {/* Color indicator with icon */}
        <div className="relative flex items-center justify-center w-6 h-6 rounded-md"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)` }}
        >
          <span style={{ color }}>
            {categoryIcons[type] || <Sparkles className="w-3.5 h-3.5" />}
          </span>
        </div>

        <h3 className="font-medium text-sm flex-1 text-left text-primary group-hover:text-accent-primary transition-colors duration-150">
          {title}
        </h3>

        {/* Progress badge */}
        <span
          className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{
            backgroundColor: confirmedCount === entities.length ? `color-mix(in srgb, ${color} 13%, transparent)` : 'var(--color-surface-base)',
            color: confirmedCount === entities.length ? color : 'var(--text-secondary)',
            border: `1px solid ${confirmedCount === entities.length ? color : 'var(--border-subtle)'}`,
          }}
        >
          <span style={{ color: confirmedCount === entities.length ? 'var(--color-ifline)' : color }} className="font-medium">
            {confirmedCount}
          </span>
          <span className="text-secondary/50">/</span>
          <span>{entities.length}</span>
          {confirmedCount === entities.length && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 12 }}
            >
              <CheckCircle className="w-3 h-3 ml-0.5" style={{ color }} />
            </motion.span>
          )}
        </span>
      </motion.button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            className="overflow-hidden"
          >
            <div className="pl-6 pr-2 pt-2">
              {entities.map((entity) => (
                <EntityItem
                  key={entity.id}
                  entity={entity}
                  onConfirm={onConfirm}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

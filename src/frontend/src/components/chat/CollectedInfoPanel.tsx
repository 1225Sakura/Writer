import { useState } from 'react'
import { ExtractedEntity, useUIStore } from '@/store'
import { EntityTag } from './EntityTag'
import {
  CheckCircle,
  Circle,
  ChevronRight,
  ArrowRight,
  Edit3,
  Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface CollectedInfoPanelProps {
  entities: ExtractedEntity[]
  onConfirmEntity?: (id: string) => void
}

const categoryLabels: Record<string, string> = {
  world: '世界观',
  character: '角色',
  item: '物品',
  location: '地点',
  faction: '势力',
  rule: '规则',
  ifline: 'IF线',
}

/* ============================================================
   ENTITY TYPE COLORS (from design system - CSS variables)
   ============================================================ */

const typeColors: Record<string, string> = {
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  world: 'var(--color-world)',
  rule: 'var(--color-rule)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
}

const typeBgColors: Record<string, string> = {
  character: 'rgba(212, 165, 116, 0.08)',
  item: 'rgba(155, 126, 217, 0.08)',
  location: 'rgba(94, 181, 166, 0.08)',
  faction: 'rgba(212, 93, 93, 0.08)',
  world: 'rgba(94, 106, 210, 0.08)',
  rule: 'rgba(126, 184, 74, 0.08)',
  outline: 'rgba(91, 142, 232, 0.08)',
  ifline: 'rgba(126, 184, 74, 0.08)',
}

const typeGlowColors: Record<string, string> = {
  character: 'rgba(212, 165, 116, 0.3)',
  item: 'rgba(155, 126, 217, 0.3)',
  location: 'rgba(94, 181, 166, 0.3)',
  faction: 'rgba(212, 93, 93, 0.3)',
  world: 'rgba(94, 106, 210, 0.3)',
  rule: 'rgba(126, 184, 74, 0.3)',
  outline: 'rgba(91, 142, 232, 0.3)',
  ifline: 'rgba(126, 184, 74, 0.3)',
}

/* ============================================================
   ENTITY ITEM with confirm animation
   ============================================================ */

function EntityItem({ entity, onConfirm, index }: {
  entity: ExtractedEntity
  onConfirm?: (id: string) => void
  index: number
}) {
  const [justConfirmed, setJustConfirmed] = useState(false)
  const color = typeColors[entity.type] || 'var(--color-character)'
  const bgColor = typeBgColors[entity.type] || 'rgba(255,255,255,0.02)'
  const glowColor = typeGlowColors[entity.type] || 'rgba(255,255,255,0.1)'

  const handleConfirm = () => {
    if (!entity.confirmed && onConfirm) {
      onConfirm(entity.id)
      setJustConfirmed(true)
      setTimeout(() => setJustConfirmed(false), 1000)
    } else {
      onConfirm?.(entity.id)
    }
  }

  return (
    <motion.div
      className="flex items-center gap-2.5 py-2.5 px-3 -mx-1 rounded-lg cursor-pointer group"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.03)',
      }}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{
        backgroundColor: bgColor,
        x: 2,
        boxShadow: `0 0 20px ${glowColor}`,
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Color-coded left border */}
      <motion.div
        className="w-1 h-8 rounded-full flex-shrink-0"
        style={{ backgroundColor: color, opacity: 0.5 }}
        whileHover={{ opacity: 0.8, scaleY: 1.2 }}
        transition={{ duration: 0.15 }}
      />

      <EntityTag type={entity.type} size="small" />

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {entity.name}
        </div>
        {entity.description && (
          <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {entity.description}
          </div>
        )}
      </div>

      {/* Confirm button with animation */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation()
          handleConfirm()
        }}
        className="cursor-pointer flex-shrink-0 relative"
        title={entity.confirmed ? '已确认' : '点击确认'}
        whileTap={{ scale: 0.75 }}
        animate={justConfirmed ? {
          scale: [1, 1.5, 1],
          rotate: [0, 20, 0],
          backgroundColor: glowColor,
        } : {}}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <AnimatePresence mode="wait">
          {entity.confirmed ? (
            <motion.div
              key="confirmed"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 30 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <CheckCircle className="w-4.5 h-4.5" style={{ color: 'var(--color-ifline)' }} />
            </motion.div>
          ) : (
            <motion.div
              key="unconfirmed"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Circle className="w-4.5 h-4.5 hover:text-[var(--color-ifline)]" style={{ color: 'var(--text-secondary)' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  )
}

/* ============================================================
   CATEGORY SECTION with collapse/expand
   ============================================================ */

function CategorySection({
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
      className="mb-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Section header */}
      <motion.button
        className="flex items-center gap-2 w-full py-2 px-1 rounded-md group"
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
        whileTap={{ scale: 0.99 }}
      >
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
        </motion.span>

        {/* Color dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        <h3 className="font-medium text-sm flex-1 text-left" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>

        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: confirmedCount === entities.length ? 'var(--color-ifline)' : color }}>
            {confirmedCount}
          </span>
          <span>/</span>
          <span>{entities.length}</span>
        </span>
      </motion.button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pl-5 pr-1">
              {entities.map((entity, i) => (
                <EntityItem
                  key={entity.id}
                  entity={entity}
                  onConfirm={onConfirm}
                  index={i}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export function CollectedInfoPanel({ entities, onConfirmEntity }: CollectedInfoPanelProps) {
  const groupedEntities = entities.reduce(
    (acc, entity) => {
      const key = entity.type
      if (!acc[key]) acc[key] = []
      acc[key].push(entity)
      return acc
    },
    {} as Record<string, ExtractedEntity[]>
  )

  const confirmedCount = entities.filter((e) => e.confirmed).length
  const progressPercent = entities.length > 0 ? (confirmedCount / entities.length) * 100 : 0

return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
      {/* Header */}
      <div className="p-4 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <h2 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>已收集信息</h2>
        </div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {confirmedCount}/{entities.length} 项已确认
        </div>
        {/* Progress bar */}
        <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
          <motion.div
            className="h-full rounded-full relative"
            style={{
              background: progressPercent === 100
                ? 'linear-gradient(90deg, var(--color-ifline), var(--color-ifline))'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-primary))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
            />
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {entities.length === 0 ? (
            <motion.div
              className="text-center py-10"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Edit3 className="w-6 h-6" style={{ color: 'var(--text-secondary)' }} />
              </motion.div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                开始对话后，这里将显示收集到的设定信息
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                AI 会自动识别并提取关键设定
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {Object.entries(groupedEntities).map(([type, typeEntities]) => (
                <CategorySection
                  key={type}
                  title={categoryLabels[type] || type}
                  entities={typeEntities}
                  onConfirm={onConfirmEntity}
                  type={type}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-[rgba(255,255,255,0.06)]">
        <div className="flex gap-2 mb-2">
          <motion.button
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-[rgba(255,255,255,0.06)]
                       text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]"
            onClick={() => useUIStore.getState().setCurrentInterface('chat')}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            继续完善
          </motion.button>
          <motion.button
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-[rgba(255,255,255,0.06)]
                       text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]"
            onClick={() => useUIStore.getState().setCurrentInterface('settings')}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            查看完整设定
          </motion.button>
        </div>
        <motion.button
          className="w-full px-4 py-2.5 text-sm rounded-lg
                     text-white flex items-center justify-center gap-2 font-medium"
          style={{ backgroundColor: 'var(--accent-primary)' }}
          onClick={() => useUIStore.getState().setCurrentInterface('settings')}
          whileHover={{
            backgroundColor: 'var(--accent-hover)',
            y: -1,
            boxShadow: '0 4px 16px rgba(94, 106, 210, 0.25)',
          }}
          whileTap={{ scale: 0.97 }}
        >
          <span>进入设定界面</span>
          <motion.span
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowRight className="w-4 h-4" />
          </motion.span>
        </motion.button>
      </div>
    </div>
  )
}

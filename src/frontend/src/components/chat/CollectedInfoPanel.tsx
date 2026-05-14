import { useState, useRef } from 'react'
import { ExtractedEntity } from '@/store'
import { EntityTag } from './EntityTag'
import {
  CheckCircle,
  Circle,
  ChevronRight,
  Sparkles,
  BookOpen,
  Feather,
  X,
  User,
  Package,
  MapPin,
  Shield,
  Globe,
  Scale,
  GitBranch,
  FileText,
  Lightbulb,
  Wand2,
  PenTool,
} from 'lucide-react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { typeColors } from '@/lib/entityColors'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


export interface CollectedInfoPanelProps {
  entities: ExtractedEntity[]
  onConfirmEntity?: (id: string) => void
  onClose?: () => void
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

/* ============================================================
   ENTITY ITEM - GlassCard-based design
   ============================================================ */

function EntityItem({ entity, onConfirm }: {
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
          style={{ backgroundColor: `${color}18` }}
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
            backgroundColor: confirmedCount === entities.length ? `${color}20` : 'var(--color-surface-base)',
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

/* ============================================================
   EMPTY STATE with richer guidance
   ============================================================ */

function EmptyState() {
  return (
    <motion.div
      className="text-center py-10 px-4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      {/* Floating book illustration */}
      <motion.div
        className="relative w-20 h-20 mx-auto mb-5"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <GlassCard
          intensity="medium"
          border="subtle"
          variant="elevated"
          rounded="2xl"
          padding="none"
          className="w-full h-full flex items-center justify-center"
        >
          <BookOpen className="w-8 h-8 text-secondary" />
        </GlassCard>
        <motion.div
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center z-20"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          <GlassCard
            intensity="strong"
            border="subtle"
            rounded="full"
            padding="none"
            className="w-full h-full flex items-center justify-center"
          >
            <Feather className="w-3 h-3 text-accent-primary" />
          </GlassCard>
        </motion.div>
      </motion.div>

      <motion.p
        className="text-sm text-secondary font-medium"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        开始对话后，这里将显示收集到的设定信息
      </motion.p>
      <motion.p
        className="text-xs mt-2 text-secondary opacity-50"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 0.5, y: 0 }}
        transition={{ delay: 0.25, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        AI 会自动识别并提取关键设定
      </motion.p>

      {/* Tips */}
      <motion.div
        className="mt-6 space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35 }}
      >
        {[
          { icon: Lightbulb, text: '描述你的世界设定，AI 会自动提取' },
          { icon: Wand2, text: '提及角色、物品、地点等关键词' },
          { icon: PenTool, text: '点击确认将设定保存到右侧面板' },
        ].map((tip) => (
          <GlassCard
            key={tip.text}
            intensity="light"
            border="subtle"
            variant="default"
            rounded="lg"
            padding="sm"
            className="flex items-center gap-2.5"
          >
            <tip.icon className="w-3.5 h-3.5 text-accent-primary/60 flex-shrink-0" />
            <span className="text-[11px] text-secondary leading-relaxed text-left">{tip.text}</span>
          </GlassCard>
        ))}
      </motion.div>

      {/* Decorative dots */}
      <div className="flex items-center justify-center gap-1.5 mt-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-secondary opacity-30"
            animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.2, 1] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export function CollectedInfoPanel({ entities, onConfirmEntity, onClose }: CollectedInfoPanelProps) {
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
    <div className="h-full flex flex-col" style={{ background: 'var(--color-surface-raised)' }}>
      {/* Header */}
      <div className="p-4 border-b border-default">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-accent-primary" />
          <h2 className="font-medium text-sm text-primary">已收集信息</h2>
          {onClose && (
            <motion.button
              className="ml-auto p-1 rounded-lg text-secondary hover:text-primary hover:bg-surface-base"
              onClick={onClose}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </div>
        <div className="text-xs text-secondary">
          {confirmedCount}/{entities.length} 项已确认
        </div>
        {/* Progress bar */}
        <div className="mt-2.5 h-2 rounded-full overflow-hidden bg-surface-base relative">
          <motion.div
            className="h-full rounded-full relative"
            style={{
              background: progressPercent === 100
                ? 'linear-gradient(90deg, var(--color-ifline), color-mix(in srgb, var(--color-ifline) 70%, var(--accent-primary)))'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
            />
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {entities.length === 0 ? (
            <EmptyState />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
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
    </div>
  )
}

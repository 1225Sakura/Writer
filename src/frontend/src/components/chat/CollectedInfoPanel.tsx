import { useState, useRef } from 'react'
import { ExtractedEntity, useUIStore } from '@/store'
import { EntityTag } from './EntityTag'
import {
  CheckCircle,
  Circle,
  ChevronRight,
  ArrowRight,
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
   ENTITY TYPE COLORS (from centralized lib/entityColors.ts)
   ============================================================ */
import { typeColors, typeBgColors, typeGlowColors } from '@/lib/entityColors'

/* ============================================================
   STAGGER ANIMATION VARIANTS
   ============================================================ */

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

/* ============================================================
   ENTITY ITEM - uses CSS hover + intersection observer
   ============================================================ */

function EntityItem({ entity, onConfirm }: {
  entity: ExtractedEntity
  onConfirm?: (id: string) => void
}) {
  const [justConfirmed, setJustConfirmed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '50px' })
  const color = typeColors[entity.type] || 'var(--color-character)'
  const bgColor = typeBgColors[entity.type] || 'rgba(255,255,255,0.02)'
  const glowColor = typeGlowColors[entity.type] || 'rgba(255,255,255,0.1)'

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
      className="entity-card group relative"
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        '--entity-color': color,
        '--entity-bg': bgColor,
        '--entity-glow': glowColor,
      } as React.CSSProperties}
    >
      {/* Left color bar with glow */}
      <div className="entity-card__color-bar" style={{ backgroundColor: color, boxShadow: `0 0 8px ${glowColor}` }} />

      {/* Hover light strip - CSS driven */}
      <div
        className="entity-card__light-strip absolute left-0 top-2 bottom-2 w-[3px] rounded-full opacity-0 scale-y-60 transition-all duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          background: `linear-gradient(180deg, ${color} 0%, color-mix(in srgb, ${color} 50%, transparent) 100%)`,
          filter: 'blur(1px)',
        }}
      />

      {/* Glow effect on hover - CSS driven */}
      <div
        className="entity-card__glow absolute left-0 top-0 bottom-0 w-8 rounded-l-[var(--radius-lg)] pointer-events-none opacity-0 transition-opacity duration-200"
        style={{
          background: `linear-gradient(90deg, ${glowColor} 0%, transparent 100%)`,
        }}
      />

      <div className="entity-card__content">
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

      {/* Confirm button - kept framer motion for spring animation */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation()
          handleConfirm()
        }}
        className="entity-card__confirm"
        title={entity.confirmed ? '已确认' : '点击确认'}
        whileTap={{ scale: 0.7 }}
        animate={justConfirmed ? {
          scale: [1, 1.5, 1],
          rotate: [0, 20, 0],
        } : {}}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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
              <CheckCircle className="w-5 h-5 text-[var(--color-ifline)] drop-shadow-lg" />
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
  const glowColor = typeGlowColors[type] || 'rgba(255,255,255,0.1)'
  const confirmedCount = entities.filter((e) => e.confirmed).length

  if (entities.length === 0) return null

  return (
    <motion.div
      className="mb-4 category-section"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Section header with enhanced styling */}
      <motion.button
        className="flex items-center gap-2.5 w-full py-2.5 px-2 rounded-lg group
                   hover:bg-surface-base/80 transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
        whileTap={{ scale: 0.98 }}
      >
        {/* Animated chevron */}
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0, x: isExpanded ? 1 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
          <motion.span
            className="absolute inset-0 rounded-md"
            style={{ backgroundColor: color }}
            initial={{ opacity: 0, scale: 0.5 }}
            whileHover={{ opacity: 0.12, scale: 1.1 }}
            transition={{ duration: 0.2 }}
          />
        </div>

        <h3 className="font-medium text-sm flex-1 text-left text-primary group-hover:text-accent-primary transition-colors duration-150">
          {title}
        </h3>

        {/* Progress badge */}
        <motion.span
          className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{
            backgroundColor: confirmedCount === entities.length ? `${color}20` : 'var(--color-surface-base)',
            color: confirmedCount === entities.length ? color : 'var(--text-secondary)',
            border: `1px solid ${confirmedCount === entities.length ? color : 'var(--border-subtle)'}`,
          }}
          animate={confirmedCount === entities.length ? {
            boxShadow: [0, `0 0 8px ${glowColor}`, 0],
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
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
        </motion.span>
      </motion.button>

      {/* Expandable content with smooth animation */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <motion.div
              className="pl-6 pr-2 pt-2"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {entities.map((entity) => (
                <EntityItem
                  key={entity.id}
                  entity={entity}
                  onConfirm={onConfirm}
                />
              ))}
            </motion.div>
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
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Floating book illustration with glow */}
      <motion.div
        className="relative w-20 h-20 mx-auto mb-5"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Glow behind book */}
        <motion.div
          className="absolute inset-[-8px] rounded-2xl"
          style={{
            background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
            opacity: 0.08,
            filter: 'blur(8px)',
          }}
          animate={{ opacity: [0.05, 0.12, 0.05], scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 rounded-2xl bg-surface-base border border-default flex items-center justify-center relative z-10"
          style={{
            boxShadow: '0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <BookOpen className="w-8 h-8 text-secondary" />
        </div>
        <motion.div
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-surface-raised border border-default flex items-center justify-center z-20"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          <Feather className="w-3 h-3 text-accent-primary" />
        </motion.div>
      </motion.div>

      <motion.p
        className="text-sm text-secondary font-medium"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        开始对话后，这里将显示收集到的设定信息
      </motion.p>
      <motion.p
        className="text-xs mt-2 text-secondary opacity-50"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 0.5, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        AI 会自动识别并提取关键设定
      </motion.p>

      {/* Richer guidance tips */}
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
        ].map((tip, i) => (
          <motion.div
            key={tip.text}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-base/50 border border-default/40"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45 + i * 0.1, duration: 0.25 }}
          >
            <tip.icon className="w-3.5 h-3.5 text-accent-primary/60 flex-shrink-0" />
            <span className="text-[11px] text-secondary leading-relaxed text-left">{tip.text}</span>
          </motion.div>
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
    <div className="h-full flex flex-col bg-surface-raised collected-info-panel">
      {/* Subtle background texture overlay */}
      <div className="collected-info-panel__texture" />

      {/* Header */}
      <div className="p-4 border-b border-default relative z-10">
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
        {/* Progress bar with shimmer */}
        <div className="mt-2.5 h-2 rounded-full overflow-hidden bg-surface-base relative">
          <motion.div
            className="h-full rounded-full relative"
            style={{
              background: progressPercent === 100
                ? 'linear-gradient(90deg, var(--color-ifline), var(--color-ifline))'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Primary shimmer effect */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
            />
            {/* Secondary subtle shimmer */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
              }}
              animate={{ x: ['-200%', '100%'] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut', delay: 0.5 }}
            />
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 relative z-10">
        <AnimatePresence mode="wait">
          {entities.length === 0 ? (
            <EmptyState />
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
      <div className="p-4 border-t border-default relative z-10">
        <div className="flex gap-2 mb-2">
          <motion.button
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-default
                       text-secondary hover:bg-surface-base hover:text-primary"
            onClick={() => useUIStore.getState().setCurrentInterface('chat')}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            继续完善
          </motion.button>
          <motion.button
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-default
                       text-secondary hover:bg-surface-base hover:text-primary"
            onClick={() => useUIStore.getState().setCurrentInterface('settings')}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            查看完整设定
          </motion.button>
        </div>
        <motion.button
          className="w-full px-4 py-2.5 text-sm rounded-lg
                     text-white flex items-center justify-center gap-2 font-medium
                     bg-accent-primary hover:bg-accent-hover"
          onClick={() => useUIStore.getState().setCurrentInterface('settings')}
          whileHover={{
            y: -1,
            boxShadow: 'var(--shadow-glow)',
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

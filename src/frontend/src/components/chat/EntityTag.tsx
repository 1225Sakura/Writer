import { motion } from 'framer-motion'
import { EntityType } from '@/store'
import { User, Package, MapPin, Shield, Globe, Scale, FileText, GitBranch, Check } from 'lucide-react'
import { SPRING } from '@/components/shared/AnimationConfig'


interface EntityTagProps {
  type: EntityType
  size?: 'small' | 'medium' | 'large'
  showIcon?: boolean
  selected?: boolean
  onClick?: () => void
}

type EntityTypeExtended = EntityType | 'chapter' | 'plot_thread'

const typeConfig: Record<EntityTypeExtended, { label: string; bgColor: string; textColor: string; borderColor: string; glowColor: string; icon: React.ReactNode }> = {
  character: {
    label: '角色',
    bgColor: 'color-mix(in srgb, var(--color-character) 15%, transparent)',
    textColor: 'var(--color-character)',
    borderColor: 'color-mix(in srgb, var(--color-character) 30%, transparent)',
    glowColor: 'color-mix(in srgb, var(--color-character) 35%, transparent)',
    icon: <User className="w-3 h-3" />,
  },
  item: {
    label: '物品',
    bgColor: 'color-mix(in srgb, var(--color-item) 15%, transparent)',
    textColor: 'var(--color-item)',
    borderColor: 'color-mix(in srgb, var(--color-item) 30%, transparent)',
    glowColor: 'color-mix(in srgb, var(--color-item) 35%, transparent)',
    icon: <Package className="w-3 h-3" />,
  },
  location: {
    label: '地点',
    bgColor: 'color-mix(in srgb, var(--color-location) 15%, transparent)',
    textColor: 'var(--color-location)',
    borderColor: 'color-mix(in srgb, var(--color-location) 30%, transparent)',
    glowColor: 'color-mix(in srgb, var(--color-location) 35%, transparent)',
    icon: <MapPin className="w-3 h-3" />,
  },
  faction: {
    label: '势力',
    bgColor: 'color-mix(in srgb, var(--color-faction) 15%, transparent)',
    textColor: 'var(--color-faction)',
    borderColor: 'color-mix(in srgb, var(--color-faction) 30%, transparent)',
    glowColor: 'color-mix(in srgb, var(--color-faction) 35%, transparent)',
    icon: <Shield className="w-3 h-3" />,
  },
  world: {
    label: '世界观',
    bgColor: 'color-mix(in srgb, var(--color-world) 15%, transparent)',
    textColor: 'var(--color-world)',
    borderColor: 'color-mix(in srgb, var(--color-world) 30%, transparent)',
    glowColor: 'color-mix(in srgb, var(--color-world) 35%, transparent)',
    icon: <Globe className="w-3 h-3" />,
  },
  rule: {
    label: '规则',
    bgColor: 'color-mix(in srgb, var(--color-rule) 15%, transparent)',
    textColor: 'var(--color-rule)',
    borderColor: 'color-mix(in srgb, var(--color-rule) 30%, transparent)',
    glowColor: 'color-mix(in srgb, var(--color-rule) 35%, transparent)',
    icon: <Scale className="w-3 h-3" />,
  },
  outline: {
    label: '大纲',
    bgColor: 'color-mix(in srgb, var(--color-outline) 15%, transparent)',
    textColor: 'var(--color-outline)',
    borderColor: 'color-mix(in srgb, var(--color-outline) 30%, transparent)',
    glowColor: 'color-mix(in srgb, var(--color-outline) 35%, transparent)',
    icon: <FileText className="w-3 h-3" />,
  },
  ifline: {
    label: 'IF线',
    bgColor: 'color-mix(in srgb, var(--color-ifline) 15%, transparent)',
    textColor: 'var(--color-ifline)',
    borderColor: 'color-mix(in srgb, var(--color-ifline) 30%, transparent)',
    glowColor: 'color-mix(in srgb, var(--color-ifline) 35%, transparent)',
    icon: <GitBranch className="w-3 h-3" />,
  },
  chapter: {
    label: '章节',
    bgColor: 'color-mix(in srgb, var(--color-outline) 12%, transparent)',
    textColor: 'var(--color-outline)',
    borderColor: 'color-mix(in srgb, var(--color-outline) 25%, transparent)',
    glowColor: 'color-mix(in srgb, var(--color-outline) 30%, transparent)',
    icon: <FileText className="w-3 h-3" />,
  },
  plot_thread: {
    label: '剧情线',
    bgColor: 'color-mix(in srgb, var(--accent-100) 18%, transparent)',
    textColor: 'var(--accent-100)',
    borderColor: 'color-mix(in srgb, var(--accent-100) 35%, transparent)',
    glowColor: 'color-mix(in srgb, var(--accent-100) 40%, transparent)',
    icon: <GitBranch className="w-3 h-3" />,
  },
}

const sizeClasses = {
  small: 'text-[10px] px-1.5 py-0.5',
  medium: 'text-xs px-2 py-1',
  large: 'text-sm px-2.5 py-1.5',
}

const sizeIconClasses = {
  small: 'w-2.5 h-2.5',
  medium: 'w-3 h-3',
  large: 'w-3.5 h-3.5',
}

export function EntityTag({ type, size = 'medium', showIcon = true, selected = false, onClick }: EntityTagProps) {
  const config = typeConfig[type]

  const isInteractive = !!onClick

  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${sizeClasses[size]} ${isInteractive ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: selected ? config.textColor + '20' : config.bgColor,
        color: config.textColor,
        border: `1px solid ${selected ? config.textColor + '50' : config.borderColor}`,
      }}
      animate={selected ? {
        scale: [1, 1.03, 1],
        boxShadow: [`0 0 0 0 ${config.glowColor}00`, `0 0 12px 3px ${config.glowColor}`, `0 0 0 0 ${config.glowColor}00`],
      } : {}}
      transition={{ duration: 0.8, repeat: selected ? Infinity : 0, repeatDelay: 2.5 }}
      whileHover={isInteractive ? {
        scale: 1.06,
        y: -1,
        boxShadow: `0 6px 16px ${config.glowColor}`,
        borderColor: config.textColor + '90',
      } : {}}
      whileTap={isInteractive ? { scale: 0.95 } : {}}
      onClick={onClick}
    >
      {showIcon && (
        <span className={sizeIconClasses[size]}>{config.icon}</span>
      )}
      {config.label}
      {selected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING.BADGE}
        >
          <Check className="w-2.5 h-2.5" />
        </motion.span>
      )}
    </motion.span>
  )
}

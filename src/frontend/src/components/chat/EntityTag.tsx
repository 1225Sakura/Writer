import { motion } from 'framer-motion'
import { EntityType } from '@/store'
import { User, Package, MapPin, Shield, Globe, Scale, FileText, GitBranch, Check } from 'lucide-react'

interface EntityTagProps {
  type: EntityType
  size?: 'small' | 'medium' | 'large'
  showIcon?: boolean
  selected?: boolean
  onClick?: () => void
}

type EntityTypeExtended = EntityType | 'chapter' | 'plot_thread'

const typeConfig: Record<EntityTypeExtended, { label: string; bgColor: string; textColor: string; borderColor: string; icon: React.ReactNode }> = {
  character: {
    label: '角色',
    bgColor: 'rgba(232, 184, 125, 0.15)',
    textColor: '#e8b87d',
    borderColor: 'rgba(232, 184, 125, 0.3)',
    icon: <User className="w-3 h-3" />,
  },
  item: {
    label: '物品',
    bgColor: 'rgba(155, 126, 217, 0.15)',
    textColor: '#b095ed',
    borderColor: 'rgba(155, 126, 217, 0.3)',
    icon: <Package className="w-3 h-3" />,
  },
  location: {
    label: '地点',
    bgColor: 'rgba(94, 181, 166, 0.15)',
    textColor: '#5eb5a6',
    borderColor: 'rgba(94, 181, 166, 0.3)',
    icon: <MapPin className="w-3 h-3" />,
  },
  faction: {
    label: '势力',
    bgColor: 'rgba(212, 93, 93, 0.15)',
    textColor: '#e07070',
    borderColor: 'rgba(212, 93, 93, 0.3)',
    icon: <Shield className="w-3 h-3" />,
  },
  world: {
    label: '世界观',
    bgColor: 'rgba(94, 106, 210, 0.15)',
    textColor: '#7b84d9',
    borderColor: 'rgba(94, 106, 210, 0.3)',
    icon: <Globe className="w-3 h-3" />,
  },
  rule: {
    label: '规则',
    bgColor: 'rgba(126, 184, 74, 0.15)',
    textColor: '#8bc44a',
    borderColor: 'rgba(126, 184, 74, 0.3)',
    icon: <Scale className="w-3 h-3" />,
  },
  outline: {
    label: '大纲',
    bgColor: 'rgba(91, 142, 232, 0.15)',
    textColor: '#6b9ef0',
    borderColor: 'rgba(91, 142, 232, 0.3)',
    icon: <FileText className="w-3 h-3" />,
  },
  ifline: {
    label: 'IF线',
    bgColor: 'rgba(126, 184, 74, 0.15)',
    textColor: '#8bc44a',
    borderColor: 'rgba(126, 184, 74, 0.3)',
    icon: <GitBranch className="w-3 h-3" />,
  },
  chapter: {
    label: '章节',
    bgColor: 'rgba(91, 142, 232, 0.12)',
    textColor: '#6b9ef0',
    borderColor: 'rgba(91, 142, 232, 0.25)',
    icon: <FileText className="w-3 h-3" />,
  },
  plot_thread: {
    label: '剧情线',
    bgColor: 'rgba(94, 106, 210, 0.18)',
    textColor: '#8590e8',
    borderColor: 'rgba(94, 106, 210, 0.35)',
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
        boxShadow: [`0 0 0 0 ${config.textColor}00`, `0 0 12px 3px ${config.textColor}35`, `0 0 0 0 ${config.textColor}00`],
      } : {}}
      transition={{ duration: 0.8, repeat: selected ? Infinity : 0, repeatDelay: 2.5 }}
      whileHover={isInteractive ? {
        scale: 1.06,
        y: -1,
        boxShadow: `0 6px 16px ${config.textColor}35`,
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
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          <Check className="w-2.5 h-2.5" />
        </motion.span>
      )}
    </motion.span>
  )
}

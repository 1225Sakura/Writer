import { motion } from 'framer-motion'
import { EntityType } from '@/store'
import { User, Package, MapPin, Shield, Globe, Scale, FileText, GitBranch } from 'lucide-react'

interface EntityTagProps {
  type: EntityType
  size?: 'small' | 'medium' | 'large'
  showIcon?: boolean
}

const typeConfig: Record<EntityType, { label: string; bgColor: string; textColor: string; icon: React.ReactNode }> = {
  character: {
    label: '角色',
    bgColor: 'var(--color-character)',
    textColor: 'var(--text-primary)',
    icon: <User className="w-3 h-3" />,
  },
  item: {
    label: '物品',
    bgColor: 'var(--color-item)',
    textColor: 'var(--text-primary)',
    icon: <Package className="w-3 h-3" />,
  },
  location: {
    label: '地点',
    bgColor: 'var(--color-location)',
    textColor: 'var(--text-primary)',
    icon: <MapPin className="w-3 h-3" />,
  },
  faction: {
    label: '势力',
    bgColor: 'var(--color-faction)',
    textColor: 'var(--text-primary)',
    icon: <Shield className="w-3 h-3" />,
  },
  world: {
    label: '世界观',
    bgColor: 'var(--color-world)',
    textColor: 'var(--text-primary)',
    icon: <Globe className="w-3 h-3" />,
  },
  rule: {
    label: '规则',
    bgColor: 'var(--color-rule)',
    textColor: 'var(--writing-text)',
    icon: <Scale className="w-3 h-3" />,
  },
  outline: {
    label: '大纲',
    bgColor: 'var(--color-outline)',
    textColor: 'var(--text-primary)',
    icon: <FileText className="w-3 h-3" />,
  },
  ifline: {
    label: 'IF线',
    bgColor: 'var(--color-ifline)',
    textColor: 'var(--writing-text)',
    icon: <GitBranch className="w-3 h-3" />,
  },
  chapter: {
    label: '章节',
    bgColor: 'var(--color-outline)',
    textColor: 'var(--text-primary)',
    icon: <FileText className="w-3 h-3" />,
  },
  plot_thread: {
    label: '剧情线',
    bgColor: 'var(--accent-primary)',
    textColor: 'var(--text-primary)',
    icon: <GitBranch className="w-3 h-3" />,
  },
}

const sizeClasses = {
  small: 'text-[10px] px-1.5 py-0.5',
  medium: 'text-xs px-2 py-1',
  large: 'text-sm px-3 py-1.5',
}

const sizeIconClasses = {
  small: 'w-2.5 h-2.5',
  medium: 'w-3 h-3',
  large: 'w-3.5 h-3.5',
}

export function EntityTag({ type, size = 'medium', showIcon = true }: EntityTagProps) {
  const config = typeConfig[type]

  return (
    <motion.span
      className={`inline-flex items-center gap-1 rounded font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: config.bgColor,
        color: config.textColor,
      }}
      whileHover={{
        scale: 1.05,
        boxShadow: `0 2px 8px ${config.bgColor}40`,
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {showIcon && (
        <span className={sizeIconClasses[size]}>{config.icon}</span>
      )}
      {config.label}
    </motion.span>
  )
}

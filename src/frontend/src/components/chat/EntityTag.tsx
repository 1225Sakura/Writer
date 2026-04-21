import { EntityType } from '@/store'

interface EntityTagProps {
  type: EntityType
  size?: 'small' | 'medium' | 'large'
  showIcon?: boolean
}

const typeConfig: Record<EntityType, { label: string; bgColor: string; textColor: string }> = {
  character: {
    label: '角色',
    bgColor: 'var(--color-character)',
    textColor: 'var(--writing-text)',
  },
  item: {
    label: '物品',
    bgColor: 'var(--color-item)',
    textColor: '#ffffff',
  },
  location: {
    label: '地点',
    bgColor: 'var(--color-location)',
    textColor: '#ffffff',
  },
  faction: {
    label: '势力',
    bgColor: 'var(--color-faction)',
    textColor: '#ffffff',
  },
  world: {
    label: '世界观',
    bgColor: 'var(--color-world)',
    textColor: '#ffffff',
  },
  rule: {
    label: '规则',
    bgColor: 'var(--color-rule)',
    textColor: 'var(--writing-text)',
  },
  outline: {
    label: '大纲',
    bgColor: 'var(--color-outline)',
    textColor: '#ffffff',
  },
  ifline: {
    label: 'IF线',
    bgColor: 'var(--color-ifline)',
    textColor: 'var(--writing-text)',
  },
}

const sizeClasses = {
  small: 'text-xs px-1.5 py-0.5',
  medium: 'text-sm px-2 py-1',
  large: 'text-base px-3 py-1.5',
}

export function EntityTag({ type, size = 'medium', showIcon = false }: EntityTagProps) {
  const config = typeConfig[type]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${sizeClasses[size]}`}
      style={{ backgroundColor: config.bgColor, color: config.textColor }}
    >
      {showIcon && <span>●</span>}
      {config.label}
    </span>
  )
}

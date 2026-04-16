import { EntityType } from '@/store'

interface EntityTagProps {
  type: EntityType
  size?: 'small' | 'medium' | 'large'
  showIcon?: boolean
}

const typeConfig: Record<EntityType, { label: string; bgColor: string; textColor: string }> = {
  character: {
    label: '角色',
    bgColor: '#e8b87d',
    textColor: '#1a1a2e',
  },
  item: {
    label: '物品',
    bgColor: '#9b7ed9',
    textColor: '#ffffff',
  },
  location: {
    label: '地点',
    bgColor: '#5eb5a6',
    textColor: '#ffffff',
  },
  faction: {
    label: '势力',
    bgColor: '#d45d5d',
    textColor: '#ffffff',
  },
  world: {
    label: '世界观',
    bgColor: '#5e6ad2',
    textColor: '#ffffff',
  },
  rule: {
    label: '规则',
    bgColor: '#7eb84a',
    textColor: '#1a1a2e',
  },
  outline: {
    label: '大纲',
    bgColor: '#5b8ee8',
    textColor: '#ffffff',
  },
  ifline: {
    label: 'IF线',
    bgColor: '#7eb84a',
    textColor: '#1a1a2e',
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

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Users, MapPin, Swords, BookOpen, Globe, Scroll, FileText
} from 'lucide-react'

type EntityNodeType =
  | 'character' | 'item' | 'location' | 'faction'
  | 'world' | 'rule' | 'outline' | 'ifline'

const ENTITY_CONFIG: Record<EntityNodeType, {
  label: string
  colorVar: string
  icon: typeof Users
}> = {
  character: { label: '角色', colorVar: '--color-character', icon: Users },
  item:      { label: '物品', colorVar: '--color-item', icon: Scroll },
  location:  { label: '地点', colorVar: '--color-location', icon: MapPin },
  faction:   { label: '势力', colorVar: '--color-faction', icon: Swords },
  world:     { label: '世界观', colorVar: '--color-world', icon: Globe },
  rule:      { label: '规则', colorVar: '--color-rule', icon: BookOpen },
  outline:   { label: '大纲', colorVar: '--color-outline', icon: FileText },
  ifline:    { label: 'IF线', colorVar: '--color-ifline', icon: Scroll },
}

export interface CanvasNodeData {
  entityName: string
  entityType: EntityNodeType
  description?: string
  [key: string]: unknown
}

function CanvasNodeInner({ data, selected }: NodeProps) {
  const { entityName, entityType, description } = data as CanvasNodeData
  const config = ENTITY_CONFIG[entityType] || ENTITY_CONFIG.character
  const Icon = config.icon

  return (
    <div
      className="group relative"
      style={{ minWidth: 160, maxWidth: 220 }}
    >
      {/* Target handle (incoming connections) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          background: 'var(--accent-primary)',
          border: '2px solid var(--paper-100)',
          top: -4,
        }}
      />

      {/* Node card */}
      <div
        style={{
          background: 'var(--paper-80)',
          border: `1.5px solid ${selected ? 'var(--accent-primary)' : 'var(--border-default)'}`,
          borderRadius: 8,
          padding: '10px 12px',
          boxShadow: selected
            ? '0 0 12px rgba(201, 169, 110, 0.3), var(--shadow-card)'
            : 'var(--shadow-card)',
          transition: 'box-shadow 0.2s, border-color 0.2s',
          cursor: 'grab',
        }}
      >
        {/* Type indicator bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 12,
            right: 12,
            height: 2,
            borderRadius: '0 0 2px 2px',
            background: `var(${config.colorVar})`,
          }}
        />

        {/* Header: icon + name */}
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `color-mix(in srgb, var(${config.colorVar}) 15%, transparent)`,
              flexShrink: 0,
            }}
          >
            <Icon
              style={{
                width: 14,
                height: 14,
                color: `var(${config.colorVar})`,
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-xs font-medium truncate"
              style={{ color: 'var(--ink-100)' }}
            >
              {entityName}
            </div>
            <div
              className="text-[10px] mt-0.5"
              style={{ color: `var(${config.colorVar})` }}
            >
              {config.label}
            </div>
          </div>
        </div>

        {/* Description */}
        {description && (
          <div
            className="text-[10px] mt-1.5 leading-relaxed overflow-hidden"
            style={{
              color: 'var(--ink-90)',
              opacity: 0.7,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {description}
          </div>
        )}
      </div>

      {/* Source handle (outgoing connections) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          background: 'var(--accent-primary)',
          border: '2px solid var(--paper-100)',
          bottom: -4,
        }}
      />
    </div>
  )
}

export const CanvasNode = memo(CanvasNodeInner)

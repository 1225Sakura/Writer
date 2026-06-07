import { memo, type CSSProperties } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

// Relationship types with display labels and colors
export const RELATIONSHIP_TYPES = {
  family:   { label: '家族', color: 'var(--color-character)' },
  friend:   { label: '友人', color: 'var(--color-ifline)' },
  enemy:    { label: '敌对', color: 'var(--color-faction)' },
  master:   { label: '师徒', color: 'var(--color-world)' },
  disciple: { label: '弟子', color: 'var(--color-rule)' },
  rival:    { label: '对手', color: 'var(--color-item)' },
  romantic: { label: '情缘', color: 'var(--color-outline)' },
  other:    { label: '其他', color: 'var(--text-tertiary)' },
} as const

export type RelType = keyof typeof RELATIONSHIP_TYPES

export interface RelationshipEdgeData {
  relationType: RelType
  description?: string
  characterId?: number   // source character store ID
  relationshipId?: number // relationship store ID
  [key: string]: unknown
}

function RelationshipEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const relType: RelType = (data?.relationType as RelType) || 'other'
  const relConfig = RELATIONSHIP_TYPES[relType]
  const isAnimated = relType === 'romantic'
  const isDashed = relType === 'enemy' || relType === 'rival'

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const edgeStyle: CSSProperties = {
    stroke: relConfig.color,
    strokeWidth: selected ? 2.5 : 1.5,
    strokeDasharray: isDashed ? '6 3' : undefined,
    opacity: selected ? 1 : 0.7,
    transition: 'stroke-width 0.15s, opacity 0.15s',
    ...style,
  }

  return (
    <>
      {/* Invisible wider path for easier clicking / right-clicking */}
      <BaseEdge
        id={`${id}-hitarea`}
        path={edgePath}
        style={{
          stroke: 'transparent',
          strokeWidth: 16,
          cursor: 'pointer',
        }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
        interactionWidth={0}
      />
      {/* Animated overlay for romantic */}
      {isAnimated && (
        <BaseEdge
          id={`${id}-animated`}
          path={edgePath}
          style={{
            ...edgeStyle,
            strokeDasharray: '4 8',
            animation: 'dash-flow 1.5s linear infinite',
            opacity: 0.5,
          }}
          interactionWidth={0}
        />
      )}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            cursor: 'pointer',
          }}
          className="nodrag nopan"
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'var(--paper-80)',
              border: `1px solid ${selected ? relConfig.color : 'var(--border-default)'}`,
              color: relConfig.color,
              boxShadow: selected
                ? `0 0 6px color-mix(in srgb, ${relConfig.color} 30%, transparent)`
                : 'none',
              whiteSpace: 'nowrap',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              userSelect: 'none',
            }}
          >
            {relConfig.label}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const RelationshipEdge = memo(RelationshipEdgeInner)

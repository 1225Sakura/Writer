import { useState, useCallback, useEffect } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import { RELATIONSHIP_TYPES, type RelType } from './RelationshipEdge'
import type { RelationshipEdgeData } from './RelationshipEdge'

interface RelationshipDetailPanelProps {
  edgeId: string
  sourceLabel: string
  targetLabel: string
  data: RelationshipEdgeData
  onUpdateRelationType: (edgeId: string, newType: RelType) => void
  onDelete: (edgeId: string) => void
  onClose: () => void
}

export function RelationshipDetailPanel({
  edgeId,
  sourceLabel,
  targetLabel,
  data,
  onUpdateRelationType,
  onDelete,
  onClose,
}: RelationshipDetailPanelProps) {
  const [selectedType, setSelectedType] = useState<RelType>(data.relationType || 'other')
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setSelectedType(data.relationType || 'other')
    setHasChanges(false)
  }, [edgeId, data.relationType])

  const handleTypeChange = useCallback((newType: RelType) => {
    setSelectedType(newType)
    setHasChanges(newType !== data.relationType)
  }, [data.relationType])

  const handleSave = useCallback(() => {
    if (hasChanges) {
      onUpdateRelationType(edgeId, selectedType)
      setHasChanges(false)
    }
  }, [edgeId, selectedType, hasChanges, onUpdateRelationType])

  const handleDelete = useCallback(() => {
    onDelete(edgeId)
  }, [edgeId, onDelete])

  const relConfig = RELATIONSHIP_TYPES[selectedType]

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 280,
        background: 'var(--paper-80)',
        borderLeft: '1px solid var(--border-default)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          关系详情
        </div>
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            border: 'none',
            background: 'transparent',
            borderRadius: 4,
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        {/* Entities */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 500 }}>
            关联实体
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 6,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
              {sourceLabel}
            </span>
            <span style={{ fontSize: 11, color: relConfig.color, fontWeight: 600 }}>
              &mdash; {relConfig.label} &rarr;
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
              {targetLabel}
            </span>
          </div>
        </div>

        {/* Relationship Type Selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 500 }}>
            关系类型
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(Object.entries(RELATIONSHIP_TYPES) as [RelType, typeof RELATIONSHIP_TYPES[RelType]][]).map(
              ([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleTypeChange(key)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: `1.5px solid ${selectedType === key ? config.color : 'var(--border-subtle)'}`,
                    background:
                      selectedType === key
                        ? `color-mix(in srgb, ${config.color} 10%, transparent)`
                        : 'transparent',
                    color: selectedType === key ? config.color : 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: selectedType === key ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'center',
                  }}
                >
                  {config.label}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 500 }}>
              描述
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                padding: '8px 10px',
                borderRadius: 6,
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {data.description}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <button
          onClick={handleDelete}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--color-danger)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--vermillion-muted)'
            e.currentTarget.style.borderColor = 'var(--color-danger)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'var(--border-subtle)'
          }}
        >
          <Trash2 size={13} />
          删除关系
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 6,
            border: 'none',
            background: hasChanges ? 'var(--accent-primary)' : 'var(--color-surface-raised)',
            color: hasChanges ? 'var(--paper-100)' : 'var(--text-disabled)',
            fontSize: 12,
            fontWeight: 500,
            cursor: hasChanges ? 'pointer' : 'not-allowed',
            marginLeft: 'auto',
            transition: 'all 0.15s',
            opacity: hasChanges ? 1 : 0.6,
          }}
        >
          <Save size={13} />
          保存
        </button>
      </div>
    </div>
  )
}

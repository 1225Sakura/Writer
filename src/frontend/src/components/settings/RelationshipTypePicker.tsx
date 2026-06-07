import { RELATIONSHIP_TYPES, type RelType } from './RelationshipEdge'

interface RelationshipTypePickerProps {
  sourceLabel: string
  targetLabel: string
  onSelect: (type: RelType) => void
  onCancel: () => void
}

export function RelationshipTypePicker({
  sourceLabel,
  targetLabel,
  onSelect,
  onCancel,
}: RelationshipTypePickerProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--paper-80)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
          padding: '20px',
          minWidth: 280,
          maxWidth: 340,
          backdropFilter: 'blur(16px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 6,
            }}
          >
            选择关系类型
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{sourceLabel}</span>
            <span style={{ margin: '0 6px', color: 'var(--text-tertiary)' }}>&rarr;</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{targetLabel}</span>
          </div>
        </div>

        {/* Type grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {(Object.entries(RELATIONSHIP_TYPES) as [RelType, typeof RELATIONSHIP_TYPES[RelType]][]).map(
            ([key, config]) => (
              <button
                key={key}
                onClick={() => onSelect(key)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1.5px solid color-mix(in srgb, ${config.color} 30%, transparent)`,
                  background: `color-mix(in srgb, ${config.color} 6%, transparent)`,
                  color: config.color,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `color-mix(in srgb, ${config.color} 15%, transparent)`
                  e.currentTarget.style.borderColor = config.color
                  e.currentTarget.style.transform = 'scale(1.02)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `color-mix(in srgb, ${config.color} 6%, transparent)`
                  e.currentTarget.style.borderColor = `color-mix(in srgb, ${config.color} 30%, transparent)`
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                {config.label}
              </button>
            ),
          )}
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          取消
        </button>
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  key: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

interface CanvasContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function CanvasContextMenu({ x, y, items, onClose }: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // Clamp position to viewport
  const adjustedX = Math.min(x, window.innerWidth - 180)
  const adjustedY = Math.min(y, window.innerHeight - (items.length * 36 + 16))

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 9999,
        minWidth: 150,
        background: 'var(--paper-80)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(12px)',
        padding: '4px',
        overflow: 'hidden',
      }}
      className="canvas-context-menu"
    >
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => {
            item.onClick()
            onClose()
          }}
          disabled={item.disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '7px 10px',
            border: 'none',
            background: 'transparent',
            borderRadius: 5,
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            color: item.danger
              ? 'var(--color-danger)'
              : item.disabled
                ? 'var(--text-disabled)'
                : 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 500,
            textAlign: 'left',
            transition: 'background 0.1s',
            opacity: item.disabled ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) {
              e.currentTarget.style.background = item.danger
                ? 'var(--vermillion-muted)'
                : 'var(--color-surface-hover)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {item.icon && (
            <span style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.icon}
            </span>
          )}
          {item.label}
        </button>
      ))}
    </div>
  )
}

/**
 * OutlineTreeNode - Recursive tree node for the outline sidebar
 *
 * Renders a single outline item with expand/collapse, drag handle,
 * status badge, word count, and indent guides.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronDown,
  FileText,
  MoreHorizontal,
  GripVertical,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

export interface OutlineItem {
  id: string
  title: string
  level: number
  children: OutlineItem[]
  isExpanded?: boolean
  status?: 'draft' | 'writing' | 'review' | 'completed'
  wordCount?: number
}

const depthColorMap = [
  'var(--color-outline)',       // depth 0 - chapters
  'var(--color-character)',     // depth 1 - scenes
  'var(--color-item)',          // depth 2
  'var(--color-location)',      // depth 3
  'var(--color-ifline)',        // depth 4
]

const statusConfig = {
  draft: { label: '草稿', color: 'var(--text-tertiary)', bg: 'color-mix(in srgb, var(--text-tertiary) 12%, transparent)' },
  writing: { label: '写作中', color: 'var(--accent-primary)', bg: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' },
  review: { label: '审阅', color: 'var(--color-warning)', bg: 'color-mix(in srgb, var(--color-warning) 12%, transparent)' },
  completed: { label: '完成', color: 'var(--color-success)', bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)' },
}

export function TreeNode({
  item,
  depth = 0,
  onSelect,
  selectedId,
  isDragging,
  isDragOver,
  dragOverPosition,
}: {
  item: OutlineItem
  depth?: number
  onSelect: (id: string) => void
  selectedId: string | null
  isDragging?: boolean
  isDragOver?: boolean
  dragOverPosition?: 'before' | 'after' | 'inside'
}) {
  const [isExpanded, setIsExpanded] = useState(item.isExpanded ?? depth < 2)
  const hasChildren = item.children.length > 0
  const isSelected = selectedId === item.id

  const indentColor = depthColorMap[Math.min(depth, depthColorMap.length - 1)]
  const status = item.status || 'draft'
  const statusInfo = statusConfig[status]

  return (
    <div className="select-none relative">
      {/* Drag drop indicator - before */}
      {isDragOver && dragOverPosition === 'before' && (
        <div className="drag-over-indicator" style={{ top: '-1px' }} />
      )}

      {/* Drag drop indicator - after */}
      {isDragOver && dragOverPosition === 'after' && (
        <div className="drag-over-indicator" style={{ bottom: '-1px' }} />
      )}

      <div
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-level={depth + 1}
        className={`
          flex items-center gap-1.5 rounded-lg cursor-pointer transition-all duration-200 group relative
          ${isSelected
            ? 'text-[var(--accent-primary)]'
            : 'hover:bg-[var(--color-surface-hover)] text-[var(--text-secondary)]'
          }
          ${isDragging ? 'dragging-item' : 'opacity-100'}
        `}
        style={{
          paddingLeft: `${depth * 18 + 10}px`,
          paddingRight: '8px',
          paddingTop: '6px',
          paddingBottom: '6px',
          background: isSelected
            ? 'linear-gradient(90deg, color-mix(in srgb, var(--accent-primary) 10%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 5%, transparent) 50%, transparent 100%)'
            : undefined,
        }}
        onClick={() => onSelect(item.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item.id) } }}
      >
        {/* Active chapter left indicator with glow */}
        {isSelected && (
          <motion.div
            layoutId="outline-selected-indicator"
            className="outline-active-glow"
            style={{
              '--active-color': indentColor,
            } as React.CSSProperties}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}

        {/* Indent guide line */}
        {depth > 0 && (
          <div
            className="outline-indent-guide"
            style={{
              left: `${(depth - 1) * 18 + 18}px`,
              top: '0',
              bottom: '0',
              '--indent-color': indentColor,
            } as React.CSSProperties}
          />
        )}

        {/* Drag handle */}
        <div className="opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
          <Icon icon={GripVertical} size="xs" color="muted" />
        </div>

        {/* Expand/collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          aria-label={hasChildren ? (isExpanded ? '折叠' : '展开') : '文件'}
          aria-expanded={hasChildren ? isExpanded : undefined}
          className={`
            w-5 h-5 flex items-center justify-center rounded-md transition-all duration-150
            ${hasChildren
              ? 'text-[var(--text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-secondary)]'
              : 'text-[var(--text-tertiary)]/40'
            }
          `}
        >
          {hasChildren ? (
            isExpanded ? (
              <Icon icon={ChevronDown} size="xs" />
            ) : (
              <Icon icon={ChevronRight} size="xs" />
            )
          ) : (
            <Icon icon={FileText} size="xs" className="opacity-50" />
          )}
        </button>

        {/* Title */}
        <span className={`
          flex-1 text-sm truncate transition-colors duration-150
          ${isSelected ? 'font-medium' : 'font-normal'}
        `}
          style={{
            color: isSelected ? indentColor : undefined,
            paddingLeft: depth > 0 ? '2px' : undefined,
          }}
        >
          {item.title}
        </span>

        {/* Status badge with progress ring for completed chapters */}
        {depth === 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {status === 'completed' && (
              <svg className="progress-ring w-3.5 h-3.5" viewBox="0 0 16 16">
                <circle className="progress-ring__track" cx="8" cy="8" r="6" />
                <circle
                  className="progress-ring__fill"
                  cx="8" cy="8" r="6"
                  strokeDasharray={`${2 * Math.PI * 6}`}
                  strokeDashoffset={0}
                  style={{ '--progress-color': 'var(--color-success)' } as React.CSSProperties}
                />
              </svg>
            )}
            {status === 'writing' && (
              <svg className="progress-ring w-3.5 h-3.5" viewBox="0 0 16 16">
                <circle className="progress-ring__track" cx="8" cy="8" r="6" />
                <circle
                  className="progress-ring__fill"
                  cx="8" cy="8" r="6"
                  strokeDasharray={`${2 * Math.PI * 6}`}
                  strokeDashoffset={`${2 * Math.PI * 6 * 0.3}`}
                  style={{ '--progress-color': 'var(--accent-primary)' } as React.CSSProperties}
                />
              </svg>
            )}
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: statusInfo.bg,
                color: statusInfo.color,
              }}
            >
              {statusInfo.label}
            </span>
          </div>
        )}

        {/* Word count */}
        {item.wordCount && item.wordCount > 0 && (
          <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0 tabular-nums">
            {item.wordCount.toLocaleString()}
          </span>
        )}

        {/* Hover actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5">
          <button
            className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label="更多操作"
            title="更多操作"
          >
            <Icon icon={MoreHorizontal} size="xs" />
          </button>
        </div>
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            className="overflow-hidden relative"
          >
            <div
              className="outline-indent-guide"
              style={{
                left: `${depth * 18 + 18}px`,
                top: '0',
                bottom: '4px',
                '--indent-color': indentColor,
              } as React.CSSProperties}
            />
            {item.children.map((child) => (
              <TreeNode
                key={child.id}
                item={child}
                depth={depth + 1}
                onSelect={onSelect}
                selectedId={selectedId}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { memo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, BarChart3 } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import type { Chapter, ChapterStatus } from '@/shared/types'

/* ---- Status config ---- */

const STATUS_CONFIG: Record<ChapterStatus, { label: string; color: string }> = {
  planning:  { label: '规划中', color: 'var(--color-outline)' },
  pending:   { label: '待开始', color: 'var(--text-tertiary)' },
  writing:   { label: '写作中', color: 'var(--color-character)' },
  review:    { label: '审核中', color: 'var(--color-faction)' },
  completed: { label: '已完成', color: 'var(--color-location)' },
  archived:  { label: '已归档', color: 'var(--text-disabled)' },
}

/* ---- Props ---- */

export interface ChapterCardProps {
  chapter: Chapter
  isActive?: boolean
  onClick?: (chapterId: number) => void
}

/* ---- Component ---- */

export const ChapterCard = memo(function ChapterCard({
  chapter,
  isActive,
  onClick,
}: ChapterCardProps) {
  const [hovered, setHovered] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const statusCfg = STATUS_CONFIG[chapter.status] ?? STATUS_CONFIG.pending
  const summary = chapter.summary
    ? chapter.summary.length > 100
      ? chapter.summary.slice(0, 100) + '...'
      : chapter.summary
    : ''

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <motion.div
        className="relative rounded-lg p-3.5 cursor-pointer group"
        style={{
          background: 'var(--color-surface-raised)',
          border: isActive
            ? '1px solid var(--accent-primary)'
            : '1px solid var(--border-subtle)',
          boxShadow: isDragging
            ? '0 8px 24px rgba(0,0,0,0.25)'
            : hovered
              ? '0 2px 8px rgba(0,0,0,0.12)'
              : '0 1px 2px rgba(0,0,0,0.06)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onClick?.(chapter.id)}
        initial={false}
        animate={hovered && !isDragging ? { y: -2 } : { y: 0 }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        {/* Accent top bar */}
        <div className="absolute top-0 left-3 right-3 h-px rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={{ opacity: 0.12, scaleX: 0.4 }}
            animate={{
              opacity: hovered || isActive ? 0.5 : 0.12,
              scaleX: hovered || isActive ? 1 : 0.4,
            }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            style={{
              background: `linear-gradient(90deg, transparent, ${statusCfg.color}, transparent)`,
            }}
          />
        </div>

        {/* Drag handle + content */}
        <div className="flex items-start gap-2">
          <button
            className="mt-0.5 p-0.5 rounded text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0"
            {...listeners}
          >
            <GripVertical size={14} />
          </button>

          <div className="flex-1 min-w-0">
            {/* Title */}
            <h4 className="text-sm font-medium text-[var(--text-primary)] truncate leading-tight">
              {chapter.title || `第 ${chapter.chapter_order} 章`}
            </h4>

            {/* Summary */}
            {summary && (
              <p className="text-xs text-[var(--text-tertiary)] line-clamp-3 mt-1.5 leading-relaxed">
                {summary}
              </p>
            )}

            {/* Footer: word count + status */}
            <div className="flex items-center justify-between mt-2.5 gap-2">
              <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                <Icon icon={BarChart3} size="xs" color="muted" />
                <span className="tabular-nums">{chapter.word_count.toLocaleString()} 字</span>
              </div>

              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                style={{
                  backgroundColor: `color-mix(in srgb, ${statusCfg.color} 12%, transparent)`,
                  color: statusCfg.color,
                }}
              >
                {statusCfg.label}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
})

/* ---- Drag overlay variant (no sortable hooks) ---- */

export const ChapterCardOverlay = memo(function ChapterCardOverlay({
  chapter,
}: {
  chapter: Chapter
}) {
  const statusCfg = STATUS_CONFIG[chapter.status] ?? STATUS_CONFIG.pending
  const summary = chapter.summary
    ? chapter.summary.length > 100
      ? chapter.summary.slice(0, 100) + '...'
      : chapter.summary
    : ''

  return (
    <div
      className="rounded-lg p-3.5 w-[240px]"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
        transform: 'rotate(2deg)',
      }}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 p-0.5 text-[var(--text-tertiary)] flex-shrink-0">
          <GripVertical size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">
            {chapter.title || `第 ${chapter.chapter_order} 章`}
          </h4>
          {summary && (
            <p className="text-xs text-[var(--text-tertiary)] line-clamp-2 mt-1 leading-relaxed">
              {summary}
            </p>
          )}
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
              <Icon icon={BarChart3} size="xs" color="muted" />
              <span>{chapter.word_count.toLocaleString()} 字</span>
            </div>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: `color-mix(in srgb, ${statusCfg.color} 12%, transparent)`,
                color: statusCfg.color,
              }}
            >
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

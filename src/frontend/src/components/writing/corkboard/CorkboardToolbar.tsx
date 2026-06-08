import { memo } from 'react'
import { motion } from 'framer-motion'
import {
  LayoutGrid,
  Plus,
  ArrowUpDown,
  Filter,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import type { ChapterStatus } from '@/shared/types'

/* ---- Types ---- */

export type SortMode = 'order' | 'title' | 'wordCount' | 'status'

export interface CorkboardToolbarProps {
  chapterCount: number
  sortMode: SortMode
  onSortModeChange: (mode: SortMode) => void
  filterStatus: ChapterStatus | 'all'
  onFilterStatusChange: (status: ChapterStatus | 'all') => void
  onCreateChapter?: () => void
}

/* ---- Sort options ---- */

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'order', label: '按顺序' },
  { value: 'title', label: '按标题' },
  { value: 'wordCount', label: '按字数' },
  { value: 'status', label: '按状态' },
]

const FILTER_OPTIONS: { value: ChapterStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'planning', label: '规划中' },
  { value: 'writing', label: '写作中' },
  { value: 'review', label: '审核中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
]

/* ---- Component ---- */

export const CorkboardToolbar = memo(function CorkboardToolbar({
  chapterCount,
  sortMode,
  onSortModeChange,
  filterStatus,
  onFilterStatusChange,
  onCreateChapter,
}: CorkboardToolbarProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
      style={{
        background: 'var(--color-surface-raised)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Left: title + count */}
      <div className="flex items-center gap-2">
        <Icon icon={LayoutGrid} size="sm" color="accent" />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          软木板视图
        </span>
        <span
          className="text-[11px] px-1.5 py-0.5 rounded-md font-medium tabular-nums"
          style={{
            background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
            color: 'var(--accent-primary)',
          }}
        >
          {chapterCount}
        </span>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1.5">
        {/* Sort dropdown */}
        <div className="relative group">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <Icon icon={ArrowUpDown} size="xs" />
            <span className="hidden sm:inline">{SORT_OPTIONS.find(o => o.value === sortMode)?.label}</span>
          </motion.button>
          <div className="absolute right-0 top-full mt-1 w-28 rounded-lg py-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-30"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onSortModeChange(opt.value)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  sortMode === opt.value
                    ? 'text-[var(--accent-primary)] bg-[var(--color-surface-hover)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter dropdown */}
        <div className="relative group">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <Icon icon={Filter} size="xs" />
            <span className="hidden sm:inline">{FILTER_OPTIONS.find(o => o.value === filterStatus)?.label}</span>
          </motion.button>
          <div className="absolute right-0 top-full mt-1 w-24 rounded-lg py-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-30"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onFilterStatusChange(opt.value)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  filterStatus === opt.value
                    ? 'text-[var(--accent-primary)] bg-[var(--color-surface-hover)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div
          className="w-px h-5 flex-shrink-0 mx-0.5"
          style={{
            background: 'linear-gradient(to bottom, transparent, var(--border-default) 20%, var(--border-default) 80%, transparent)',
          }}
        />

        {/* Add chapter */}
        {onCreateChapter && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onCreateChapter}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'var(--accent-primary)',
              color: 'var(--paper-100)',
              border: '1px solid color-mix(in srgb, var(--accent-primary) 60%, transparent)',
            }}
          >
            <Icon icon={Plus} size="xs" color="inherit" />
            <span className="hidden sm:inline">新建章节</span>
          </motion.button>
        )}
      </div>
    </div>
  )
})

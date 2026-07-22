/**
 * CorkboardEmptyState — empty-state placeholder when no chapters match filters.
 *
 * v0.5 Phase 3 Track E.5: extracted from CorkboardView to satisfy the
 * 300-line per-file budget (AC-1).
 */
import { motion } from 'framer-motion'
import type { ChapterStatus } from '@/shared/types'

export interface CorkboardEmptyStateProps {
  filterStatus: ChapterStatus | 'all'
  onCreateChapter: () => void
}

export function CorkboardEmptyState({
  filterStatus,
  onCreateChapter,
}: CorkboardEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{
          background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
        }}
      >
        <span className="text-2xl opacity-60">📋</span>
      </div>
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">
        {filterStatus === 'all' ? '还没有章节' : '没有匹配的章节'}
      </h3>
      <p className="text-xs text-[var(--text-tertiary)] mb-4">
        {filterStatus === 'all'
          ? '创建第一个章节开始写作吧'
          : '尝试切换筛选条件查看其他章节'}
      </p>
      {filterStatus === 'all' && (
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onCreateChapter}
          className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: 'var(--accent-primary)',
            color: 'var(--paper-100)',
            border: '1px solid color-mix(in srgb, var(--accent-primary) 60%, transparent)',
          }}
        >
          创建第一章
        </motion.button>
      )}
    </div>
  )
}

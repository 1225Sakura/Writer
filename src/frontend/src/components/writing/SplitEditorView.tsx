/**
 * SplitEditorView - Split editor view for comparing chapters side by side
 *
 * Shows two WritingCanvas instances with a draggable divider.
 * Only visible in collaboration mode.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Columns2, X, Link, Unlink } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { WritingCanvas } from './WritingCanvas'
import { useWritingStore, useContentStore } from '@/store'
import { useImmersiveModeContext } from './immersive'

interface SplitEditorViewProps {
  leftChapterId?: number
  rightChapterId?: number
  onChapterChange?: (side: 'left' | 'right', chapterId: number) => void
  onClose?: () => void
}

export function SplitEditorView({
  leftChapterId,
  rightChapterId,
  onChapterChange,
  onClose,
}: SplitEditorViewProps) {
  const { writingMode } = useImmersiveModeContext()
  const { chapters } = useContentStore()
  const { currentChapterId } = useWritingStore()
  void leftChapterId
  void currentChapterId
  const [splitRatio, setSplitRatio] = useState(50)
  const [isResizing, setIsResizing] = useState(false)
  const [syncScroll, setSyncScroll] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)

  // Default chapters
  const rightId = rightChapterId ?? (chapters.length > 1 ? chapters[1]?.id : undefined)

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = (x / rect.width) * 100
      setSplitRatio(Math.max(20, Math.min(80, ratio)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  // Sync scroll between panes
  useEffect(() => {
    if (!syncScroll) return

    const leftEl = leftScrollRef.current?.querySelector('.scrollbar-ink')
    const rightEl = rightScrollRef.current?.querySelector('.scrollbar-ink')

    if (!leftEl || !rightEl) return

    let isSyncing = false

    const syncFromLeft = () => {
      if (isSyncing) return
      isSyncing = true
      rightEl.scrollTop = leftEl.scrollTop
      isSyncing = false
    }

    const syncFromRight = () => {
      if (isSyncing) return
      isSyncing = true
      leftEl.scrollTop = rightEl.scrollTop
      isSyncing = false
    }

    leftEl.addEventListener('scroll', syncFromLeft)
    rightEl.addEventListener('scroll', syncFromRight)

    return () => {
      leftEl.removeEventListener('scroll', syncFromLeft)
      rightEl.removeEventListener('scroll', syncFromRight)
    }
  }, [syncScroll])

  // Only show in collaboration mode
  if (writingMode !== 'collaboration') {
    return null
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col relative">
      {/* Split controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-surface-raised)] border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <Icon icon={Columns2} size="sm" style={{ color: 'var(--accent-primary)' }} />
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            分屏模式
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync scroll toggle */}
          <button
            onClick={() => setSyncScroll(!syncScroll)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors"
            style={{
              background: syncScroll
                ? 'color-mix(in srgb, var(--accent-primary) 15%, transparent)'
                : 'transparent',
              color: syncScroll ? 'var(--accent-primary)' : 'var(--text-tertiary)',
            }}
            title={syncScroll ? '关闭同步滚动' : '开启同步滚动'}
          >
            <Icon icon={syncScroll ? Link : Unlink} size="xs" />
            <span>同步滚动</span>
          </button>

          {/* Close split view */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            title="关闭分屏"
          >
            <Icon icon={X} size="xs" />
          </button>
        </div>
      </div>

      {/* Split panes */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left pane */}
        <div
          ref={leftScrollRef}
          className="overflow-hidden"
          style={{ width: `${splitRatio}%` }}
        >
          <WritingCanvas />
        </div>

        {/* Resize handle */}
        <div
          className="relative flex-shrink-0 cursor-col-resize group"
          style={{ width: '4px' }}
          onMouseDown={handleMouseDown}
        >
          <div
            className="absolute inset-y-0 -left-1 -right-1 z-10"
            style={{ cursor: 'col-resize' }}
          />
          <motion.div
            className="absolute inset-y-0 left-0 right-0"
            style={{
              background: isResizing
                ? 'var(--accent-primary)'
                : 'var(--border-default)',
            }}
            whileHover={{ background: 'var(--accent-primary)' }}
          />
        </div>

        {/* Right pane */}
        <div
          ref={rightScrollRef}
          className="overflow-hidden"
          style={{ width: `${100 - splitRatio}%` }}
        >
          {rightId ? (
            <WritingCanvas />
          ) : (
            <div className="h-full flex items-center justify-center bg-[var(--writing-bg)]">
              <div className="text-center">
                <p className="text-sm text-[var(--text-tertiary)] mb-2">
                  选择右侧章节
                </p>
                <select
                  className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-raised)] border border-[var(--border-default)] text-[var(--text-secondary)]"
                  onChange={(e) => {
                    const id = parseInt(e.target.value)
                    if (!isNaN(id) && onChapterChange) {
                      onChapterChange('right', id)
                    }
                  }}
                >
                  <option value="">选择章节...</option>
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title || `第${ch.chapter_order}章`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * SplitViewButton - Button to toggle split view mode
 */
export function SplitViewButton({
  isSplit,
  onToggle,
}: {
  isSplit: boolean
  onToggle: () => void
}) {
  const { writingMode } = useImmersiveModeContext()

  // Only show in collaboration mode
  if (writingMode !== 'collaboration') {
    return null
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
      style={{
        background: isSplit
          ? 'color-mix(in srgb, var(--accent-primary) 15%, transparent)'
          : 'transparent',
        color: isSplit ? 'var(--accent-primary)' : 'var(--text-tertiary)',
        border: isSplit
          ? '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)'
          : '1px solid transparent',
      }}
      title={isSplit ? '关闭分屏' : '开启分屏'}
    >
      <Icon icon={Columns2} size="xs" />
      <span>分屏</span>
    </motion.button>
  )
}

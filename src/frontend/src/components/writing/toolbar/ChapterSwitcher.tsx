import { useState, useRef, useEffect, memo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { useWritingStore, useContentStore } from '@/store'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

export const ChapterSwitcher = memo(function ChapterSwitcher() {
  const { chapters } = useContentStore()
  const { currentChapterId, setCurrentChapter } = useWritingStore()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 })

  const currentChapter = chapters.find((c) => c.id === currentChapterId)
  const currentIndex = chapters.findIndex((c) => c.id === currentChapterId)

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentChapter(chapters[currentIndex - 1].id)
    }
  }, [currentIndex, chapters, setCurrentChapter])

  const goToNext = useCallback(() => {
    if (currentIndex < chapters.length - 1) {
      setCurrentChapter(chapters[currentIndex + 1].id)
    }
  }, [currentIndex, chapters, setCurrentChapter])

  // Global shortcut: Ctrl+Shift+Up/Down
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          goToPrev()
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          goToNext()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [goToPrev, goToNext])

  // Position dropdown
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        left: Math.max(8, rect.left),
        width: Math.max(rect.width, 220),
      })
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (chapters.length === 0) return null

  return (
    <>
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 max-w-[200px]"
        style={{
          color: 'var(--text-primary)',
          background: open
            ? 'var(--color-surface-raised)'
            : 'color-mix(in srgb, var(--color-surface-raised) 60%, transparent)',
          border: open
            ? '1px solid var(--border-default)'
            : '1px solid color-mix(in srgb, var(--border-subtle) 30%, transparent)',
        }}
        title="章节切换 (Ctrl+Shift+Up/Down)"
      >
        <Icon icon={FileText} size="xs" />
        <span className="truncate">
          {currentChapter?.title || '未选择章节'}
        </span>
        <Icon icon={open ? ChevronUp : ChevronDown} size="xs" />
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
              className="fixed z-[9999] rounded-xl overflow-hidden shadow-xl"
              style={{
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                maxHeight: 320,
                background: 'var(--color-surface)',
                border: '1px solid var(--border-default)',
              }}
            >
              {/* Prev/Next quick actions */}
              <div className="flex items-center justify-between px-2 py-1 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                  disabled={currentIndex <= 0}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-30"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Icon icon={ChevronUp} size="xs" /> 上一章
                </button>
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                  {currentIndex + 1} / {chapters.length}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNext(); }}
                  disabled={currentIndex >= chapters.length - 1}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-30"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  下一章 <Icon icon={ChevronDown} size="xs" />
                </button>
              </div>

              {/* Chapter list */}
              <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                {chapters.map((chapter, idx) => (
                  <button
                    key={chapter.id}
                    onClick={() => {
                      setCurrentChapter(chapter.id)
                      setOpen(false)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors"
                    style={{
                      color: chapter.id === currentChapterId
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)',
                      background: chapter.id === currentChapterId
                        ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)'
                        : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (chapter.id !== currentChapterId) {
                        (e.currentTarget as HTMLElement).style.background =
                          'var(--color-surface-hover)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        chapter.id === currentChapterId
                          ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)'
                          : 'transparent'
                    }}
                  >
                    <span className="flex-shrink-0 w-5 text-right tabular-nums"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate flex-1">{chapter.title || `第${idx + 1}章`}</span>
                    {chapter.word_count != null && chapter.word_count > 0 && (
                      <span className="flex-shrink-0 text-[10px] tabular-nums"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {chapter.word_count}字
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
})

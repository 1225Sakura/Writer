import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useContentStore } from '@/store'
import { chapterApi } from '@/api/writing'
import { showOperationError } from '@/utils/toastHelper'
import { ChapterCard, ChapterCardOverlay } from './ChapterCard'
import { CorkboardToolbar, type SortMode } from './CorkboardToolbar'
import { STAGGER_CONTAINER, STAGGER_ITEM } from '@/components/shared/AnimationConfig'
import type { Chapter, ChapterStatus } from '@/shared/types'

/* ---- Component ---- */

export function CorkboardView() {
  const chapters = useContentStore((s) => s.chapters)
  const createChapter = useContentStore((s) => s.createChapter)
  const setChapters = useContentStore((s) => s.setChapters)

  const [activeId, setActiveId] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('order')
  const [filterStatus, setFilterStatus] = useState<ChapterStatus | 'all'>('all')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  /* ---- Filter + sort ---- */

  const filteredChapters = useMemo(() => {
    let result = [...chapters]

    // Filter
    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus)
    }

    // Sort
    switch (sortMode) {
      case 'order':
        result.sort((a, b) => a.chapter_order - b.chapter_order)
        break
      case 'title':
        result.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh'))
        break
      case 'wordCount':
        result.sort((a, b) => b.word_count - a.word_count)
        break
      case 'status': {
        const statusOrder: Record<ChapterStatus, number> = {
          writing: 0, planning: 1, pending: 2, review: 3, completed: 4, archived: 5,
        }
        result.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
        break
      }
    }

    return result
  }, [chapters, sortMode, filterStatus])

  const activeChapter = useMemo(
    () => (activeId != null ? chapters.find((c) => c.id === activeId) : undefined),
    [activeId, chapters],
  )

  const sortableIds = useMemo(
    () => filteredChapters.map((c) => c.id),
    [filteredChapters],
  )

  /* ---- DnD handlers ---- */

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as number)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const oldIndex = filteredChapters.findIndex((c) => c.id === active.id)
    const newIndex = filteredChapters.findIndex((c) => c.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Reorder in the full chapter list
    const reordered = arrayMove(filteredChapters, oldIndex, newIndex)

    // Update chapter_order for all affected chapters
    const updates: Chapter[] = reordered.map((ch, idx) => ({
      ...ch,
      chapter_order: idx,
    }))

    // Merge back into the full chapters array
    const fullUpdated = chapters.map((ch) => {
      const match = updates.find((u) => u.id === ch.id)
      return match ?? ch
    })

    // Optimistic update
    setChapters(fullUpdated)

    // Persist to backend
    try {
      await Promise.all(
        updates.map((ch) =>
          chapterApi.update(ch.id, { chapter_order: ch.chapter_order })
        )
      )
    } catch (error) {
      showOperationError('保存章节顺序', error)
      // Revert on failure
      setChapters(chapters)
    }
  }, [filteredChapters, chapters, setChapters])

  /* ---- Create chapter ---- */

  const handleCreateChapter = useCallback(async () => {
    try {
      await createChapter({
        title: `第 ${chapters.length + 1} 章`,
        chapter_order: chapters.length,
        status: 'planning',
      })
    } catch {
      // error already handled in store
    }
  }, [chapters.length, createChapter])

  /* ---- Click handler ---- */

  const handleCardClick = useCallback((_chapterId: number) => {
    // Future: navigate to chapter in writing editor
  }, [])

  /* ---- Render ---- */

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--color-surface-base)]">
      <CorkboardToolbar
        chapterCount={filteredChapters.length}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        onCreateChapter={handleCreateChapter}
      />

      <div className="flex-1 overflow-y-auto scrollbar-ink p-4">
        {filteredChapters.length === 0 ? (
          <EmptyState filterStatus={filterStatus} onCreateChapter={handleCreateChapter} />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
              <motion.div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                }}
                variants={STAGGER_CONTAINER}
                initial="hidden"
                animate="visible"
              >
                <AnimatePresence initial={false}>
                  {filteredChapters.map((chapter) => (
                    <motion.div
                      key={chapter.id}
                      layout
                      variants={STAGGER_ITEM}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <ChapterCard
                        chapter={chapter}
                        onClick={handleCardClick}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeChapter ? (
                <ChapterCardOverlay chapter={activeChapter} />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}

/* ---- Empty state ---- */

function EmptyState({
  filterStatus,
  onCreateChapter,
}: {
  filterStatus: ChapterStatus | 'all'
  onCreateChapter: () => void
}) {
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

import { useState, useMemo, useCallback, useCallback as _ucb } from 'react'
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
import { Grid } from 'react-window'
import { useContentStore, useWritingStore, useUIStore } from '@/store'
import { chapterApi } from '@/api/writing'
import { showOperationError } from '@/utils/toastHelper'
import { ChapterCardOverlay } from './ChapterCard'
import { CorkboardToolbar, type SortMode } from './CorkboardToolbar'
import { STAGGER_CONTAINER } from '@/components/shared/AnimationConfig'
import { useContainerSize } from './useContainerSize'
import { CorkboardCell } from './CorkboardCell'
import { CorkboardEmptyState } from './CorkboardEmptyState'
import {
  CARD_HEIGHT,
  CARD_MIN_WIDTH,
  GRID_GAP,
  OVERSCAN_ROWS,
  computeColumnCount,
} from './corkboardConstants'
import type { Chapter, ChapterStatus } from '@/shared/types'

/* ---- Component ---- */

export function CorkboardView() {
  const chapters = useContentStore((s) => s.chapters)
  const createChapter = useContentStore((s) => s.createChapter)
  const setChapters = useContentStore((s) => s.setChapters)

  // v0.5 Phase 3 Track C: card click now navigates into the writing
  // editor focused on the chosen chapter (no longer a no-op stub).
  const setCurrentChapter = useWritingStore((s) => s.setCurrentChapter)
  const setCurrentInterface = useUIStore((s) => s.setCurrentInterface)

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
    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus)
    }
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

  /* ---- Container sizing for virtualization ---- */

  const { ref: containerRef, size: containerSize } = useContainerSize<HTMLDivElement>()

  const columnCount = useMemo(
    () => computeColumnCount(containerSize.width),
    [containerSize.width],
  )
  const rowCount = useMemo(
    () => Math.ceil(filteredChapters.length / columnCount),
    [filteredChapters.length, columnCount],
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

    const reordered = arrayMove(filteredChapters, oldIndex, newIndex)
    const updates: Chapter[] = reordered.map((ch, idx) => ({ ...ch, chapter_order: idx }))
    const fullUpdated = chapters.map((ch) => {
      const match = updates.find((u) => u.id === ch.id)
      return match ?? ch
    })

    setChapters(fullUpdated)
    try {
      await Promise.all(
        updates.map((ch) => chapterApi.update(ch.id, { chapter_order: ch.chapter_order })),
      )
    } catch (error) {
      showOperationError('保存章节顺序', error)
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
      // store already surfaces the toast
    }
  }, [chapters.length, createChapter])

  /* ---- Click handler (v0.5 Phase 3 Track C) ---- */

  const handleCardClick = useCallback((chapterId: number) => {
    setCurrentChapter(chapterId)
    setCurrentInterface('writing')
    if (typeof window !== 'undefined') {
      const anchor = document.querySelector<HTMLElement>(
        `[data-chapter-anchor="${chapterId}"]`,
      )
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [setCurrentChapter, setCurrentInterface])

  /* ---- Cell renderer (memoized) ---- */

  const Cell = useCallback(
    ({
      rowIndex,
      columnIndex,
      style,
    }: {
      rowIndex: number
      columnIndex: number
      style: React.CSSProperties
    }) => (
      <CorkboardCell
        rowIndex={rowIndex}
        columnIndex={columnIndex}
        columnCount={columnCount}
        chapters={filteredChapters}
        onClick={handleCardClick}
        style={style}
      />
    ),
    [filteredChapters, columnCount, handleCardClick],
  )

  /* ---- Render ---- */

  const gridWidth = Math.max(0, containerSize.width)
  const cellWidth = columnCount > 0
    ? Math.max(CARD_MIN_WIDTH, Math.floor((gridWidth - GRID_GAP * (columnCount - 1)) / columnCount))
    : CARD_MIN_WIDTH
  const cellHeight = CARD_HEIGHT + GRID_GAP

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

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden scrollbar-ink p-4"
        data-testid="corkboard-container"
      >
        {filteredChapters.length === 0 ? (
          <CorkboardEmptyState
            filterStatus={filterStatus}
            onCreateChapter={handleCreateChapter}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
              <AnimatePresence initial={false}>
                <motion.div
                  variants={STAGGER_CONTAINER}
                  initial="hidden"
                  animate="visible"
                  style={{ width: '100%', height: '100%' }}
                >
                  <Grid<{ rowIndex: number; columnIndex: number; style: React.CSSProperties }>
                    cellComponent={Cell as never}
                    cellProps={{} as never}
                    columnCount={columnCount}
                    rowCount={rowCount}
                    columnWidth={cellWidth}
                    rowHeight={cellHeight}
                    overscanCount={OVERSCAN_ROWS}
                    style={{ width: '100%', height: '100%' }}
                  />
                </motion.div>
              </AnimatePresence>
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeChapter ? <ChapterCardOverlay chapter={activeChapter} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}

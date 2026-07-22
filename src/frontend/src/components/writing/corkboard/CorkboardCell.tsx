/**
 * CorkboardCell — single-cell renderer for react-window Grid.
 *
 * v0.5 Phase 3 Track E.5: extracted from CorkboardView to keep the
 * main component under the 300-line per-file budget (AC-1).
 *
 * Maps a (rowIndex, columnIndex) cell into the underlying chapter from
 * a flat array using row-major addressing:
 *   flatIndex = rowIndex * columnCount + columnIndex
 * Cells beyond the last chapter (the last row may be partial) return
 * null so react-window leaves them empty.
 */
import { memo } from 'react'
import { ChapterCard } from './ChapterCard'
import { GRID_GAP } from './corkboardConstants'
import type { Chapter } from '@/shared/types'

export interface CorkboardCellProps {
  rowIndex: number
  columnIndex: number
  columnCount: number
  chapters: ReadonlyArray<Chapter>
  onClick: (chapterId: number) => void
  style: React.CSSProperties
}

export const CorkboardCell = memo(function CorkboardCell({
  rowIndex,
  columnIndex,
  columnCount,
  chapters,
  onClick,
  style,
}: CorkboardCellProps) {
  const flatIndex = rowIndex * columnCount + columnIndex
  const chapter = chapters[flatIndex]
  if (!chapter) return null
  return (
    <div style={{ ...style, padding: `${GRID_GAP / 2}px` }}>
      <ChapterCard chapter={chapter} onClick={onClick} />
    </div>
  )
})

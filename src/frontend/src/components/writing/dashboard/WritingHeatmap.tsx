/**
 * WritingHeatmap — github-style daily writing activity heatmap.
 *
 * Phase 0b.2 merge: consolidated from src/components/writing/WritingHeatmap.tsx
 * (218 lines) into dashboard/WritingHeatmap.tsx (was a 2-line re-export shim).
 * All call-sites already imported the dashboard/ path, so the legacy file is
 * removed (see commit history).
 */
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

export interface HeatmapDay {
  date: string
  wordCount: number
}

interface WritingHeatmapProps {
  days: HeatmapDay[]
  range: 30 | 90 | 365
}

function getIntensityLevel(wordCount: number): 0 | 1 | 2 | 3 | 4 {
  if (wordCount === 0) return 0
  if (wordCount <= 500) return 1
  if (wordCount <= 1000) return 2
  if (wordCount <= 2000) return 3
  return 4
}

const INTENSITY_COLORS: Record<number, string> = {
  0: 'color-mix(in srgb, var(--paper-100) 3%, transparent)',
  1: 'color-mix(in srgb, var(--paper-100) 12%, transparent)',
  2: 'color-mix(in srgb, var(--color-location) 30%, transparent)',
  3: 'color-mix(in srgb, var(--color-location) 55%, transparent)',
  4: 'color-mix(in srgb, var(--color-location) 85%, transparent)',
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function WritingHeatmap({ days, range }: WritingHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const grid = useMemo(() => {
    const dayMap = new Map<string, number>()
    for (const d of days) {
      dayMap.set(d.date, d.wordCount)
    }
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - range + 1)
    const dayOfWeek = startDate.getDay()
    startDate.setDate(startDate.getDate() - dayOfWeek)
    const cells: Array<{ date: string; wordCount: number; col: number; row: number }> = []
    const current = new Date(startDate)
    let col = 0
    let row = current.getDay()
    while (current <= today || row !== 0) {
      const dateStr = current.toISOString().split('T')[0]
      const wordCount = dayMap.get(dateStr) ?? 0
      cells.push({ date: dateStr, wordCount, col, row })
      row++
      if (row > 6) { row = 0; col++ }
      current.setDate(current.getDate() + 1)
      if (current > today && row === 0) break
    }
    return cells
  }, [days, range])

  const totalCols = useMemo(() => Math.max(...grid.map((c) => c.col), 0) + 1, [grid])
  const totalWords = useMemo(() => days.reduce((sum, d) => sum + d.wordCount, 0), [days])
  const activeDays = useMemo(() => days.filter((d) => d.wordCount > 0).length, [days])

  const cellSize = 11
  const cellGap = 2
  const labelWidth = 18
  const svgWidth = labelWidth + totalCols * (cellSize + cellGap)
  const svgHeight = 7 * (cellSize + cellGap)

  const handleMouseEnter = (day: HeatmapDay, e: React.MouseEvent) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect()
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
    setHoveredDay(day)
  }

  return (
    <div className="px-3 py-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {activeDays}天写作，共{totalWords >= 10000
            ? `${(totalWords / 10000).toFixed(1)}万字`
            : `${totalWords}字`}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {range === 30 ? '近30天' : range === 90 ? '近90天' : '近一年'}
        </span>
      </div>
      <div className="relative overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          className="block"
          style={{ minWidth: svgWidth }}
        >
          {WEEKDAY_LABELS.map((label, i) =>
            i % 2 === 1 ? (
              <text
                key={label}
                x={0}
                y={i * (cellSize + cellGap) + cellSize - 1}
                fontSize="9"
                fill="var(--text-muted)"
                textAnchor="start"
              >
                {label}
              </text>
            ) : null,
          )}
          {grid.map((cell) => {
            const level = getIntensityLevel(cell.wordCount)
            const x = labelWidth + cell.col * (cellSize + cellGap)
            const y = cell.row * (cellSize + cellGap)
            return (
              <rect
                key={cell.date}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                ry={2}
                fill={INTENSITY_COLORS[level]}
                stroke="color-mix(in srgb, var(--paper-100) 4%, transparent)"
                strokeWidth={0.5}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => handleMouseEnter(cell, e)}
                onMouseLeave={() => setHoveredDay(null)}
              />
            )
          })}
        </svg>
      </div>
      <div className="flex items-center justify-end gap-1">
        <span className="text-[9px] mr-1" style={{ color: 'var(--text-muted)' }}>少</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="rounded-sm"
            style={{
              width: 9,
              height: 9,
              backgroundColor: INTENSITY_COLORS[level],
              border: '0.5px solid color-mix(in srgb, var(--paper-100) 4%, transparent)',
            }}
          />
        ))}
        <span className="text-[9px] ml-1" style={{ color: 'var(--text-muted)' }}>多</span>
      </div>
      <AnimatePresence>
        {hoveredDay && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            className="fixed z-[9999] pointer-events-none px-2.5 py-1.5 rounded-lg"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translate(-50%, -100%)',
              background: 'color-mix(in srgb, var(--ink-100) 95%, transparent)',
              border: '1px solid color-mix(in srgb, var(--paper-100) 10%, transparent)',
              boxShadow: '0 4px 12px color-mix(in srgb, var(--ink-100) 30%, transparent)',
            }}
          >
            <div className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
              {formatDate(hoveredDay.date)}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {hoveredDay.wordCount > 0 ? `${hoveredDay.wordCount}字` : '未写作'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export type { WritingHeatmapProps }
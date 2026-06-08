import { useMemo, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from 'diff-match-patch'
import type { Diff } from 'diff-match-patch'
import { Plus, Minus, Pencil, AlignLeft } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

/* ============================================================
   TYPES
   ============================================================ */

export interface DiffLine {
  type: 'equal' | 'added' | 'removed' | 'modified'
  leftLineNum: number | null
  rightLineNum: number | null
  leftText: string
  rightText: string
  /** Unique index for accept/reject tracking */
  index: number
}

export interface DiffChunk {
  type: 'added' | 'removed' | 'modified'
  lines: DiffLine[]
  startIndex: number
}

interface DiffViewerProps {
  original: string
  generated: string
  /** Called when lines are accepted. Returns the merged result text. */
  onAcceptLines?: (lines: DiffLine[]) => void
  /** Show accept/reject controls per chunk */
  showPartialControls?: boolean
  /** Accepted line indices (controlled mode) */
  acceptedIndices?: Set<number>
  /** Rejected line indices (controlled mode) */
  rejectedIndices?: Set<number>
  /** Toggle a single line's acceptance */
  onToggleLine?: (index: number) => void
  /** Accept all non-equal lines */
  onAcceptAll?: () => void
  /** Reject all non-equal lines */
  onRejectAll?: () => void
  className?: string
}

/* ============================================================
   DIFF COMPUTATION
   ============================================================ */

function computeLineDiffs(oldText: string, newText: string): DiffLine[] {
  const dmp = new diff_match_patch()
  const lineDiffs: Diff[] = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(lineDiffs)

  const result: DiffLine[] = []
  let leftNum = 1
  let rightNum = 1
  let idx = 0

  const leftLines: { text: string; type: 'equal' | 'removed' }[] = []
  const rightLines: { text: string; type: 'equal' | 'added' }[] = []

  for (const [op, text] of lineDiffs) {
    const lines = text.split('\n')
    const actualLines = text.endsWith('\n') ? lines.slice(0, -1) : lines

    for (const line of actualLines) {
      if (op === DIFF_EQUAL) {
        leftLines.push({ text: line, type: 'equal' })
        rightLines.push({ text: line, type: 'equal' })
      } else if (op === DIFF_DELETE) {
        leftLines.push({ text: line, type: 'removed' })
      } else if (op === DIFF_INSERT) {
        rightLines.push({ text: line, type: 'added' })
      }
    }
  }

  let li = 0
  let ri = 0

  while (li < leftLines.length || ri < rightLines.length) {
    const left = leftLines[li]
    const right = rightLines[ri]

    if (
      left &&
      right &&
      left.type === 'equal' &&
      right.type === 'equal' &&
      left.text === right.text
    ) {
      result.push({
        type: 'equal',
        leftLineNum: leftNum++,
        rightLineNum: rightNum++,
        leftText: left.text,
        rightText: right.text,
        index: idx++,
      })
      li++
      ri++
    } else if (left && left.type === 'removed' && right && right.type === 'added') {
      result.push({
        type: 'modified',
        leftLineNum: leftNum++,
        rightLineNum: rightNum++,
        leftText: left.text,
        rightText: right.text,
        index: idx++,
      })
      li++
      ri++
    } else if (left && left.type === 'removed') {
      result.push({
        type: 'removed',
        leftLineNum: leftNum++,
        rightLineNum: null,
        leftText: left.text,
        rightText: '',
        index: idx++,
      })
      li++
    } else if (right && right.type === 'added') {
      result.push({
        type: 'added',
        leftLineNum: null,
        rightLineNum: rightNum++,
        leftText: '',
        rightText: right.text,
        index: idx++,
      })
      ri++
    } else {
      if (li < leftLines.length) li++
      if (ri < rightLines.length) ri++
      if (li >= leftLines.length && ri >= rightLines.length) break
    }
  }

  return result
}

/** Group consecutive non-equal lines into chunks for bulk accept/reject */
function groupDiffChunks(diffLines: DiffLine[]): DiffChunk[] {
  const chunks: DiffChunk[] = []
  let current: DiffChunk | null = null

  for (const line of diffLines) {
    if (line.type === 'equal') {
      current = null
      continue
    }
    if (!current || current.type !== line.type) {
      current = { type: line.type as DiffChunk['type'], lines: [line], startIndex: line.index }
      chunks.push(current)
    } else {
      current.lines.push(line)
    }
  }

  return chunks
}

/* ============================================================
   LINE STYLE MAP
   ============================================================ */

const LINE_STYLES = {
  equal: {
    leftBg: 'transparent',
    rightBg: 'transparent',
    leftNumBg: 'transparent',
    rightNumBg: 'transparent',
    textColor: 'var(--text-primary)',
  },
  added: {
    leftBg: 'transparent',
    rightBg: 'color-mix(in srgb, var(--color-ifline) 10%, transparent)',
    leftNumBg: 'transparent',
    rightNumBg: 'color-mix(in srgb, var(--color-ifline) 15%, transparent)',
    textColor: 'var(--color-ifline)',
  },
  removed: {
    leftBg: 'color-mix(in srgb, var(--color-vermillion) 8%, transparent)',
    rightBg: 'transparent',
    leftNumBg: 'color-mix(in srgb, var(--color-vermillion) 12%, transparent)',
    rightNumBg: 'transparent',
    textColor: 'var(--color-vermillion)',
  },
  modified: {
    leftBg: 'color-mix(in srgb, var(--color-character) 8%, transparent)',
    rightBg: 'color-mix(in srgb, var(--color-character) 8%, transparent)',
    leftNumBg: 'color-mix(in srgb, var(--color-character) 12%, transparent)',
    rightNumBg: 'color-mix(in srgb, var(--color-character) 12%, transparent)',
    textColor: 'var(--color-character)',
  },
} as const

/* ============================================================
   ICON MAP
   ============================================================ */

const TYPE_ICON = {
  added: Plus,
  removed: Minus,
  modified: Pencil,
  equal: AlignLeft,
} as const

const TYPE_COLOR = {
  added: 'var(--color-ifline)',
  removed: 'var(--color-vermillion)',
  modified: 'var(--color-character)',
  equal: 'var(--text-tertiary)',
} as const

/* ============================================================
   COMPONENT
   ============================================================ */

export function DiffViewer({
  original,
  generated,
  showPartialControls = false,
  acceptedIndices,
  rejectedIndices,
  onToggleLine,
  onAcceptAll,
  onRejectAll,
  className,
}: DiffViewerProps) {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  const diffLines = useMemo(
    () => computeLineDiffs(original, generated),
    [original, generated]
  )

  const chunks = useMemo(() => groupDiffChunks(diffLines), [diffLines])

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    let modified = 0
    for (const line of diffLines) {
      if (line.type === 'added') added++
      else if (line.type === 'removed') removed++
      else if (line.type === 'modified') modified++
    }
    return { added, removed, modified }
  }, [diffLines])

  /* Synchronized scrolling */
  const handleLeftScroll = useCallback(() => {
    if (syncingRef.current) return
    syncingRef.current = true
    if (rightRef.current && leftRef.current) {
      rightRef.current.scrollTop = leftRef.current.scrollTop
    }
    requestAnimationFrame(() => {
      syncingRef.current = false
    })
  }, [])

  const handleRightScroll = useCallback(() => {
    if (syncingRef.current) return
    syncingRef.current = true
    if (leftRef.current && rightRef.current) {
      leftRef.current.scrollTop = rightRef.current.scrollTop
    }
    requestAnimationFrame(() => {
      syncingRef.current = false
    })
  }, [])

  /* Keep scroll position in sync when diff changes */
  useEffect(() => {
    if (leftRef.current) leftRef.current.scrollTop = 0
    if (rightRef.current) rightRef.current.scrollTop = 0
  }, [original, generated])

  const hasDiffs = stats.added + stats.removed + stats.modified > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
      className={className}
    >
      {/* Stats bar */}
      {hasDiffs && (
        <div
          className="flex items-center gap-3 px-3 py-1.5 text-[11px] rounded-t-xl"
          style={{
            color: 'var(--text-tertiary)',
            background: 'var(--color-surface-raised)',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <span className="flex items-center gap-1">
            <Plus className="w-3 h-3" style={{ color: 'var(--color-ifline)' }} />
            <span style={{ color: 'var(--color-ifline)' }}>{stats.added}</span>
            新增
          </span>
          <span className="flex items-center gap-1">
            <Minus className="w-3 h-3" style={{ color: 'var(--color-vermillion)' }} />
            <span style={{ color: 'var(--color-vermillion)' }}>{stats.removed}</span>
            删除
          </span>
          <span className="flex items-center gap-1">
            <Pencil className="w-3 h-3" style={{ color: 'var(--color-character)' }} />
            <span style={{ color: 'var(--color-character)' }}>{stats.modified}</span>
            修改
          </span>

          {/* Bulk controls */}
          {showPartialControls && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={onAcceptAll}
                className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                style={{
                  background: 'color-mix(in srgb, var(--color-ifline) 15%, transparent)',
                  color: 'var(--color-ifline)',
                  border: '1px solid color-mix(in srgb, var(--color-ifline) 25%, transparent)',
                }}
              >
                全部接受
              </button>
              <button
                onClick={onRejectAll}
                className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                style={{
                  background: 'color-mix(in srgb, var(--color-vermillion) 12%, transparent)',
                  color: 'var(--color-vermillion)',
                  border: '1px solid color-mix(in srgb, var(--color-vermillion) 25%, transparent)',
                }}
              >
                全部拒绝
              </button>
            </div>
          )}
        </div>
      )}

      {/* Diff content — side by side */}
      <div
        className="flex rounded-b-xl overflow-hidden"
        style={{
          border: '1px solid var(--border-default)',
          borderTop: hasDiffs ? 'none' : undefined,
          height: '100%',
          minHeight: 200,
        }}
      >
        {/* Left panel — Original */}
        <div className="flex-1 flex flex-col min-w-0" style={{ borderRight: '1px solid var(--border-default)' }}>
          <div
            className="px-3 py-1.5 text-[11px] font-medium sticky top-0 z-10"
            style={{
              color: 'var(--text-tertiary)',
              background: 'var(--color-surface-raised)',
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            原文
          </div>
          <div
            ref={leftRef}
            onScroll={handleLeftScroll}
            className="flex-1 overflow-auto font-mono text-xs leading-relaxed"
          >
            {diffLines.map((line) => {
              const styles = LINE_STYLES[line.type]
              return (
                <div
                  key={line.index}
                  className="flex"
                  style={{ background: styles.leftBg }}
                >
                  <div
                    className="w-9 flex-shrink-0 text-right pr-1.5 py-0.5 select-none"
                    style={{
                      color: 'var(--text-tertiary)',
                      background: styles.leftNumBg,
                      borderRight: '1px solid var(--border-default)',
                      opacity: 0.6,
                    }}
                  >
                    {line.leftLineNum ?? ''}
                  </div>
                  <pre
                    className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-all m-0"
                    style={{
                      color: line.type === 'removed' ? styles.textColor : 'var(--text-primary)',
                    }}
                  >
                    {line.type === 'removed' && (
                      <span className="opacity-40 mr-0.5">-</span>
                    )}
                    {line.leftText || ' '}
                  </pre>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel — Generated */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            className="px-3 py-1.5 text-[11px] font-medium sticky top-0 z-10"
            style={{
              color: 'var(--text-tertiary)',
              background: 'var(--color-surface-raised)',
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            AI 生成
          </div>
          <div
            ref={rightRef}
            onScroll={handleRightScroll}
            className="flex-1 overflow-auto font-mono text-xs leading-relaxed"
          >
            {diffLines.map((line) => {
              const styles = LINE_STYLES[line.type]
              const isAccepted = acceptedIndices?.has(line.index)
              const isRejected = rejectedIndices?.has(line.index)

              return (
                <div
                  key={line.index}
                  className="flex group relative"
                  style={{
                    background: styles.rightBg,
                    opacity: isRejected ? 0.4 : 1,
                    textDecoration: isRejected ? 'line-through' : undefined,
                  }}
                >
                  <div
                    className="w-9 flex-shrink-0 text-right pr-1.5 py-0.5 select-none"
                    style={{
                      color: 'var(--text-tertiary)',
                      background: styles.rightNumBg,
                      borderRight: '1px solid var(--border-default)',
                      opacity: 0.6,
                    }}
                  >
                    {line.rightLineNum ?? ''}
                  </div>
                  <pre
                    className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-all m-0"
                    style={{
                      color: line.type === 'added' ? styles.textColor : 'var(--text-primary)',
                    }}
                  >
                    {line.type === 'added' && (
                      <span className="opacity-40 mr-0.5">+</span>
                    )}
                    {line.rightText || ' '}
                  </pre>

                  {/* Per-line accept/reject toggle */}
                  {showPartialControls && line.type !== 'equal' && onToggleLine && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onToggleLine(line.index)}
                      className="absolute right-1 top-0.5 w-5 h-5 rounded flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                      style={{
                        background: isAccepted
                          ? 'color-mix(in srgb, var(--color-ifline) 20%, transparent)'
                          : isRejected
                            ? 'color-mix(in srgb, var(--color-vermillion) 15%, transparent)'
                            : 'var(--color-surface-overlay)',
                        border: `1px solid ${
                          isAccepted
                            ? 'color-mix(in srgb, var(--color-ifline) 35%, transparent)'
                            : isRejected
                              ? 'color-mix(in srgb, var(--color-vermillion) 30%, transparent)'
                              : 'var(--border-default)'
                        }`,
                        color: isAccepted
                          ? 'var(--color-ifline)'
                          : isRejected
                            ? 'var(--color-vermillion)'
                            : 'var(--text-tertiary)',
                      }}
                      title={isAccepted ? '点击取消接受' : isRejected ? '点击取消拒绝' : '点击接受此行'}
                    >
                      {(() => {
                        const Icon = TYPE_ICON[line.type]
                        return <Icon className="w-3 h-3" />
                      })()}
                    </motion.button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Chunk-level controls */}
      {showPartialControls && chunks.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {chunks.map((chunk, ci) => {
            const Icon = TYPE_ICON[chunk.type]
            const color = TYPE_COLOR[chunk.type]
            const label =
              chunk.type === 'added'
                ? `${chunk.lines.length} 行新增`
                : chunk.type === 'removed'
                  ? `${chunk.lines.length} 行删除`
                  : `${chunk.lines.length} 行修改`

            return (
              <motion.div
                key={ci}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: ci * 0.04, duration: DURATION.FAST, ease: EASE.SMOOTH }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                <span className="text-[11px] flex-1" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </span>
                <button
                  onClick={() => chunk.lines.forEach((l) => onToggleLine?.(l.index))}
                  className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                  style={{
                    background: 'color-mix(in srgb, var(--color-ifline) 12%, transparent)',
                    color: 'var(--color-ifline)',
                    border: '1px solid color-mix(in srgb, var(--color-ifline) 20%, transparent)',
                  }}
                >
                  接受
                </button>
                <button
                  onClick={() => {
                    chunk.lines.forEach((l) => {
                      if (!rejectedIndices?.has(l.index)) onToggleLine?.(l.index)
                    })
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                  style={{
                    background: 'color-mix(in srgb, var(--color-vermillion) 10%, transparent)',
                    color: 'var(--color-vermillion)',
                    border: '1px solid color-mix(in srgb, var(--color-vermillion) 20%, transparent)',
                  }}
                >
                  拒绝
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!hasDiffs && (
        <div
          className="flex items-center justify-center py-10 rounded-xl"
          style={{ border: '1px solid var(--border-default)' }}
        >
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            内容完全相同
          </span>
        </div>
      )}
    </motion.div>
  )
}

/* ============================================================
   EXPORTED HELPERS
   ============================================================ */

export { computeLineDiffs, groupDiffChunks }

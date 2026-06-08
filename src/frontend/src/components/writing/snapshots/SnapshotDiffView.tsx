import { useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, RotateCcw, Plus, Minus, Pencil } from 'lucide-react'
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from 'diff-match-patch'
import type { Diff } from 'diff-match-patch'
import type { ChapterSnapshot } from '@/api/types'
import { EASE, DURATION } from '@/components/shared/AnimationConfig'

interface SnapshotDiffViewProps {
  snapshot: ChapterSnapshot
  currentContent: string
  secondSnapshot?: ChapterSnapshot
  onBack: () => void
  onRollback: (snapshot: ChapterSnapshot) => void
}

interface DiffLine {
  type: 'equal' | 'added' | 'removed' | 'modified'
  leftLineNum: number | null
  rightLineNum: number | null
  leftText: string
  rightText: string
}

function computeLineDiffs(oldText: string, newText: string): DiffLine[] {
  const dmp = new diff_match_patch()
  const lineDiffs: Diff[] = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(lineDiffs)

  const result: DiffLine[] = []
  let leftNum = 1
  let rightNum = 1

  // Collect lines from diffs
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

  // Align the two sides
  let li = 0
  let ri = 0

  while (li < leftLines.length || ri < rightLines.length) {
    const left = leftLines[li]
    const right = rightLines[ri]

    if (left && right && left.type === 'equal' && right.type === 'equal' && left.text === right.text) {
      result.push({
        type: 'equal',
        leftLineNum: leftNum++,
        rightLineNum: rightNum++,
        leftText: left.text,
        rightText: right.text,
      })
      li++
      ri++
    } else if (left && left.type === 'removed' && right && right.type === 'added') {
      // Modified line — show both
      result.push({
        type: 'modified',
        leftLineNum: leftNum++,
        rightLineNum: rightNum++,
        leftText: left.text,
        rightText: right.text,
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
      })
      li++
    } else if (right && right.type === 'added') {
      result.push({
        type: 'added',
        leftLineNum: null,
        rightLineNum: rightNum++,
        leftText: '',
        rightText: right.text,
      })
      ri++
    } else {
      // Fallback — advance whichever is available
      if (li < leftLines.length) li++
      if (ri < rightLines.length) ri++
      if (li >= leftLines.length && ri >= rightLines.length) break
    }
  }

  return result
}

const LINE_STYLES = {
  equal: {
    leftBg: 'transparent',
    rightBg: 'transparent',
    leftNumBg: 'transparent',
    rightNumBg: 'transparent',
  },
  added: {
    leftBg: 'transparent',
    rightBg: 'color-mix(in srgb, var(--color-ifline) 12%, transparent)',
    leftNumBg: 'transparent',
    rightNumBg: 'color-mix(in srgb, var(--color-ifline) 15%, transparent)',
  },
  removed: {
    leftBg: 'color-mix(in srgb, var(--color-vermillion) 10%, transparent)',
    rightBg: 'transparent',
    leftNumBg: 'color-mix(in srgb, var(--color-vermillion) 12%, transparent)',
    rightNumBg: 'transparent',
  },
  modified: {
    leftBg: 'color-mix(in srgb, var(--color-character) 10%, transparent)',
    rightBg: 'color-mix(in srgb, var(--color-character) 10%, transparent)',
    leftNumBg: 'color-mix(in srgb, var(--color-character) 12%, transparent)',
    rightNumBg: 'color-mix(in srgb, var(--color-character) 12%, transparent)',
  },
}

export function SnapshotDiffView({
  snapshot,
  currentContent,
  secondSnapshot,
  onBack,
  onRollback: _onRollback,
}: SnapshotDiffViewProps) {
  const oldContent = secondSnapshot ? secondSnapshot.content : currentContent
  const newContent = snapshot.content

  const diffLines = useMemo(
    () => computeLineDiffs(oldContent, newContent),
    [oldContent, newContent]
  )

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

  const handleRollback = useCallback(() => {
    _onRollback(snapshot)
    onBack()
  }, [snapshot, _onRollback, onBack])

  const leftLabel = secondSnapshot
    ? `v${secondSnapshot.version_number}`
    : '当前内容'
  const rightLabel = `v${snapshot.version_number}`

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <div>
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              版本对比
            </span>
            <div className="text-[10px] leading-tight" style={{ color: 'var(--text-tertiary)' }}>
              {leftLabel} → {rightLabel}
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRollback}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={{
            background: 'color-mix(in srgb, var(--color-ifline) 15%, transparent)',
            color: 'var(--color-ifline)',
            border: '1px solid color-mix(in srgb, var(--color-ifline) 30%, transparent)',
          }}
          title="回退到此版本"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          回退
        </motion.button>
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-3 px-4 py-1.5 text-[11px] border-b border-[var(--border-default)]"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <span className="flex items-center gap-1">
          <Plus className="w-3 h-3" style={{ color: 'var(--color-ifline)' }} />
          <span style={{ color: 'var(--color-ifline)' }}>{stats.added}</span> 新增
        </span>
        <span className="flex items-center gap-1">
          <Minus className="w-3 h-3" style={{ color: 'var(--color-vermillion)' }} />
          <span style={{ color: 'var(--color-vermillion)' }}>{stats.removed}</span> 删除
        </span>
        <span className="flex items-center gap-1">
          <Pencil className="w-3 h-3" style={{ color: 'var(--color-character)' }} />
          <span style={{ color: 'var(--color-character)' }}>{stats.modified}</span> 修改
        </span>
      </div>

      {/* Diff content - side by side */}
      <div className="flex-1 overflow-auto scrollbar-ink font-mono text-xs leading-relaxed">
        {/* Column headers */}
        <div
          className="flex sticky top-0 z-10 text-[11px] font-medium"
          style={{
            background: 'var(--color-surface-raised)',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <div
            className="flex-1 px-3 py-1.5"
            style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-default)' }}
          >
            {leftLabel}
          </div>
          <div className="flex-1 px-3 py-1.5" style={{ color: 'var(--text-tertiary)' }}>
            {rightLabel}
          </div>
        </div>

        {/* Diff lines */}
        {diffLines.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              内容完全相同
            </span>
          </div>
        ) : (
          diffLines.map((line, i) => {
            const styles = LINE_STYLES[line.type]
            return (
              <div key={i} className="flex">
                {/* Left side */}
                <div
                  className="flex flex-1 min-w-0"
                  style={{ background: styles.leftBg, borderRight: '1px solid var(--border-default)' }}
                >
                  <div
                    className="w-10 flex-shrink-0 text-right pr-2 py-0.5 select-none"
                    style={{
                      color: 'var(--text-tertiary)',
                      background: styles.leftNumBg,
                      borderRight: '1px solid var(--border-default)',
                      opacity: 0.7,
                    }}
                  >
                    {line.leftLineNum ?? ''}
                  </div>
                  <pre className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-all m-0" style={{ color: line.type === 'removed' ? 'var(--color-vermillion)' : 'var(--text-primary)' }}>
                    {line.type === 'removed' && <span className="opacity-50">-</span>}
                    {line.leftText || ' '}
                  </pre>
                </div>

                {/* Right side */}
                <div className="flex flex-1 min-w-0" style={{ background: styles.rightBg }}>
                  <div
                    className="w-10 flex-shrink-0 text-right pr-2 py-0.5 select-none"
                    style={{
                      color: 'var(--text-tertiary)',
                      background: styles.rightNumBg,
                      borderRight: '1px solid var(--border-default)',
                      opacity: 0.7,
                    }}
                  >
                    {line.rightLineNum ?? ''}
                  </div>
                  <pre className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-all m-0" style={{ color: line.type === 'added' ? 'var(--color-ifline)' : 'var(--text-primary)' }}>
                    {line.type === 'added' && <span className="opacity-50">+</span>}
                    {line.rightText || ' '}
                  </pre>
                </div>
              </div>
            )
          })
        )}
      </div>
    </motion.div>
  )
}

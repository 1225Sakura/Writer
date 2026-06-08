import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Check, X, CheckCheck, XCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { DiffViewer, computeLineDiffs } from './DiffViewer'
import type { DiffLine } from './DiffViewer'

/* ============================================================
   TYPES
   ============================================================ */

interface PartialAcceptProps {
  original: string
  generated: string
  qualityScore?: number
  onAccept: (mergedText: string) => void
  onReject: () => void
}

/* ============================================================
   MERGE LOGIC
   ============================================================ */

/**
 * Build the final text by accepting equal lines unconditionally,
 * and selectively including non-equal lines based on acceptedIndices.
 * - For 'added' lines: include only if accepted
 * - For 'removed' lines: include only if NOT accepted (i.e. keep removal)
 * - For 'modified' lines: use rightText if accepted, leftText if not
 */
function buildMergedText(
  diffLines: DiffLine[],
  acceptedIndices: Set<number>,
  rejectedIndices: Set<number>
): string {
  const result: string[] = []

  for (const line of diffLines) {
    if (line.type === 'equal') {
      result.push(line.rightText)
      continue
    }

    const isAccepted = acceptedIndices.has(line.index)
    const isRejected = rejectedIndices.has(line.index)

    if (line.type === 'added') {
      // Include added line only if accepted
      if (isAccepted && !isRejected) {
        result.push(line.rightText)
      }
    } else if (line.type === 'removed') {
      // Keep the original text unless accepted for removal
      if (!isAccepted || isRejected) {
        result.push(line.leftText)
      }
    } else if (line.type === 'modified') {
      // Use generated text if accepted, original if not
      if (isAccepted && !isRejected) {
        result.push(line.rightText)
      } else {
        result.push(line.leftText)
      }
    }
  }

  return result.join('\n')
}

/* ============================================================
   COMPONENT
   ============================================================ */

export function PartialAccept({
  original,
  generated,
  qualityScore,
  onAccept,
  onReject,
}: PartialAcceptProps) {
  const diffLines = useMemo(
    () => computeLineDiffs(original, generated),
    [original, generated]
  )

  // Track accepted/rejected non-equal line indices
  const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(() => {
    // Default: accept all non-equal lines
    const indices = new Set<number>()
    for (const line of diffLines) {
      if (line.type !== 'equal') {
        indices.add(line.index)
      }
    }
    return indices
  })
  const [rejectedIndices, setRejectedIndices] = useState<Set<number>>(new Set())

  const toggleLine = useCallback((index: number) => {
    setAcceptedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
    setRejectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      }
      return next
    })
  }, [])

  const acceptAll = useCallback(() => {
    const indices = new Set<number>()
    for (const line of diffLines) {
      if (line.type !== 'equal') {
        indices.add(line.index)
      }
    }
    setAcceptedIndices(indices)
    setRejectedIndices(new Set())
  }, [diffLines])

  const rejectAll = useCallback(() => {
    setAcceptedIndices(new Set())
    const rejected = new Set<number>()
    for (const line of diffLines) {
      if (line.type !== 'equal') {
        rejected.add(line.index)
      }
    }
    setRejectedIndices(rejected)
  }, [diffLines])

  const handleAccept = useCallback(() => {
    const merged = buildMergedText(diffLines, acceptedIndices, rejectedIndices)
    onAccept(merged)
  }, [diffLines, acceptedIndices, rejectedIndices, onAccept])

  // Count stats
  const stats = useMemo(() => {
    let accepted = 0
    let rejected = 0
    let pending = 0
    for (const line of diffLines) {
      if (line.type === 'equal') continue
      if (acceptedIndices.has(line.index)) accepted++
      else if (rejectedIndices.has(line.index)) rejected++
      else pending++
    }
    return { accepted, rejected, pending, total: accepted + rejected + pending }
  }, [diffLines, acceptedIndices, rejectedIndices])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      className="mt-4 space-y-3"
    >
      {/* Quality score badge */}
      {qualityScore !== undefined && (
        <QualityScoreBadge score={qualityScore} />
      )}

      {/* Acceptance status */}
      <div
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-[11px]"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--border-default)',
        }}
      >
        <span className="flex items-center gap-1">
          <Check className="w-3 h-3" style={{ color: 'var(--color-ifline)' }} />
          <span style={{ color: 'var(--color-ifline)' }}>{stats.accepted}</span>
          已接受
        </span>
        <span className="flex items-center gap-1">
          <X className="w-3 h-3" style={{ color: 'var(--color-vermillion)' }} />
          <span style={{ color: 'var(--color-vermillion)' }}>{stats.rejected}</span>
          已拒绝
        </span>
        {stats.pending > 0 && (
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ color: 'var(--text-tertiary)' }}>{stats.pending}</span>
            待处理
          </span>
        )}
      </div>

      {/* Diff viewer with partial controls */}
      <div style={{ maxHeight: 400, overflow: 'hidden' }}>
        <DiffViewer
          original={original}
          generated={generated}
          showPartialControls={true}
          acceptedIndices={acceptedIndices}
          rejectedIndices={rejectedIndices}
          onToggleLine={toggleLine}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button onClick={handleAccept} variant="accent" size="sm" className="flex-1">
          <CheckCheck className="w-4 h-4 mr-1" />
          应用选中 ({stats.accepted}/{stats.total})
        </Button>
        <Button onClick={onReject} variant="ghost" size="sm" className="flex-1">
          <XCircle className="w-4 h-4 mr-1" />
          放弃全部
        </Button>
      </div>
    </motion.div>
  )
}

/* ============================================================
   QUALITY SCORE BADGE (local, matches DiffPreview style)
   ============================================================ */

function QualityScoreBadge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 90) return 'var(--color-ifline)'
    if (s >= 75) return 'var(--color-location)'
    if (s >= 60) return 'var(--color-character)'
    return 'var(--color-vermillion)'
  }
  const getLabel = (s: number) => {
    if (s >= 90) return '优秀'
    if (s >= 75) return '良好'
    if (s >= 60) return '一般'
    return '需改进'
  }

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
        style={{
          background: `color-mix(in srgb, ${getColor(score)} 15%, transparent)`,
          color: getColor(score),
          border: `2px solid ${getColor(score)}`,
        }}
      >
        {score}
      </div>
      <div className="flex-1">
        <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          AI 生成质量
        </div>
        <div className="text-sm font-semibold" style={{ color: getColor(score) }}>
          {getLabel(score)}
        </div>
      </div>
    </div>
  )
}

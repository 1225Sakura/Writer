import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { Check, X, Split, TrendingUp, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DiffViewer } from '@/components/writing/ai/DiffViewer'
import { PartialAccept } from '@/components/writing/ai/PartialAccept'

/* ============================================================
   QUALITY SCORE BADGE
   ============================================================ */

interface QualityScoreBadgeProps {
  score: number
}

export function QualityScoreBadge({ score }: QualityScoreBadgeProps) {
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
          AI生成质量
        </div>
        <div className="text-sm font-semibold" style={{ color: getColor(score) }}>
          {getLabel(score)}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   DIFF PREVIEW — MAIN COMPONENT
   ============================================================ */

interface DiffPreviewProps {
  original: string
  result: string
  onAccept: () => void
  onReject: () => void
  qualityScore: number
}

export function DiffPreview({
  original,
  result,
  onAccept,
  onReject,
  qualityScore,
}: DiffPreviewProps) {
  const [viewMode, setViewMode] = useState<'split' | 'partial' | 'result'>('split')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      className="mt-4 space-y-3"
    >
      {/* Quality score */}
      <QualityScoreBadge score={qualityScore} />

      {/* View mode toggle */}
      <div
        className="flex gap-1 p-0.5 rounded-lg"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--border-default)',
        }}
      >
        <button
          onClick={() => setViewMode('split')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all font-medium ${
            viewMode === 'split'
              ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Split className="w-3.5 h-3.5" />
          对比
        </button>
        <button
          onClick={() => setViewMode('partial')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all font-medium ${
            viewMode === 'partial'
              ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <CheckCheck className="w-3.5 h-3.5" />
          逐行
        </button>
        <button
          onClick={() => setViewMode('result')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all font-medium ${
            viewMode === 'result'
              ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          仅结果
        </button>
      </div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {viewMode === 'split' && (
          <motion.div
            key="split"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.FAST }}
          >
            <DiffViewer original={original} generated={result} />
          </motion.div>
        )}

        {viewMode === 'partial' && (
          <motion.div
            key="partial"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.FAST }}
          >
            <PartialAccept
              original={original}
              generated={result}
              onAccept={onAccept}
              onReject={onReject}
            />
          </motion.div>
        )}

        {viewMode === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.FAST }}
            className="p-3 rounded-xl"
            style={{
              background: 'color-mix(in srgb, var(--color-ifline) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-ifline) 15%, transparent)',
            }}
          >
            <div
              className="text-[10px] uppercase tracking-wider mb-1.5 font-semibold"
              style={{ color: 'var(--color-ifline)' }}
            >
              AI 生成结果
            </div>
            <div
              className="text-sm whitespace-pre-wrap leading-relaxed"
              style={{ color: 'var(--text-primary)' }}
            >
              {result}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons — only shown in split and result modes */}
      {viewMode !== 'partial' && (
        <div className="flex gap-2">
          <Button onClick={onAccept} variant="accent" size="sm" className="flex-1">
            <Check className="w-4 h-4 mr-1" />
            应用
          </Button>
          <Button onClick={onReject} variant="ghost" size="sm" className="flex-1">
            <X className="w-4 h-4 mr-1" />
            放弃
          </Button>
        </div>
      )}
    </motion.div>
  )
}

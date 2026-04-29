import { useState } from 'react'
import { CircularProgress } from '@/components/ui/CircularProgress'
import { Button } from '@/components/ui/Button'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { Check, X, Split, ArrowRight, TrendingUp } from 'lucide-react'

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
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--border-default)' }}>
      <CircularProgress
        value={score}
        size={44}
        strokeWidth={3}
        color={getColor(score)}
        trackColor="var(--border-subtle)"
        showPercentage={true}
      />
      <div className="flex-1">
        <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>AI生成质量</div>
        <div className="text-sm font-semibold" style={{ color: getColor(score) }}>
          {getLabel(score)}
        </div>
      </div>
    </div>
  )
}

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
  const [viewMode, setViewMode] = useState<'split' | 'result'>('split')

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
      <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--border-default)' }}>
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

      {/* Content preview */}
      <div className="space-y-2">
        {viewMode === 'split' && (
          <div className="space-y-2">
            <div className="p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-vermillion) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-vermillion) 15%, transparent)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1.5 font-semibold" style={{ color: 'var(--color-vermillion)' }}>原文</div>
              <div className="text-sm line-clamp-4 leading-relaxed" style={{ color: 'var(--text-primary)', opacity: 0.8 }}>{original}</div>
            </div>
            <div className="flex justify-center py-1">
              <ArrowRight className="w-4 h-4 rotate-90" style={{ color: 'var(--accent-primary)' }} />
            </div>
          </div>
        )}
        <div className="p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-ifline) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-ifline) 15%, transparent)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-1.5 font-semibold" style={{ color: 'var(--color-ifline)' }}>
            {viewMode === 'split' ? 'AI生成' : '结果'}
          </div>
          <div className="text-sm line-clamp-6 whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-primary)' }}>{result}</div>
        </div>
      </div>

      {/* Action buttons */}
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
    </motion.div>
  )
}
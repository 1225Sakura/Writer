import { useState, useCallback } from 'react'
import { useWritingStore, useSettingsStore } from '@/store'
import { checkerApi } from '@/api/aiReview'
import { showToast } from '@/components/ui/Toast'
import { CircularProgress } from '@/components/ui/CircularProgress'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  GitBranch,
  Gauge,
  UserCheck,
  Flame,
  Magnet,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Lightbulb,
  X,
  Sparkles,
  BarChart3,
  TrendingUp,
  Clock,
  Zap,
  BookOpen,
} from 'lucide-react'
import type {
  CheckerBaseResponse,
  ContinuityCheckResponse,
  PacingCheckResponse,
  OOCCheckResponse,
  HighPointCheckResponse,
  ReaderPullCheckResponse,
} from '@/api/types'

// ============================================
// Types
// ============================================

type CheckerKey = 'consistency' | 'continuity' | 'pacing' | 'ooc' | 'highPoint' | 'readerPull'

interface CheckerConfig {
  key: CheckerKey
  label: string
  description: string
  icon: React.ReactNode
  color: string
  requiresCharacter: boolean
}

interface CheckerResult {
  key: CheckerKey
  loading: boolean
  error: string | null
  data:
    | CheckerBaseResponse
    | ContinuityCheckResponse
    | PacingCheckResponse
    | OOCCheckResponse
    | HighPointCheckResponse
    | ReaderPullCheckResponse
    | null
  timestamp: number | null
}

// ============================================
// Checker Configurations
// ============================================

const checkers: CheckerConfig[] = [
  {
    key: 'consistency',
    label: '世界一致性',
    description: '地点、时间线、实力等级、物品归属',
    icon: <ShieldCheck className="w-4 h-4" />,
    color: '#5eb5a6',
    requiresCharacter: false,
  },
  {
    key: 'continuity',
    label: '叙事连续性',
    description: '场景转换、事件连贯、伏笔呼应',
    icon: <GitBranch className="w-4 h-4" />,
    color: '#5b8ee8',
    requiresCharacter: false,
  },
  {
    key: 'pacing',
    label: '叙事节奏',
    description: '任务线/燃情线/星座线比例分析',
    icon: <Gauge className="w-4 h-4" />,
    color: '#e8b87d',
    requiresCharacter: false,
  },
  {
    key: 'ooc',
    label: '角色OOC',
    description: '行为是否符合已建立的性格设定',
    icon: <UserCheck className="w-4 h-4" />,
    color: '#9b7ed9',
    requiresCharacter: true,
  },
  {
    key: 'highPoint',
    label: '高潮分布',
    description: '情感节奏、铺垫充分性、结尾钩子',
    icon: <Flame className="w-4 h-4" />,
    color: '#d45d5d',
    requiresCharacter: false,
  },
  {
    key: 'readerPull',
    label: '读者吸引力',
    description: '开头钩子、结尾悬念、好奇心缺口',
    icon: <Magnet className="w-4 h-4" />,
    color: '#7eb84a',
    requiresCharacter: false,
  },
]

// ============================================
// Helpers
// ============================================

function getScoreColor(score: number): string {
  if (score >= 90) return '#7eb84a'
  if (score >= 75) return '#5eb5a6'
  if (score >= 60) return '#e8b87d'
  return '#d45d5d'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 75) return '良好'
  if (score >= 60) return '一般'
  return '需改进'
}

// ============================================
// Panel Header
// ============================================

function PanelHeader({ onRunAll, isRunning }: { onRunAll: () => void; isRunning: boolean }) {
  return (
    <div className="flex items-center gap-3 pb-3 mb-1">
      <div className="relative flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center relative z-10"
          style={{
            background: 'linear-gradient(135deg, rgba(91, 142, 232, 0.22) 0%, rgba(91, 142, 232, 0.08) 100%)',
            border: '1px solid rgba(91, 142, 232, 0.3)',
            boxShadow: '0 0 16px rgba(91, 142, 232, 0.15), inset 0 1px 0 rgba(91, 142, 232, 0.1)',
          }}
        >
          <Sparkles className="w-5 h-5" style={{ color: '#5b8ee8' }} />
        </div>
        <span
          className="absolute inset-[-2px] rounded-xl animate-ping opacity-25 motion-reduce:animate-none"
          style={{
            background: 'rgba(91, 142, 232, 0.15)',
            animationDuration: '2.5s',
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3
          className="text-sm font-bold tracking-tight"
          style={{
            background: 'linear-gradient(90deg, #5b8ee8 0%, #7eb84a 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          AI 质量检查
        </h3>
        <p className="text-[10px] leading-tight flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
          <span
            className="inline-block w-1 h-1 rounded-full animate-pulse motion-reduce:animate-none"
            style={{ background: '#5b8ee8', boxShadow: '0 0 4px #5b8ee8' }}
          />
          六维质量分析 · 智能诊断
        </p>
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onRunAll}
        disabled={isRunning}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
        style={{
          background: 'linear-gradient(135deg, rgba(91, 142, 232, 0.2) 0%, rgba(126, 184, 74, 0.15) 100%)',
          border: '1px solid rgba(91, 142, 232, 0.3)',
          color: '#5b8ee8',
        }}
      >
        {isRunning ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
        全部检查
      </motion.button>
    </div>
  )
}

// ============================================
// Score Overview
// ============================================

function ScoreOverview({ results }: { results: Map<CheckerKey, CheckerResult> }) {
  const scores = checkers
    .map((c) => {
      const r = results.get(c.key)
      return r?.data ? { key: c.key, label: c.label, score: r.data.score, color: c.color } : null
    })
    .filter(Boolean) as Array<{ key: CheckerKey; label: string; score: number; color: string }>

  if (scores.length === 0) return null

  const avgScore = Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length)

  return (
    <div
      className="p-3 rounded-xl mb-3"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div className="flex items-center gap-3">
        <CircularProgress
          value={avgScore}
          size={48}
          strokeWidth={3}
          color={getScoreColor(avgScore)}
          trackColor="var(--border-subtle)"
          showPercentage={true}
        />
        <div className="flex-1">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>综合质量评分</div>
          <div className="text-sm font-semibold" style={{ color: getScoreColor(avgScore) }}>
            {getScoreLabel(avgScore)} ({avgScore}分)
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {scores.map((s) => (
          <div key={s.key} className="text-center">
            <div className="text-xs font-bold" style={{ color: s.color }}>{s.score}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// Checker Card
// ============================================

function CheckerCard({
  config,
  result,
  onRun,
  selectedCharacterId,
  onCharacterChange,
}: {
  config: CheckerConfig
  result: CheckerResult | undefined
  onRun: () => void
  selectedCharacterId: number | null
  onCharacterChange: (id: number | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { characters } = useSettingsStore()

  const isLoading = result?.loading ?? false
  const hasData = result?.data !== null
  const score = result?.data?.score ?? 0
  const issues = result?.data?.issues ?? []
  const suggestions = result?.data?.suggestions ?? []

  return (
    <motion.div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
      }}
      whileHover={{ borderColor: 'var(--border-strong)' }}
      transition={{ duration: 0.15 }}
    >
      {/* Card Header */}
      <button
        onClick={() => hasData && setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-colors hover:bg-[var(--hover-bg)]"
      >
        <span
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
          style={{
            background: `color-mix(in srgb, ${config.color} 15%, transparent)`,
            color: config.color,
          }}
        >
          {config.icon}
        </span>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{config.label}</div>
          <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>{config.description}</div>
        </div>

        {hasData && (
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: `${getScoreColor(score)}18`,
                color: getScoreColor(score),
              }}
            >
              {score}分
            </span>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </motion.div>
          </div>
        )}

        {!hasData && !isLoading && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation()
              onRun()
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium"
            style={{
              background: `color-mix(in srgb, ${config.color} 15%, transparent)`,
              color: config.color,
            }}
          >
            <Play className="w-3 h-3" />
            检查
          </motion.button>
        )}

        {isLoading && (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: config.color }} />
        )}
      </button>

      {/* Character selector for OOC checker */}
      <AnimatePresence>
        {config.key === 'ooc' && !hasData && !isLoading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5">
              <select
                value={selectedCharacterId ?? ''}
                onChange={(e) => onCharacterChange(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border bg-[var(--color-surface-base)] text-[var(--text-primary)]"
                style={{ borderColor: 'var(--border-default)' }}
              >
                <option value="">选择要检查的角色</option>
                {characters.map((char) => (
                  <option key={char.id} value={char.id}>{char.name}</option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && hasData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-3 pb-3 pt-1 space-y-2"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {/* Score bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  <span>质量评分</span>
                  <span style={{ color: getScoreColor(score) }}>{getScoreLabel(score)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: config.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>

              {/* Issues */}
              {issues.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'var(--color-vermillion)' }}>
                    <AlertCircle className="w-3 h-3" />
                    发现问题 ({issues.length})
                  </div>
                  {issues.map((issue, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-1.5 p-1.5 rounded-lg text-xs"
                      style={{
                        background: 'color-mix(in srgb, var(--color-vermillion) 6%, transparent)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <X className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-vermillion)' }} />
                      <span>{issue}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: '#7eb84a' }}>
                    <Lightbulb className="w-3 h-3" />
                    改进建议 ({suggestions.length})
                  </div>
                  {suggestions.map((suggestion, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-1.5 p-1.5 rounded-lg text-xs"
                      style={{
                        background: 'color-mix(in srgb, #7eb84a 6%, transparent)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: '#7eb84a' }} />
                      <span>{suggestion}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* No issues */}
              {issues.length === 0 && suggestions.length === 0 && (
                <div
                  className="flex items-center gap-2 p-2 rounded-lg text-xs"
                  style={{
                    background: 'color-mix(in srgb, #7eb84a 8%, transparent)',
                    color: '#7eb84a',
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  未发现问题，表现优秀！
                </div>
              )}

              {/* Specialized displays */}
              <SpecializedDisplay config={config} data={result?.data} />

              {/* Re-run button */}
              <button
                onClick={onRun}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-50"
                style={{
                  background: `color-mix(in srgb, ${config.color} 10%, transparent)`,
                  color: config.color,
                  border: `1px solid color-mix(in srgb, ${config.color} 20%, transparent)`,
                }}
              >
                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                重新检查
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================
// Specialized Displays for Each Checker
// ============================================

function SpecializedDisplay({
  config,
  data,
}: {
  config: CheckerConfig
  data: CheckerResult['data']
}) {
  if (!data) return null

  switch (config.key) {
    case 'continuity': {
      const continuity = data as ContinuityCheckResponse
      if (!continuity.plot_thread_status || Object.keys(continuity.plot_thread_status).length === 0) return null
      return (
        <div className="space-y-1">
          <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>伏笔状态</div>
          {Object.entries(continuity.plot_thread_status).map(([thread, status], i) => (
            <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded-md" style={{ background: 'var(--color-surface-base)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{thread}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: status === 'fulfilled' ? '#7eb84a18' : '#e8b87d18',
                  color: status === 'fulfilled' ? '#7eb84a' : '#e8b87d',
                }}
              >
                {status === 'fulfilled' ? '已呼应' : '待呼应'}
              </span>
            </div>
          ))}
        </div>
      )
    }

    case 'pacing': {
      const pacing = data as PacingCheckResponse
      if (!pacing.strand_ratios || pacing.strand_ratios.length === 0) return null
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>故事线比例</div>
          {pacing.strand_ratios.map((strand, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>{strand.strand}</span>
                <span className="tabular-nums font-medium" style={{ color: config.color }}>{strand.percentage}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: config.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${strand.percentage}%` }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                />
              </div>
            </div>
          ))}
          {pacing.analysis && (
            <div className="text-xs leading-relaxed p-2 rounded-lg" style={{ background: 'var(--color-surface-base)', color: 'var(--text-secondary)' }}>
              {pacing.analysis}
            </div>
          )}
        </div>
      )
    }

    case 'ooc': {
      const ooc = data as OOCCheckResponse
      if (!ooc.violations || ooc.violations.length === 0) return null
      return (
        <div className="space-y-1">
          <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>OOC 违规 ({ooc.violations.length})</div>
          {ooc.violations.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-2 rounded-lg space-y-1"
              style={{ background: 'color-mix(in srgb, var(--color-vermillion) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-vermillion) 10%, transparent)' }}
            >
              <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{v.location}</div>
              <div className="text-xs space-y-0.5">
                <div className="flex gap-1.5">
                  <span style={{ color: 'var(--text-tertiary)' }}>期望:</span>
                  <span style={{ color: '#7eb84a' }}>{v.expected_behavior}</span>
                </div>
                <div className="flex gap-1.5">
                  <span style={{ color: 'var(--text-tertiary)' }}>实际:</span>
                  <span style={{ color: 'var(--color-vermillion)' }}>{v.actual_behavior}</span>
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{v.reason}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )
    }

    case 'highPoint': {
      const hp = data as HighPointCheckResponse
      return (
        <div className="space-y-2">
          {hp.excitement_density && (
            <div className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: 'var(--color-surface-base)' }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: config.color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{hp.excitement_density}</span>
            </div>
          )}
          {hp.ending_hook && (
            <div className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: 'var(--color-surface-base)' }}>
              <Zap className="w-3.5 h-3.5" style={{ color: config.color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{hp.ending_hook}</span>
            </div>
          )}
          {hp.high_points && hp.high_points.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>高潮点 ({hp.high_points.length})</div>
              {hp.high_points.map((point, i) => (
                <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded-md" style={{ background: 'var(--color-surface-base)' }}>
                  <Flame className="w-3 h-3" style={{ color: config.color }} />
                  <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{point.location}</span>
                  <span className="text-[10px] tabular-nums font-medium" style={{ color: config.color }}>{point.intensity}/10</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    case 'readerPull': {
      const rp = data as ReaderPullCheckResponse
      return (
        <div className="space-y-2">
          {rp.opening_hook && (
            <div className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: 'var(--color-surface-base)' }}>
              <BookOpen className="w-3.5 h-3.5" style={{ color: config.color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{rp.opening_hook}</span>
            </div>
          )}
          {rp.ending_hook && (
            <div className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: 'var(--color-surface-base)' }}>
              <Zap className="w-3.5 h-3.5" style={{ color: config.color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{rp.ending_hook}</span>
            </div>
          )}
          {rp.curiosity_gaps && rp.curiosity_gaps.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>好奇心缺口 ({rp.curiosity_gaps.length})</div>
              {rp.curiosity_gaps.map((gap, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs px-2 py-1 rounded-md" style={{ background: 'var(--color-surface-base)' }}>
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: config.color }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{gap}</span>
                </div>
              ))}
            </div>
          )}
          {rp.hooks && rp.hooks.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>钩子 ({rp.hooks.length})</div>
              {rp.hooks.map((hook, i) => (
                <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded-md" style={{ background: 'var(--color-surface-base)' }}>
                  <Magnet className="w-3 h-3" style={{ color: config.color }} />
                  <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{hook.description}</span>
                  <span className="text-[10px] tabular-nums font-medium" style={{ color: config.color }}>{hook.effectiveness}/10</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    default:
      return null
  }
}

// ============================================
// Main Component
// ============================================

export function AICheckerPanel() {
  const { currentChapterId } = useWritingStore()
  const [results, setResults] = useState<Map<CheckerKey, CheckerResult>>(new Map())
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null)
  const [isRunningAll, setIsRunningAll] = useState(false)

  const setResult = useCallback((key: CheckerKey, update: Partial<CheckerResult>) => {
    setResults((prev) => {
      const next = new Map(prev)
      const existing = next.get(key)
      next.set(key, {
        key,
        loading: false,
        error: null,
        data: null,
        timestamp: null,
        ...existing,
        ...update,
      })
      return next
    })
  }, [])

  const runChecker = useCallback(
    async (key: CheckerKey) => {
      if (!currentChapterId) {
        showToast('请先选择一个章节', 'warning')
        return
      }

      setResult(key, { loading: true, error: null })

      try {
        let data: CheckerResult['data']

        switch (key) {
          case 'consistency':
            data = await checkerApi.checkConsistency(currentChapterId)
            break
          case 'continuity':
            data = await checkerApi.checkContinuity(currentChapterId)
            break
          case 'pacing':
            data = await checkerApi.checkPacing(currentChapterId)
            break
          case 'ooc':
            if (!selectedCharacterId) {
              showToast('请先选择一个角色', 'warning')
              setResult(key, { loading: false, error: '未选择角色' })
              return
            }
            data = await checkerApi.checkOOC(currentChapterId, selectedCharacterId)
            break
          case 'highPoint':
            data = await checkerApi.checkHighPoint(currentChapterId)
            break
          case 'readerPull':
            data = await checkerApi.checkReaderPull(currentChapterId)
            break
          default:
            throw new Error(`Unknown checker: ${key}`)
        }

        setResult(key, { loading: false, data, timestamp: Date.now() })
        showToast(`${checkers.find((c) => c.key === key)?.label} 检查完成`, 'success')
      } catch (error) {
        const message = error instanceof Error ? error.message : '检查失败'
        setResult(key, { loading: false, error: message })
        showToast(message, 'error')
      }
    },
    [currentChapterId, selectedCharacterId, setResult]
  )

  const runAllCheckers = useCallback(async () => {
    if (!currentChapterId) {
      showToast('请先选择一个章节', 'warning')
      return
    }

    setIsRunningAll(true)
    showToast('开始全部检查...', 'info')

    // Run all checkers except OOC (needs character selection)
    const promises = checkers
      .filter((c) => c.key !== 'ooc')
      .map(async (config) => {
        setResult(config.key, { loading: true, error: null })
        try {
          let data: CheckerResult['data']
          switch (config.key) {
            case 'consistency':
              data = await checkerApi.checkConsistency(currentChapterId)
              break
            case 'continuity':
              data = await checkerApi.checkContinuity(currentChapterId)
              break
            case 'pacing':
              data = await checkerApi.checkPacing(currentChapterId)
              break
            case 'highPoint':
              data = await checkerApi.checkHighPoint(currentChapterId)
              break
            case 'readerPull':
              data = await checkerApi.checkReaderPull(currentChapterId)
              break
          }
          setResult(config.key, { loading: false, data, timestamp: Date.now() })
        } catch (error) {
          const message = error instanceof Error ? error.message : '检查失败'
          setResult(config.key, { loading: false, error: message })
        }
      })

    await Promise.all(promises)
    setIsRunningAll(false)
    showToast('全部检查完成', 'success')
  }, [currentChapterId, setResult])

  if (!currentChapterId) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--border-default)',
          }}
        >
          <BarChart3 className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>未选择章节</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>请先选择一个章节以运行质量检查</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 ai-drawer-scroll">
      <PanelHeader onRunAll={runAllCheckers} isRunning={isRunningAll} />

      <ScoreOverview results={results} />

      <div className="space-y-2">
        {checkers.map((config) => (
          <CheckerCard
            key={config.key}
            config={config}
            result={results.get(config.key)}
            onRun={() => runChecker(config.key)}
            selectedCharacterId={selectedCharacterId}
            onCharacterChange={setSelectedCharacterId}
          />
        ))}
      </div>

      {/* Footer hint */}
      <p className="text-[10px] text-center pt-2" style={{ color: 'var(--text-tertiary)' }}>
        基于 AI 分析，结果仅供参考
      </p>
    </div>
  )
}

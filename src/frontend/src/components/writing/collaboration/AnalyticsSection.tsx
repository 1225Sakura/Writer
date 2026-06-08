import { useState, useEffect, useMemo } from 'react'
import { useWritingStore, useAnalyticsStore, useSettingsStore } from '@/store'
import { CollapsibleSection } from './CollapsibleSection'
import { Zap, AlertTriangle, BarChart3, TrendingUp, Heart, Activity } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'

// ============================================
// Simple SVG chart components (no external deps)
// ============================================

/** Minimal bar chart for pacing / strand distribution */
function BarChart({ data, height = 80 }: { data: { label: string; value: number; color: string }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-t-sm transition-all duration-500"
            style={{
              height: `${(d.value / max) * (height - 20)}px`,
              minHeight: d.value > 0 ? '4px' : '0',
              background: d.color,
              opacity: 0.85,
            }}
          />
          <span className="text-[9px] truncate w-full text-center" style={{ color: 'var(--text-tertiary)' }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Minimal line/area chart for emotion curve */
function EmotionCurve({ points, height = 64 }: { points: { x: number; y: number; label?: string }[]; height?: number }) {
  if (points.length < 2) return null
  const width = 240
  const padding = 4
  const xScale = (i: number) => padding + (i / (points.length - 1)) * (width - padding * 2)
  const yScale = (v: number) => padding + ((1 - v) / 1) * (height - padding * 2)

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.y)}`)
    .join(' ')

  const areaD = `${pathD} L ${xScale(points.length - 1)} ${height - padding} L ${xScale(0)} ${height - padding} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="emotionGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-ifline)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-ifline)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#emotionGrad)" />
      <path d={pathD} fill="none" stroke="var(--color-ifline)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(p.y)} r="2" fill="var(--color-ifline)" />
      ))}
      {/* zero line */}
      <line x1={padding} y1={yScale(0.5)} x2={width - padding} y2={yScale(0.5)} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="3 3" />
    </svg>
  )
}

/** Score ring visualization */
function ScoreRing({ score, size = 48, strokeWidth = 4, label }: { score: number; size?: number; strokeWidth?: number; label: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(score, 100) / 100) * circumference
  const color = score >= 70 ? 'var(--color-ifline)' : score >= 40 ? 'var(--color-outline)' : 'var(--color-vermillion)'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{score}</span>
      </div>
      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  )
}

// ============================================
// Main component
// ============================================

export function AnalyticsSection() {
  const [isExpanded, setIsExpanded] = useState(false)
  const currentChapterId = useWritingStore((s) => s.currentChapterId)
  const outline = useSettingsStore((s) => s.outline)
  const {
    engagementScore,
    engagementAnalysis,
    hookAnalysis,
    debtReport,
    pacingAnalysis,
    loading,
    fetchScore,
    fetchEngagementAnalysis,
    detectHooks,
    fetchDebts,
    fetchPacingAnalysis,
  } = useAnalyticsStore()

  useEffect(() => {
    if (currentChapterId && isExpanded) {
      fetchScore(currentChapterId)
      fetchEngagementAnalysis(currentChapterId)
      detectHooks(currentChapterId)
      fetchDebts({ current_chapter_id: currentChapterId })
    }
  }, [currentChapterId, isExpanded, fetchScore, fetchEngagementAnalysis, detectHooks, fetchDebts])

  useEffect(() => {
    if (outline?.id && isExpanded) {
      fetchPacingAnalysis(outline.id)
    }
  }, [outline?.id, isExpanded, fetchPacingAnalysis])

  // Build pacing chart data from pacingAnalysis
  const pacingChartData = useMemo(() => {
    if (!pacingAnalysis?.strand_ratios) return []
    const colorMap: Record<string, string> = {
      quest: 'var(--color-character)',
      battle: 'var(--color-vermillion)',
      romance: 'var(--color-item)',
      mystery: 'var(--color-outline)',
      slice_of_life: 'var(--color-ifline)',
      comedy: 'var(--color-location)',
    }
    return Object.entries(pacingAnalysis.strand_ratios).map(([strand, ratio]) => ({
      label: strand.length > 4 ? strand.slice(0, 4) : strand,
      value: Math.round(ratio * 100),
      color: colorMap[strand] || 'var(--text-tertiary)',
    }))
  }, [pacingAnalysis])

  // Build emotion curve from engagement analysis (cool_points as positive, fulfillment gaps as dips)
  const emotionCurveData = useMemo(() => {
    if (!engagementAnalysis) return []

    const totalWords = engagementAnalysis.word_count || 1000
    const points: { x: number; y: number; label?: string }[] = []

    // Start at neutral
    points.push({ x: 0, y: 0.5 })

    // Add cool points as positive spikes
    const coolPoints = engagementAnalysis.cool_points || []
    for (const cp of coolPoints) {
      const normalizedPos = cp.position / totalWords
      const intensity = Math.min(cp.intensity / 10, 1)
      points.push({ x: normalizedPos, y: 0.5 + intensity * 0.4 })
    }

    // Add fulfillments as satisfaction peaks
    const fulfillments = engagementAnalysis.fulfillments || []
    for (const f of fulfillments) {
      const normalizedPos = f.position / totalWords
      const boost = f.size === '大' ? 0.35 : f.size === '中' ? 0.2 : 0.1
      points.push({ x: normalizedPos, y: 0.5 + boost })
    }

    // End at slightly elevated (reader satisfaction from reading)
    points.push({ x: 1, y: 0.55 })

    // Sort by position and deduplicate close points
    points.sort((a, b) => a.x - b.x)
    const deduped: typeof points = []
    for (const p of points) {
      const last = deduped[deduped.length - 1]
      if (!last || Math.abs(p.x - last.x) > 0.02) {
        deduped.push(p)
      } else if (p.y > last.y) {
        deduped[deduped.length - 1] = p
      }
    }
    return deduped
  }, [engagementAnalysis])

  // Reader attraction score (composite of engagement metrics)
  const attractionScore = useMemo(() => {
    if (engagementScore) return engagementScore.overall_score
    if (engagementAnalysis) return Math.round(engagementAnalysis.overall_engagement_score)
    return null
  }, [engagementScore, engagementAnalysis])

  return (
    <CollapsibleSection
      title="写作分析"
      icon={<Icon icon={BarChart3} size="sm" style={{ color: 'var(--color-location)' }} />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="var(--color-location)"
    >
      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          分析中...
        </div>
      ) : !currentChapterId ? (
        <p className="text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>请先选择章节</p>
      ) : (
        <div className="space-y-3">
          {/* ── Reader Attraction Score ── */}
          {attractionScore !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Icon icon={Heart} size="xs" style={{ color: 'var(--color-item)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>读者吸引力评分</span>
                <span className="text-xs font-mono ml-auto px-1.5 py-0.5 rounded" style={{
                  background: attractionScore >= 70 ? 'color-mix(in srgb, var(--color-ifline) 15%, transparent)' : 'color-mix(in srgb, var(--color-vermillion) 15%, transparent)',
                  color: attractionScore >= 70 ? 'var(--color-ifline)' : 'var(--color-vermillion)',
                }}>
                  {attractionScore}/100
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, attractionScore)}%`,
                    background: attractionScore >= 70 ? 'var(--color-ifline)' : attractionScore >= 40 ? 'var(--color-outline)' : 'var(--color-vermillion)',
                  }}
                />
              </div>
              {engagementScore && (
                <div className="flex items-center justify-center gap-4 pt-1">
                  <div className="relative flex flex-col items-center">
                    <ScoreRing score={engagementScore.hook_score} label="钩子" />
                  </div>
                  <div className="relative flex flex-col items-center">
                    <ScoreRing score={engagementScore.engagement_score} label="参与" />
                  </div>
                  <div className="relative flex flex-col items-center">
                    <ScoreRing score={engagementScore.predicted_retention} label="留存" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Pacing Chart (strand distribution) ── */}
          {pacingChartData.length > 0 && (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon icon={Activity} size="xs" style={{ color: 'var(--color-outline)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>节奏分析</span>
                {pacingAnalysis && (
                  <span className="text-[10px] ml-auto px-1.5 py-0.5 rounded" style={{
                    background: 'color-mix(in srgb, var(--color-outline) 12%, transparent)',
                    color: 'var(--color-outline)',
                  }}>
                    健康度 {pacingAnalysis.health_score}
                  </span>
                )}
              </div>
              <BarChart data={pacingChartData} height={72} />
              {pacingAnalysis?.summary && (
                <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                  {pacingAnalysis.summary}
                </p>
              )}
            </div>
          )}

          {/* ── Emotion Curve ── */}
          {emotionCurveData.length > 1 && (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon icon={TrendingUp} size="xs" style={{ color: 'var(--color-ifline)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>情感曲线</span>
                <span className="text-[10px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                  高潮点 {(engagementAnalysis?.cool_point_count ?? 0)}个
                </span>
              </div>
              <EmotionCurve points={emotionCurveData} height={64} />
              <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                <span>开篇</span>
                <span style={{ color: 'var(--border-subtle)' }}>── 中性线 ──</span>
                <span>结尾</span>
              </div>
            </div>
          )}

          {/* ── Hook Analysis (existing) ── */}
          {hookAnalysis && (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon icon={Zap} size="xs" style={{ color: 'var(--accent-primary)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>钩子检测</span>
                <span className="text-[10px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>{hookAnalysis.total_hooks}个</span>
              </div>
              <div className="flex gap-3 text-[10px]">
                <span style={{ color: 'var(--text-tertiary)' }}>开头: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{hookAnalysis.opening_hook_strength}</span></span>
                <span style={{ color: 'var(--text-tertiary)' }}>结尾: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{hookAnalysis.ending_hook_strength}</span></span>
              </div>
            </div>
          )}

          {/* ── Debt Report (existing) ── */}
          {debtReport && debtReport.active_debts > 0 && (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5">
                <Icon icon={AlertTriangle} size="xs" style={{ color: 'var(--color-vermillion)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>叙事债务</span>
                <span className="text-[10px] ml-auto px-1.5 py-0.5 rounded-full" style={{
                  background: 'color-mix(in srgb, var(--color-vermillion) 15%, transparent)',
                  color: 'var(--color-vermillion)',
                }}>
                  {debtReport.active_debts}个待处理
                </span>
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {!engagementScore && !hookAnalysis && !pacingAnalysis && (
            <p className="text-xs py-2 text-center" style={{ color: 'var(--text-tertiary)' }}>
              展开后自动加载分析数据
            </p>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}

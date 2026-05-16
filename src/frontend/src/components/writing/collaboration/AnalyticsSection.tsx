import { useState, useEffect } from 'react'
import { useWritingStore, useAnalyticsStore } from '@/store'
import { CollapsibleSection } from './CollapsibleSection'
import { Zap, AlertTriangle, BarChart3 } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'

export function AnalyticsSection() {
  const [isExpanded, setIsExpanded] = useState(false)
  const currentChapterId = useWritingStore((s) => s.currentChapterId)
  const {
    engagementScore,
    hookAnalysis,
    debtReport,
    loading,
    fetchScore,
    detectHooks,
    fetchDebts,
  } = useAnalyticsStore()

  useEffect(() => {
    if (currentChapterId && isExpanded) {
      fetchScore(currentChapterId)
      detectHooks(currentChapterId)
      fetchDebts({ current_chapter_id: currentChapterId })
    }
  }, [currentChapterId, isExpanded, fetchScore, detectHooks, fetchDebts])

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
          {/* Engagement Score */}
          {engagementScore && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>参与度评分</span>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{
                  background: engagementScore.overall_score >= 70 ? 'color-mix(in srgb, var(--color-ifline) 15%, transparent)' : 'color-mix(in srgb, var(--color-vermillion) 15%, transparent)',
                  color: engagementScore.overall_score >= 70 ? 'var(--color-ifline)' : 'var(--color-vermillion)',
                }}>
                  {engagementScore.grade}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, engagementScore.overall_score)}%`,
                    background: engagementScore.overall_score >= 70 ? 'var(--color-ifline)' : 'var(--color-vermillion)',
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{engagementScore.hook_score}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>钩子</div>
                </div>
                <div>
                  <div className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{engagementScore.engagement_score}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>参与</div>
                </div>
                <div>
                  <div className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{engagementScore.predicted_retention}%</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>留存</div>
                </div>
              </div>
            </div>
          )}

          {/* Hook Analysis */}
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

          {/* Debt Report */}
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

          {!engagementScore && !hookAnalysis && (
            <p className="text-xs py-2 text-center" style={{ color: 'var(--text-tertiary)' }}>
              展开后自动加载分析数据
            </p>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}

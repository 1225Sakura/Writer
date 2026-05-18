import { useState, useEffect } from 'react'
import { useSystemStore } from '@/store/systemStore'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { Icon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE, DURATION } from '@/components/shared/AnimationConfig'
import {
  BookOpen, Workflow, Activity, Shield, ChevronRight,
  Play, RefreshCw, AlertCircle, TrendingUp, Cpu,
} from 'lucide-react'
import { AIProviderPanel } from './AIProviderPanel'

type Tab = 'genres' | 'workflows' | 'observability' | 'constraints' | 'aiProvider'

export function SystemPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('genres')

  const {
    genres, genreProfile, workflows, executions,
    metrics, debts, trends, quickStatus,
    constraintRules, lastCheckResult, loading, error,
    fetchGenres, fetchGenreProfile, listWorkflows, executeWorkflow, fetchExecutions,
    fetchMetrics, fetchDebts, fetchTrends, fetchQuickStatus,
    fetchConstraintRules, clearError,
  } = useSystemStore()

  useEffect(() => {
    fetchGenres()
    listWorkflows()
    fetchConstraintRules()
    fetchQuickStatus()
  }, [fetchGenres, listWorkflows, fetchConstraintRules, fetchQuickStatus])

  const tabs: Array<{ key: Tab; label: string; icon: typeof BookOpen }> = [
    { key: 'genres', label: '类型模板', icon: BookOpen },
    { key: 'workflows', label: '工作流', icon: Workflow },
    { key: 'observability', label: '可观测性', icon: Activity },
    { key: 'constraints', label: '约束规则', icon: Shield },
    { key: 'aiProvider', label: 'AI 配置', icon: Cpu },
  ]

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">系统管理</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          类型模板、工作流、系统指标与约束规则
        </p>
      </div>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-error)]/30 text-sm text-[var(--color-error)]"
          >
            <Icon icon={AlertCircle} size="sm" />
            <span className="flex-1">{error}</span>
            <button onClick={clearError} className="text-xs underline opacity-70 hover:opacity-100">关闭</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick status */}
      {quickStatus && (
        <GlassCard intensity="light" border="subtle" rounded="lg" padding="md">
          <p className="text-xs text-[var(--text-tertiary)] mb-1">项目概览</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">{quickStatus.status_line}</p>
          <div className="flex gap-4 mt-2 text-xs text-[var(--text-secondary)]">
            <span>{quickStatus.chapter_count} 章节</span>
            <span>{(quickStatus.word_count / 1000).toFixed(1)}k 字</span>
            <span>{quickStatus.pending_items} 待处理</span>
            <span>24h 活动: {quickStatus.activity_24h}</span>
          </div>
        </GlassCard>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-surface-overlay)]">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200
              ${activeTab === key
                ? 'bg-[var(--color-surface-base)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}
            `}
          >
            <Icon icon={icon} size="xs" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'genres' && (
          <motion.div key="genres" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">类型预设 ({genres.length})</h3>
              <Button onClick={fetchGenres} variant="ghost" size="sm" disabled={loading}>
                <Icon icon={RefreshCw} size="xs" />
              </Button>
            </div>
            {genres.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">暂无类型预设</p>
            ) : (
              <div className="space-y-2">
                {genres.map((genre) => (
                  <GlassCard key={genre.name} intensity="light" border="subtle" rounded="lg" padding="sm">
                    <button
                      onClick={() => fetchGenreProfile(genre.name)}
                      className="w-full flex items-center justify-between text-left group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{genre.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)] truncate">{genre.description}</p>
                        {genre.core_tropes.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {genre.core_tropes.slice(0, 3).map((trope) => (
                              <span key={trope} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)] text-[var(--text-tertiary)]">{trope}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Icon icon={ChevronRight} size="xs" className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
                    </button>
                  </GlassCard>
                ))}
              </div>
            )}

            {/* Genre profile detail */}
            <AnimatePresence>
              {genreProfile && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <GlassCard intensity="light" border="subtle" rounded="lg" padding="md">
                    <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">{genreProfile.genre} - 类型档案</h4>
                    <p className="text-xs text-[var(--text-secondary)] mb-2">{genreProfile.description}</p>
                    <div className="space-y-1 text-xs text-[var(--text-tertiary)]">
                      <p>压力来源: {genreProfile.pressure_source}</p>
                      <p>释放目标: {genreProfile.release_target}</p>
                      {genreProfile.character_archetypes.length > 0 && (
                        <p>角色原型: {genreProfile.character_archetypes.join(', ')}</p>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === 'workflows' && (
          <motion.div key="workflows" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }} className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">可用工作流 ({workflows.length})</h3>
            {workflows.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">暂无工作流</p>
            ) : (
              <div className="space-y-2">
                {workflows.map((wf) => (
                  <GlassCard key={wf.name} intensity="light" border="subtle" rounded="lg" padding="sm">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{wf.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)] truncate">{wf.description}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{wf.stage_count} 个阶段</p>
                      </div>
                      <Button
                        onClick={() => executeWorkflow(wf.name)}
                        disabled={loading}
                        variant="ghost"
                        size="sm"
                        title="执行"
                      >
                        <Icon icon={Play} size="xs" />
                      </Button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}

            {/* Execution history */}
            <div className="flex items-center justify-between mt-4">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">执行历史</h3>
              <Button onClick={() => fetchExecutions()} variant="ghost" size="sm" disabled={loading}>
                <Icon icon={RefreshCw} size="xs" />
              </Button>
            </div>
            {executions.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-2 text-center">暂无执行记录</p>
            ) : (
              <div className="space-y-1">
                {executions.slice(0, 10).map((exec) => (
                  <div key={exec.execution_id} className="flex items-center justify-between py-1.5 px-2 rounded text-xs">
                    <span className="text-[var(--text-primary)] font-medium">{exec.workflow_name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      exec.status === 'completed' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' :
                      exec.status === 'failed' ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]' :
                      'bg-[var(--color-surface-overlay)] text-[var(--text-tertiary)]'
                    }`}>{exec.status}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'observability' && (
          <motion.div key="observability" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">系统指标</h3>
              <div className="flex gap-1">
                <Button onClick={() => fetchMetrics()} variant="ghost" size="sm" disabled={loading}>
                  <Icon icon={RefreshCw} size="xs" />
                </Button>
                <Button onClick={() => { fetchDebts(); fetchTrends() }} variant="ghost" size="sm" disabled={loading}>
                  <Icon icon={TrendingUp} size="xs" />
                </Button>
              </div>
            </div>

            {metrics && (
              <GlassCard intensity="light" border="subtle" rounded="lg" padding="md">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {Object.entries(metrics.entity_counts).map(([key, count]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">{key}</span>
                      <span className="font-medium text-[var(--text-primary)]">{count}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Debt items */}
            {debts && (
              <>
                <h4 className="text-sm font-medium text-[var(--text-primary)]">
                  技术债务 ({debts.summary.total})
                  <span className="text-xs font-normal text-[var(--text-tertiary)] ml-2">
                    待处理: {debts.summary.pending}
                  </span>
                </h4>
                {debts.items.length === 0 ? (
                  <p className="text-sm text-[var(--text-tertiary)] py-2 text-center">无技术债务</p>
                ) : (
                  <div className="space-y-1">
                    {debts.items.slice(0, 10).map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-1.5 px-2 rounded text-xs">
                        <span className="text-[var(--text-primary)] truncate flex-1">{item.description || item.type}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                          item.status === 'resolved' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' :
                          'bg-[var(--color-surface-overlay)] text-[var(--text-tertiary)]'
                        }`}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Quality trends */}
            {trends && (
              <GlassCard intensity="light" border="subtle" rounded="lg" padding="md">
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">质量趋势</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-tertiary)]">平均分</span>
                    <span className="font-medium text-[var(--text-primary)]">{trends.average_score.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-tertiary)]">检查次数</span>
                    <span className="font-medium text-[var(--text-primary)]">{trends.inspections_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-tertiary)]">趋势方向</span>
                    <span className="font-medium text-[var(--text-primary)]">{trends.trend_direction}</span>
                  </div>
                </div>
                {trends.risk_flags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-[var(--text-tertiary)] mb-1">风险标记:</p>
                    <div className="flex gap-1 flex-wrap">
                      {trends.risk_flags.map((flag) => (
                        <span key={flag} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-error)]/10 text-[var(--color-error)]">{flag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            )}
          </motion.div>
        )}

        {activeTab === 'aiProvider' && (
          <motion.div key="aiProvider" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }} className="space-y-3">
            <AIProviderPanel />
          </motion.div>
        )}

        {activeTab === 'constraints' && (
          <motion.div key="constraints" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">约束规则 ({constraintRules.length})</h3>
              <Button onClick={() => fetchConstraintRules()} variant="ghost" size="sm" disabled={loading}>
                <Icon icon={RefreshCw} size="xs" />
              </Button>
            </div>

            {constraintRules.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">暂无约束规则</p>
            ) : (
              <div className="space-y-2">
                {constraintRules.map((rule) => (
                  <GlassCard key={rule.id} intensity="light" border="subtle" rounded="lg" padding="sm">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{rule.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)] truncate">{rule.description}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)] text-[var(--text-tertiary)]">{rule.law_type}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)] text-[var(--text-tertiary)]">{rule.severity}</span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}

            {/* Last check result */}
            <AnimatePresence>
              {lastCheckResult && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <GlassCard intensity="light" border="subtle" rounded="lg" padding="md">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon icon={lastCheckResult.passed ? AlertCircle : AlertCircle} size="sm"
                        className={lastCheckResult.passed ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'} />
                      <h4 className="text-sm font-medium text-[var(--text-primary)]">
                        {lastCheckResult.passed ? '检查通过' : '检查未通过'}
                      </h4>
                      <span className="text-xs text-[var(--text-tertiary)] ml-auto">得分: {lastCheckResult.overall_score.toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{lastCheckResult.summary}</p>
                    {lastCheckResult.violations.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {lastCheckResult.violations.map((v, i) => (
                          <div key={i} className="text-xs text-[var(--color-error)] flex items-start gap-1">
                            <span className="mt-0.5">-</span>
                            <span>{v.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useSystemStore } from '@/store/systemStore'
import { Icon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Workflow, Activity, Shield, AlertCircle, Cpu } from 'lucide-react'
import { AIProviderPanel } from './AIProviderPanel'
import { GenresTab, WorkflowsTab, ObservabilityTab, ConstraintsTab } from './SystemPanelSections'
import { GlassCard } from '@/components/ui/GlassCard'

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
        <p className="text-sm text-[var(--text-tertiary)] mt-1">类型模板、工作流、系统指标与约束规则</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-error)]/30 text-sm text-[var(--color-error)]"
          >
            <Icon icon={AlertCircle} size="sm" />
            <span className="flex-1">{error}</span>
            <button onClick={clearError} className="text-xs underline opacity-70 hover:opacity-100">关闭</button>
          </motion.div>
        )}
      </AnimatePresence>

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

      <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-surface-overlay)]">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === key
                ? 'bg-[var(--color-surface-base)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Icon icon={icon} size="xs" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'genres' && (
          <GenresTab genres={genres} genreProfile={genreProfile} loading={loading} fetchGenres={fetchGenres} fetchGenreProfile={fetchGenreProfile} />
        )}
        {activeTab === 'workflows' && (
          <WorkflowsTab workflows={workflows} executions={executions} loading={loading} executeWorkflow={executeWorkflow} fetchExecutions={fetchExecutions} />
        )}
        {activeTab === 'observability' && (
          <ObservabilityTab metrics={metrics} debts={debts} trends={trends} loading={loading} fetchMetrics={fetchMetrics} fetchDebts={fetchDebts} fetchTrends={fetchTrends} />
        )}
        {activeTab === 'aiProvider' && (
          <motion.div key="aiProvider" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <AIProviderPanel />
          </motion.div>
        )}
        {activeTab === 'constraints' && (
          <ConstraintsTab constraintRules={constraintRules} lastCheckResult={lastCheckResult} loading={loading} fetchConstraintRules={fetchConstraintRules} />
        )}
      </AnimatePresence>
    </div>
  )
}

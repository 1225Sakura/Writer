import { useWritingStore, useContentStore, useLinkageStore } from '@/store'
import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Plus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CollapsibleSection } from './CollapsibleSection'
import type { PlotThread } from '@/api/types'

// 伏笔线状态定义：埋设 -> 发展 -> 揭示 -> 回收
type ForeshadowStatus = 'planted' | 'developing' | 'revealed' | 'resolved'

interface ForeshadowState {
  label: string
  colorVar: string
  next: ForeshadowStatus | null
}

const FORESHADOW_STATES: Record<ForeshadowStatus, ForeshadowState> = {
  planted:    { label: '埋设', colorVar: 'var(--color-outline)',   next: 'developing' },
  developing: { label: '发展', colorVar: 'var(--color-character)', next: 'revealed' },
  revealed:   { label: '揭示', colorVar: 'var(--color-ifline)',    next: 'resolved' },
  resolved:   { label: '回收', colorVar: 'var(--color-vermillion)', next: null },
}

/** Map legacy PlotThreadStatus to ForeshadowStatus */
function toForeshadowStatus(status: string): ForeshadowStatus {
  switch (status) {
    case 'open': return 'planted'
    case 'active': return 'developing'
    case 'revealed': return 'revealed'
    case 'resolved': return 'resolved'
    default: return 'planted'
  }
}

/** Map ForeshadowStatus back to API status string */
function toApiStatus(fs: ForeshadowStatus): string {
  switch (fs) {
    case 'planted': return 'open'
    case 'developing': return 'active'
    case 'revealed': return 'revealed'
    case 'resolved': return 'resolved'
  }
}

function StatusBadge({ status }: { status: ForeshadowStatus }) {
  const state = FORESHADOW_STATES[status]
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight shrink-0"
      style={{
        background: `color-mix(in srgb, ${state.colorVar} 15%, transparent)`,
        color: state.colorVar,
        border: `1px solid color-mix(in srgb, ${state.colorVar} 25%, transparent)`,
      }}
    >
      {state.label}
    </span>
  )
}

function StatusFlow({ current }: { current: ForeshadowStatus }) {
  const allStatuses: ForeshadowStatus[] = ['planted', 'developing', 'revealed', 'resolved']
  const currentIdx = allStatuses.indexOf(current)

  return (
    <div className="flex items-center gap-0.5 mt-1">
      {allStatuses.map((s, idx) => {
        const state = FORESHADOW_STATES[s]
        const isActive = idx <= currentIdx
        const isCurrent = idx === currentIdx
        return (
          <div key={s} className="flex items-center">
            <div
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                background: isActive ? state.colorVar : 'var(--border-default)',
                boxShadow: isCurrent ? `0 0 6px color-mix(in srgb, ${state.colorVar} 40%, transparent)` : 'none',
              }}
            />
            {idx < allStatuses.length - 1 && (
              <div
                className="w-3 h-px transition-colors duration-300"
                style={{ background: idx < currentIdx ? FORESHADOW_STATES[allStatuses[idx + 1]].colorVar : 'var(--border-default)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function PlotTracker() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { currentChapterId } = useWritingStore()
  const { chapters, plotThreads, fetchPlotThreads, updatePlotThread, createPlotThread } = useContentStore()
  const selectEntity = useLinkageStore((s) => s.selectEntity)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => { fetchPlotThreads() }, [fetchPlotThreads])

  const chapterMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const ch of chapters) map.set(ch.id, ch.title ?? `第${ch.id}章`)
    return map
  }, [chapters])

  const activeThreads = plotThreads.filter((t) => t.status !== 'resolved')

  const handleAdvanceStatus = async (thread: PlotThread) => {
    const fs = toForeshadowStatus(thread.status)
    const next = FORESHADOW_STATES[fs].next
    if (!next) return
    const updates: Partial<PlotThread> = { status: toApiStatus(next) as PlotThread['status'] }
    if (next === 'resolved') updates.reveal_chapter_id = currentChapterId ?? thread.reveal_chapter_id
    await updatePlotThread(thread.id, updates)
    fetchPlotThreads()
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    await createPlotThread({
      title: newTitle.trim(),
      description: newDesc.trim(),
      status: 'open',
      created_chapter_id: currentChapterId ?? undefined,
    })
    setNewTitle('')
    setNewDesc('')
    setIsCreating(false)
    fetchPlotThreads()
  }

  const handleSelectThread = (threadId: number) => {
    selectEntity('plot_thread', threadId, 'plot-tracker')
  }

  return (
    <CollapsibleSection
      title="伏笔追踪"
      icon={<AlertCircle className="w-4 h-4 text-[var(--icon-danger)]" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      badge={activeThreads.length}
    >
      <div className="space-y-2">
        {activeThreads.length === 0 && !isCreating ? (
          <EmptyState icon={<AlertCircle className="w-5 h-5" />} text="暂无进行中的伏笔" />
        ) : (
          activeThreads.map((thread) => {
            const fs = toForeshadowStatus(thread.status)
            const state = FORESHADOW_STATES[fs]
            const chapterName = thread.created_chapter_id ? chapterMap.get(thread.created_chapter_id) : undefined
            return (
              <motion.div
                key={thread.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleSelectThread(thread.id)}
                className="group flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-surface-base)] border transition-all duration-200 cursor-pointer"
                style={{
                  borderColor: 'var(--border-default)',
                  borderLeftColor: state.colorVar,
                  borderLeftWidth: '3px',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-medium text-sm truncate transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {thread.title}
                    </span>
                    <StatusBadge status={fs} />
                  </div>
                  {thread.description && (
                    <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {thread.description}
                    </div>
                  )}
                  {chapterName && (
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      关联章节: {chapterName}
                    </div>
                  )}
                  <StatusFlow current={fs} />
                </div>
                {state.next && (
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleAdvanceStatus(thread) }}
                    variant="ghost"
                    size="icon"
                    title={`推进至: ${FORESHADOW_STATES[state.next].label}`}
                    className="!h-7 !w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <ChevronRight className="w-4 h-4" style={{ color: FORESHADOW_STATES[state.next].colorVar }} />
                  </Button>
                )}
              </motion.div>
            )
          })
        )}
        {isCreating ? (
          <div className="space-y-2 p-2.5 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)]">
            <label htmlFor="plot-title-input" className="sr-only">伏笔标题</label>
            <input id="plot-title-input" type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="伏笔标题" className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border-default)] bg-[var(--ink-100)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]" autoFocus />
            <label htmlFor="plot-desc-input" className="sr-only">描述</label>
            <input id="plot-desc-input" type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="描述（可选）" className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border-default)] bg-[var(--ink-100)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]" />
            <div className="flex gap-2">
              <Button onClick={handleCreate} size="sm" variant="default">确认</Button>
              <Button onClick={() => setIsCreating(false)} size="sm" variant="ghost">取消</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setIsCreating(true)} variant="ghost" size="sm" className="w-full">
            <Plus className="w-4 h-4 mr-1" /> 添加伏笔
          </Button>
        )}
      </div>
    </CollapsibleSection>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-5 px-4 text-center">
      <div className="w-10 h-10 rounded-xl border flex items-center justify-center mb-2.5" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}>{icon}</div>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{text}</p>
    </div>
  )
}
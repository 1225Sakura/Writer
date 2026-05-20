import { useWritingStore, useContentStore } from '@/store'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CollapsibleSection } from './CollapsibleSection'

export function PlotTracker() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { currentChapterId } = useWritingStore()
  const { plotThreads, fetchPlotThreads, updatePlotThread, createPlotThread } = useContentStore()
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => { fetchPlotThreads('open') }, [fetchPlotThreads])

  const openThreads = plotThreads.filter((t) => t.status === 'open')

  const handleReveal = async (threadId: number) => {
    await updatePlotThread(threadId, { status: 'revealed' })
    fetchPlotThreads('open')
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    await createPlotThread({ title: newTitle.trim(), description: newDesc.trim(), status: 'open', created_chapter_id: currentChapterId ?? undefined })
    setNewTitle('')
    setNewDesc('')
    setIsCreating(false)
    fetchPlotThreads('open')
  }

  return (
    <CollapsibleSection
      title="伏笔追踪"
      icon={<AlertCircle className="w-4 h-4 text-[var(--icon-danger)]" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      badge={openThreads.length}
    >
      <div className="space-y-2">
        {openThreads.length === 0 && !isCreating ? (
          <EmptyState icon={<AlertCircle className="w-5 h-5" />} text="暂无进行中的伏笔" />
        ) : (
          openThreads.map((thread) => (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="group flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)] hover:border-[var(--color-ifline)]/25 hover:shadow-[0_0_10px_color-mix(in_srgb,_var(--color-ifline),_6%,_transparent)] transition-all duration-200 cursor-default"
            >
              <span className="text-[var(--color-ifline)] font-bold text-sm mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">❶</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate transition-colors group-hover:text-[var(--color-ifline)]" style={{ color: 'var(--text-primary)' }}>{thread.title}</div>
                {thread.description && <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{thread.description}</div>}
              </div>
              <Button onClick={() => handleReveal(thread.id)} variant="ghost" size="icon" title="标记为已揭示" className="!h-7 !w-7 opacity-60 group-hover:opacity-100 transition-opacity">
                <Check className="w-4 h-4 text-[var(--icon-secondary)] group-hover:text-[var(--color-ifline)] transition-colors" />
              </Button>
            </motion.div>
          ))
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
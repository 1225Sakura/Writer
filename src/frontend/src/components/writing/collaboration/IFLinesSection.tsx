import { useContentStore, useWritingStore } from '@/store'
import { motion } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'
import { GitBranch, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'
import { CollaboratorAvatars } from './CollaboratorAvatars'

type SyncStatus = 'synced' | 'pending' | 'conflict'

function getSyncStatus(ifProgress: number, mainProgress: number): { status: SyncStatus; label: string } {
  const diff = Math.abs(ifProgress - mainProgress)
  if (diff <= 5) return { status: 'synced', label: '已同步' }
  if (ifProgress > mainProgress + 5) return { status: 'conflict', label: '冲突' }
  return { status: 'pending', label: '待同步' }
}

const syncStatusStyles: Record<SyncStatus, { bg: string; color: string; icon: typeof CheckCircle2 }> = {
  synced: { bg: 'color-mix(in srgb, var(--color-ifline) 18%, transparent)', color: 'var(--color-ifline)', icon: CheckCircle2 },
  pending: { bg: 'color-mix(in srgb, var(--color-character) 18%, transparent)', color: 'var(--color-character)', icon: Clock },
  conflict: { bg: 'color-mix(in srgb, var(--color-forbidden) 18%, transparent)', color: 'var(--color-forbidden)', icon: AlertCircle },
}

export function IFLinesSection() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { ifLines, fetchIFLines } = useContentStore()
  const { wordCount, targetWordCount } = useWritingStore()

  const mainlineProgress = useMemo(() => {
    return targetWordCount > 0 ? Math.min((wordCount / targetWordCount) * 100, 100) : 0
  }, [wordCount, targetWordCount])

  useEffect(() => { fetchIFLines() }, [fetchIFLines])

  return (
    <CollapsibleSection
      title="IF线"
      icon={<GitBranch className="w-4 h-4" style={{ color: 'var(--color-ifline)' }} />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      badge={ifLines.length}
      accentColor="var(--color-ifline)"
    >
      <div className="space-y-2">
        {ifLines.length > 0 && (
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>协作者</span>
            <CollaboratorAvatars />
          </div>
        )}
        {ifLines.length === 0 ? (
          <EmptyState icon={<GitBranch className="w-5 h-5" />} text="暂无IF线" />
        ) : (
          ifLines.map((line, index) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group p-2.5 rounded-xl bg-[var(--color-surface-base)] border transition-all duration-200 cursor-default hover:border-[color-mix(in_srgb,var(--color-ifline)_35%,transparent)] hover:shadow-[0_0_16px_color-mix(in_srgb,var(--color-ifline)_8%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--color-ifline)_6%,transparent)]"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-3 h-3 rounded-full flex-shrink-0 relative" style={{ background: 'var(--color-ifline)' }}>
                  <span className="absolute inset-0 rounded-full animate-ping opacity-50 motion-reduce:animate-none" style={{ background: 'var(--color-ifline)', animationDuration: '2s', boxShadow: '0 0 8px var(--color-ifline), 0 0 16px color-mix(in srgb, var(--color-ifline) 30%, transparent)' }} />
                  <span className="absolute inset-[3px] rounded-full bg-[var(--writing-bg)] opacity-60" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate transition-colors group-hover:text-[var(--color-ifline)]" style={{ color: 'var(--text-primary)' }}>{line.title}</div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: line.sync_mode === 'auto' ? 'color-mix(in srgb, var(--color-ifline) 20%, transparent)' : 'color-mix(in srgb, var(--color-character) 20%, transparent)', color: line.sync_mode === 'auto' ? 'var(--color-ifline)' : 'var(--color-character)' }}>
                  {line.sync_mode === 'auto' ? '自动' : '手动'}
                </span>
              </div>
              {line.description && <div className="text-xs truncate mb-1.5 pl-4" style={{ color: 'var(--text-tertiary)' }}>{line.description}</div>}
              <div className="pl-4 space-y-1.5">
                {/* Sync status badge */}
                {(() => {
                  const ifProgress = line.progress || 0
                  const { status, label } = getSyncStatus(ifProgress, mainlineProgress)
                  const style = syncStatusStyles[status]
                  const StatusIcon = style.icon
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>同步状态</span>
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: style.bg, color: style.color }}>
                        <StatusIcon className="w-3 h-3" />
                        {label}
                      </span>
                    </div>
                  )
                })()}
                {/* Dual progress bar: mainline vs IF line */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--accent-primary)' }} />
                      主线
                    </span>
                    <span className="tabular-nums font-medium" style={{ color: 'var(--accent-primary)' }}>{Math.round(mainlineProgress)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, var(--accent-100) 0%, var(--accent-primary) 100%)', boxShadow: '0 0 4px color-mix(in srgb, var(--accent-primary) 30%, transparent)' }} initial={{ width: 0 }} animate={{ width: `${mainlineProgress}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                  <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--color-ifline)' }} />
                      IF线
                    </span>
                    <span className="tabular-nums font-medium" style={{ color: 'var(--color-ifline)' }}>{line.progress || 0}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--color-ifline) 60%, white) 0%, var(--color-ifline) 100%)', boxShadow: '0 0 4px color-mix(in srgb, var(--color-ifline) 30%, transparent)' }} initial={{ width: 0 }} animate={{ width: `${line.progress || 0}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </CollapsibleSection>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-5 px-4 text-center">
      <div className="w-10 h-10 rounded-xl border flex items-center justify-center mb-2.5" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}>
        {icon}
      </div>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{text}</p>
    </div>
  )
}
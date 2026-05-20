import { useContentStore } from '@/store'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { GitBranch } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'
import { CollaboratorAvatars } from './CollaboratorAvatars'

export function IFLinesSection() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { ifLines, fetchIFLines } = useContentStore()

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
              className="group p-2.5 rounded-xl bg-[var(--color-surface-base)] border transition-all duration-200 cursor-default"
              style={{ borderColor: 'var(--border-default)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--color-ifline) 35%, transparent)'
                e.currentTarget.style.boxShadow = '0 0 16px color-mix(in srgb, var(--color-ifline) 8%, transparent), inset 0 1px 0 color-mix(in srgb, var(--color-ifline) 6%, transparent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)'
                e.currentTarget.style.boxShadow = 'none'
              }}
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
              <div className="pl-4 space-y-1">
                <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  <span>进度</span>
                  <span className="tabular-nums font-medium" style={{ color: 'var(--color-ifline)' }}>{line.progress || 0}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                  <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-location) 0%, var(--color-ifline) 50%, color-mix(in srgb, var(--color-ifline) 60%, white) 100%)', boxShadow: '0 0 6px color-mix(in srgb, var(--color-ifline) 40%, transparent)' }} initial={{ width: 0 }} animate={{ width: `${line.progress || 0}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
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
import { useSettingsStore } from '@/store'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Play, Pause, Clock } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'

export function CharacterStorylines() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { characters } = useSettingsStore()

  const charactersWithProgress = characters.slice(0, 5).map((char, i) => ({
    ...char,
    progress: Math.min(100, (i + 1) * 20 + Math.floor(Math.random() * 15)),
    status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'idle' : 'pending' as const,
    lastActive: i === 0 ? '刚刚' : i === 1 ? '5分钟前' : '1小时前',
  }))

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active': return { color: 'var(--color-ifline)', label: '活跃', icon: <Play className="w-3 h-3" /> }
      case 'idle': return { color: 'var(--color-character)', label: '待机', icon: <Pause className="w-3 h-3" /> }
      default: return { color: 'var(--text-tertiary)', label: '待出场', icon: <Clock className="w-3 h-3" /> }
    }
  }

  return (
    <CollapsibleSection
      title="配角故事线"
      icon={<Users className="w-4 h-4 text-[var(--icon-secondary)]" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      badge={charactersWithProgress.length}
    >
      <div className="space-y-2">
        {charactersWithProgress.length === 0 ? (
          <EmptyState icon={<Users className="w-5 h-5" />} text="暂无配角故事线" />
        ) : (
          charactersWithProgress.map((char, index) => {
            const statusConfig = getStatusConfig(char.status)
            return (
              <motion.div
                key={char.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group p-2.5 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)] hover:border-[var(--color-character)]/30 hover:shadow-[0_0_12px_color-mix(in_srgb,_var(--color-character),_8%,_transparent)] transition-all duration-200 cursor-default"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="relative flex-shrink-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: statusConfig.color, color: 'var(--ink-100)' }}>{char.name.charAt(0)}</div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: 'var(--color-surface-base)', backgroundColor: statusConfig.color }} />
                  </div>
                  <span className="flex-1 text-sm font-medium truncate transition-colors group-hover:text-[var(--color-character)]" style={{ color: 'var(--text-primary)' }}>{char.name}</span>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'color-mix(in srgb, ' + statusConfig.color + ' 18%, transparent)', color: statusConfig.color }}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </div>
                </div>
                <div className="space-y-1 pl-8">
                  <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    <span>故事线进度</span>
                    <span className="tabular-nums font-medium" style={{ color: statusConfig.color }}>{char.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, ' + statusConfig.color + '88 0%, ' + statusConfig.color + ' 100%)', boxShadow: '0 0 6px color-mix(in srgb, ' + statusConfig.color + ' 40%, transparent)' }} initial={{ width: 0 }} animate={{ width: `${char.progress}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>上次活跃: {char.lastActive}</div>
                </div>
              </motion.div>
            )
          })
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
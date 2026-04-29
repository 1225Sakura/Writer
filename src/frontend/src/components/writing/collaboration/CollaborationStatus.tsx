import { useWritingStore } from '@/store'
import { usePrefersReducedMotion } from '@/hooks'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { Activity, Clock, TrendingUp, Sparkles, Bot, User } from 'lucide-react'

interface PanelCardProps {
  children: React.ReactNode
  className?: string
  glowColor?: string
}

export function PanelCard({ children, className = '', glowColor }: PanelCardProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden bg-[var(--color-surface-base)] border border-[var(--border-default)]
                  transition-all duration-200 hover:border-[var(--border-strong)]
                  ${className}`}
      style={{
        boxShadow: glowColor ? `inset 0 1px 0 ${glowColor}06` : undefined,
      }}
    >
      {children}
    </div>
  )
}

interface ActivityItemProps {
  icon: React.ReactNode
  text: string
  time: string
  highlight?: boolean
}

export function ActivityItem({ icon, text, time, highlight = false }: ActivityItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: DURATION.FAST, ease: EASE.OUT }}
      className={`flex items-center gap-2 text-xs px-1.5 py-1 rounded-md transition-all duration-150 relative
        ${highlight ? 'text-[var(--accent-primary)] bg-[var(--accent-muted)]' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
    >
      <span className={`absolute -left-[7px] top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full ${highlight ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'}`} />
      <span className={highlight ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}>{icon}</span>
      <span className="flex-1">{text}</span>
      <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">{time}</span>
    </motion.div>
  )
}

export function CollaborationStatus() {
  const { humanAIRatio, loading } = useWritingStore()
  const isAIGenerating = loading.ai
  const prefersReducedMotion = usePrefersReducedMotion()

  const getModeLabel = (ratio: number) => {
    if (ratio < 30) return { label: 'AI主导', color: 'var(--accent-100)', icon: <Bot className="w-3.5 h-3.5" /> }
    if (ratio < 70) return { label: '协作模式', color: 'var(--color-ifline)', icon: <Sparkles className="w-3.5 h-3.5" /> }
    return { label: '用户主导', color: 'var(--color-character)', icon: <User className="w-3.5 h-3.5" /> }
  }

  const mode = getModeLabel(humanAIRatio)

  return (
    <PanelCard glowColor={mode.color}>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">协作状态</span>
          </div>
          <motion.div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${mode.color}18`,
              color: mode.color,
              boxShadow: isAIGenerating ? `0 0 8px ${mode.color}30` : 'none',
            }}
            animate={isAIGenerating && !prefersReducedMotion ? { scale: [1, 1.05, 1] } : {}}
            transition={prefersReducedMotion ? {} : { duration: 1.5, repeat: Infinity }}
          >
            {isAIGenerating ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-100)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-100)]" />
                </span>
                AI生成中...
              </>
            ) : (
              <>
                {mode.icon}
                {mode.label}
              </>
            )}
          </motion.div>
        </div>
        <div className="space-y-1.5 relative pl-3">
          <div className="timeline-connector" />
          <ActivityItem icon={<Clock className="w-3 h-3" />} text="本章已写作 23 分钟" time="刚刚" />
          <ActivityItem icon={<TrendingUp className="w-3 h-3" />} text="今日已写 1,240 字" time="2分钟前" />
          {isAIGenerating && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <ActivityItem icon={<Sparkles className="w-3 h-3 text-[var(--accent-100)] animate-pulse motion-reduce:animate-none" />} text="AI正在处理选中内容..." time="进行中" highlight />
            </motion.div>
          )}
        </div>
      </div>
    </PanelCard>
  )
}
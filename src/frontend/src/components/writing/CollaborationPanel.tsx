import { useWritingStore, useSettingsStore } from '@/store'
import { useState, useEffect } from 'react'
import { usePrefersReducedMotion } from '@/hooks'
import { Button } from '@/components/ui/Button'
import { HumanAIRatioSlider } from '@/components/ui/HumanAIRatioSlider'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  AlertCircle,
  Users,
  BarChart3,
  ChevronDown,
  Check,
  Plus,
  GitBranch,
  Bot,
  User,
  Activity,
  TrendingUp,
  Clock,
  Zap,
  Sparkles,
  Pause,
  Play,
  BookOpen,
  Feather,
  Layers,
} from 'lucide-react'

// Panel header with refined visual hierarchy - collab icon + online status
function PanelHeader() {
  const { loading } = useWritingStore()
  const isOnline = !loading.ai // Using AI loading as proxy for sync status

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-ifline) 18%, transparent) 0%, color-mix(in srgb, var(--color-ifline) 8%, transparent) 100%)',
              border: '1px solid color-mix(in srgb, var(--color-ifline) 25%, transparent)',
            }}
          >
            <Users className="w-5 h-5 text-[var(--color-ifline)]" />
          </div>
          {/* Online status indicator */}
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: 'var(--color-surface-raised)',
              background: isOnline ? 'var(--color-ifline)' : 'var(--color-vermillion)',
            }}
          >
            {isOnline && (
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-40 motion-reduce:animate-none"
                style={{ background: 'var(--color-ifline)', animationDuration: '2s' }}
              />
            )}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>协作面板</span>
          <div className="text-[10px] leading-tight flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: isOnline ? 'var(--color-ifline)' : 'var(--color-vermillion)',
                boxShadow: isOnline ? '0 0 4px var(--color-ifline)' : 'none',
              }}
            />
            <span style={{ color: 'var(--text-tertiary)' }}>
              {isOnline ? '在线同步中' : '同步暂停'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CollaborationPanel() {
  return (
    <div className="flex-1 overflow-y-auto relative">
      {/* Subtle background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 100% 0%, color-mix(in srgb, var(--accent-100) 4%, transparent) 0%, transparent 40%), radial-gradient(ellipse at 0% 100%, color-mix(in srgb, var(--color-ifline) 3%, transparent) 0%, transparent 40%)',
        }}
      />
      <div className="relative z-10 space-y-3 px-3 py-2 md:px-4 md:py-3">
        <PanelHeader />
        <CollaborationStatus />
        <RatioSliderSection />
        <BattleStation />
        <PlotTracker />
        <IFLinesSection />
        <CharacterStorylines />
        <ChapterProgress />
      </div>
    </div>
  )
}

// Shared card style for panel sections with hover effect
function PanelCard({ children, className = '', glowColor }: { children: React.ReactNode; className?: string; glowColor?: string }) {
  return (
    <div
      className={`rounded-xl overflow-hidden bg-[var(--color-surface-base)] border border-[var(--border-default)]
                  transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-[0_2px_12px_color-mix(in_srgb,_var(--ink-100),_12%,_transparent)]
                  ${className}`}
      style={{
        boxShadow: glowColor ? `0 0 0 1px ${glowColor}10, inset 0 1px 0 ${glowColor}08` : undefined,
      }}
    >
      {children}
    </div>
  )
}

// 协作状态指示器
function CollaborationStatus() {
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
        {/* Real-time activity feed with timeline */}
        <div className="space-y-1.5 relative pl-3">
          {/* Timeline connector line */}
          <div className="timeline-connector" />
          <ActivityItem
            icon={<Clock className="w-3 h-3" />}
            text="本章已写作 23 分钟"
            time="刚刚"
          />
          <ActivityItem
            icon={<TrendingUp className="w-3 h-3" />}
            text="今日已写 1,240 字"
            time="2分钟前"
          />
          {isAIGenerating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <ActivityItem
                icon={<Sparkles className="w-3 h-3 text-[var(--accent-100)] animate-pulse motion-reduce:animate-none" />}
                text="AI正在处理选中内容..."
                time="进行中"
                highlight
              />
            </motion.div>
          )}
        </div>
      </div>
    </PanelCard>
  )
}

function ActivityItem({
  icon,
  text,
  time,
  highlight = false,
}: {
  icon: React.ReactNode
  text: string
  time: string
  highlight?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-center gap-2 text-xs px-1.5 py-1 rounded-md transition-all duration-150 relative
        ${highlight ? 'text-[var(--accent-primary)] bg-[var(--accent-muted)]' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
    >
      {/* Timeline dot */}
      <span className={`absolute -left-[7px] top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full ${highlight ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'}`} />
      <span className={highlight ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}>{icon}</span>
      <span className="flex-1">{text}</span>
      <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">{time}</span>
    </motion.div>
  )
}

// 人机比例滑块（使用统一组件）
function RatioSliderSection() {
  const { humanAIRatio, setHumanAIRatio } = useWritingStore()

  const modeInfo =
    humanAIRatio < 30
      ? { label: 'AI主导', icon: <Bot className="w-3 h-3" />, color: 'var(--accent-100)', desc: 'AI自动推进剧情，用户偶尔介入调整' }
      : humanAIRatio < 70
        ? { label: '协作模式', icon: <Sparkles className="w-3 h-3" />, color: 'var(--color-ifline)', desc: '人机共同创作，AI辅助用户写作' }
        : { label: '用户主导', icon: <User className="w-3 h-3" />, color: 'var(--color-character)', desc: '用户主导创作，AI仅按指令辅助' }

  return (
    <CollapsibleSection
      title="人机比例调节"
      icon={<GitBranch className="w-4 h-4 text-[var(--icon-secondary)]" />}
      isExpanded={true}
      onToggle={() => {}}
    >
      <div className="space-y-3">
        <HumanAIRatioSlider
          value={humanAIRatio}
          onChange={setHumanAIRatio}
        />

        {/* Mode description */}
        <motion.div
          className="p-2.5 rounded-lg border transition-all duration-200"
          style={{
            backgroundColor: `${modeInfo.color}10`,
            borderColor: `${modeInfo.color}25`,
          }}
          key={modeInfo.label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span style={{ color: modeInfo.color }}>{modeInfo.icon}</span>
            <span className="text-xs font-medium" style={{ color: modeInfo.color }}>
              {modeInfo.label}
            </span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {modeInfo.desc}
          </div>
        </motion.div>
      </div>
    </CollapsibleSection>
  )
}

// Elegant collaborator avatar stack
function CollaboratorAvatars() {
  const { characters } = useSettingsStore()
  const visibleChars = characters.slice(0, 4)

  if (visibleChars.length === 0) return null

  const statusColors = ['var(--color-ifline)', 'var(--color-character)', 'var(--color-location)', 'var(--color-item)']
  const statusTypes = ['online', 'online', 'away', 'online'] as const

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visibleChars.map((char, i) => (
          <motion.div
            key={char.id}
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="collaborator-avatar relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
            style={{
              backgroundColor: statusColors[i % statusColors.length],
              borderColor: 'var(--color-surface-raised)',
              color: 'var(--ink-100)',
              zIndex: visibleChars.length - i,
            }}
            title={char.name}
          >
            {char.name.charAt(0)}
            {/* Enhanced online status indicator with glow */}
            <span
              className={`collaborator-avatar__status collaborator-avatar__status--${statusTypes[i % statusTypes.length]}`}
              style={{
                background: statusColors[i % statusColors.length],
                boxShadow: `0 0 4px color-mix(in srgb, ${statusColors[i % statusColors.length]} 60%, transparent)`,
              }}
            />
          </motion.div>
        ))}
      </div>
      {characters.length > 4 && (
        <span className="ml-2 text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
          +{characters.length - 4}
        </span>
      )}
    </div>
  )
}

// IF线追踪 - green theme enhanced
function IFLinesSection() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { ifLines, fetchIFLines } = useWritingStore()

  useEffect(() => {
    fetchIFLines()
  }, [fetchIFLines])

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
        {/* Collaborator avatar stack */}
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
              style={{
                borderColor: 'var(--border-default)',
              }}
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
                {/* Enhanced IF line indicator with glow */}
                <span className="w-3 h-3 rounded-full flex-shrink-0 relative" style={{ background: 'var(--color-ifline)' }}>
                  <span
                    className="absolute inset-0 rounded-full animate-ping opacity-50 motion-reduce:animate-none"
                    style={{
                      background: 'var(--color-ifline)',
                      animationDuration: '2s',
                      boxShadow: '0 0 8px var(--color-ifline), 0 0 16px color-mix(in srgb, var(--color-ifline) 30%, transparent)',
                    }}
                  />
                  {/* Inner glow dot */}
                  <span
                    className="absolute inset-[3px] rounded-full bg-[var(--writing-bg)] opacity-60"
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate transition-colors group-hover:text-[var(--color-ifline)]" style={{ color: 'var(--text-primary)' }}>{line.title}</div>
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: line.sync_mode === 'auto' ? 'color-mix(in srgb, var(--color-ifline) 20%, transparent)' : 'color-mix(in srgb, var(--color-character) 20%, transparent)',
                    color: line.sync_mode === 'auto' ? 'var(--color-ifline)' : 'var(--color-character)',
                  }}
                >
                  {line.sync_mode === 'auto' ? '自动' : '手动'}
                </span>
              </div>
              {line.description && (
                <div className="text-xs truncate mb-1.5 pl-4" style={{ color: 'var(--text-tertiary)' }}>
                  {line.description}
                </div>
              )}
              {/* Progress indicator with gradient */}
              <div className="pl-4 space-y-1">
                <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  <span>进度</span>
                  <span className="tabular-nums font-medium" style={{ color: 'var(--color-ifline)' }}>{line.progress || 0}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, var(--color-location) 0%, var(--color-ifline) 50%, #9ed95a 100%)',
                      boxShadow: '0 0 6px color-mix(in srgb, var(--color-ifline) 40%, transparent)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${line.progress || 0}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </CollapsibleSection>
  )
}

// 配角故事线进度
function CharacterStorylines() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { characters } = useSettingsStore()

  // Mock storyline progress for characters
  const charactersWithProgress = characters.slice(0, 5).map((char, i) => ({
    ...char,
    progress: Math.min(100, (i + 1) * 20 + Math.floor(Math.random() * 15)),
    status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'idle' : 'pending' as const,
    lastActive: i === 0 ? '刚刚' : i === 1 ? '5分钟前' : '1小时前',
  }))

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { color: 'var(--color-ifline)', label: '活跃', icon: <Play className="w-3 h-3" /> }
      case 'idle':
        return { color: 'var(--color-character)', label: '待机', icon: <Pause className="w-3 h-3" /> }
      default:
        return { color: 'var(--text-tertiary)', label: '待出场', icon: <Clock className="w-3 h-3" /> }
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
                className="group p-2.5 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)]
                           hover:border-[var(--color-character)]/30 hover:shadow-[0_0_12px_color-mix(in_srgb,_var(--color-character),_8%,_transparent)]
                           transition-all duration-200 cursor-default"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {/* Avatar with status ring */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: statusConfig.color, color: 'var(--ink-100)' }}
                    >
                      {char.name.charAt(0)}
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                      style={{
                        borderColor: 'var(--color-surface-base)',
                        backgroundColor: statusConfig.color,
                      }}
                    />
                  </div>
                  <span className="flex-1 text-sm font-medium truncate transition-colors group-hover:text-[var(--color-character)]" style={{ color: 'var(--text-primary)' }}>
                    {char.name}
                  </span>
                  <div
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: 'color-mix(in srgb, ' + statusConfig.color + ' 18%, transparent)',
                      color: statusConfig.color,
                    }}
                  >
                    {statusConfig.icon}
                    {statusConfig.label}
                  </div>
                </div>
                {/* Storyline progress */}
                <div className="space-y-1 pl-8">
                  <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    <span>故事线进度</span>
                    <span className="tabular-nums font-medium" style={{ color: statusConfig.color }}>{char.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, ' + statusConfig.color + '88 0%, ' + statusConfig.color + ' 100%)',
                        boxShadow: '0 0 6px color-mix(in srgb, ' + statusConfig.color + ' 40%, transparent)',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${char.progress}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    上次活跃: {char.lastActive}
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </CollapsibleSection>
  )
}

// 本章作战台
function BattleStation() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [goal, setGoal] = useState('')
  const [obstacle, setObstacle] = useState('')
  const [cost, setCost] = useState('')
  const [hook, setHook] = useState('')

  return (
    <CollapsibleSection
      title="本章作战台"
      icon={<Target className="w-4 h-4 text-[var(--icon-secondary)]" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-3">
        <BattleInput
          label="目标"
          value={goal}
          onChange={setGoal}
          placeholder="本章主角要达成什么？"
        />
        <BattleInput
          label="阻力"
          value={obstacle}
          onChange={setObstacle}
          placeholder="遇到什么阻碍？"
        />
        <BattleInput
          label="代价"
          value={cost}
          onChange={setCost}
          placeholder="失败会有什么代价？"
        />
        <BattleInput
          label="钩子"
          value={hook}
          onChange={setHook}
          placeholder="如何吸引读者继续看？"
        />
      </div>
    </CollapsibleSection>
  )
}

function BattleInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 px-2.5 py-1.5 text-sm rounded-lg
                   border border-[var(--border-default)] bg-[var(--color-surface-base)]
                   text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                   focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)]/50
                   transition-all"
      />
    </div>
  )
}

// 伏笔追踪
function PlotTracker() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { plotThreads, fetchPlotThreads, updatePlotThread, createPlotThread, currentChapterId } = useWritingStore()
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchPlotThreads('open')
  }, [fetchPlotThreads])

  const openThreads = plotThreads.filter((t) => t.status === 'open')

  const handleReveal = async (threadId: number) => {
    await updatePlotThread(threadId, { status: 'revealed' })
    fetchPlotThreads('open')
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
          <EmptyState icon={<Layers className="w-5 h-5" />} text="暂无进行中的伏笔" />
        ) : (
          openThreads.map((thread) => (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="group flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)]
                         hover:border-[var(--color-ifline)]/25 hover:shadow-[0_0_10px_color-mix(in_srgb,_var(--color-ifline),_6%,_transparent)]
                         transition-all duration-200 cursor-default"
            >
              <span className="text-[var(--color-ifline)] font-bold text-sm mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity"
              >❶</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate transition-colors group-hover:text-[var(--color-ifline)]" style={{ color: 'var(--text-primary)' }}
                >{thread.title}</div>
                {thread.description && (
                  <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                    {thread.description}
                  </div>
                )}
              </div>
              <Button
                onClick={() => handleReveal(thread.id)}
                variant="ghost"
                size="icon"
                title="标记为已揭示"
                className="!h-7 !w-7 opacity-60 group-hover:opacity-100 transition-opacity"
              >
                <Check className="w-4 h-4 text-[var(--icon-secondary)] group-hover:text-[var(--color-ifline)] transition-colors" />
              </Button>
            </motion.div>
          ))
        )}
        {isCreating ? (
          <div className="space-y-2 p-2.5 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)]">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="伏笔标题"
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border-default)] bg-[var(--color-black)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              autoFocus
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="描述（可选）"
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border-default)] bg-[var(--color-black)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate} size="sm" variant="default">确认</Button>
              <Button onClick={() => setIsCreating(false)} size="sm" variant="ghost">取消</Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setIsCreating(true)}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-1" /> 添加伏笔
          </Button>
        )}
      </div>
    </CollapsibleSection>
  )
}

// 章节进度
function ChapterProgress() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { wordCount, targetWordCount, chapters, fetchChapters, currentChapterId } = useWritingStore()

  useEffect(() => {
    fetchChapters()
  }, [fetchChapters])

  const currentChapter = chapters.find((c) => c.id === currentChapterId)
  const totalWords = chapters.reduce((sum, c) => sum + c.word_count, 0)
  const progress = Math.min((wordCount / targetWordCount) * 100, 100)

  return (
    <CollapsibleSection
      title="章节进度"
      icon={<BarChart3 className="w-4 h-4" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm" style={{ color: 'var(--text-primary)' }}>
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              本章: {wordCount} / {targetWordCount} 字
            </span>
            <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--border-subtle)' }}>
            <motion.div
              className="h-full rounded-full relative"
              style={{
                background: 'linear-gradient(90deg, var(--accent-100) 0%, var(--color-ifline) 60%, #9ed95a 100%)',
                boxShadow: '0 0 8px color-mix(in srgb, var(--accent-100) 30%, transparent)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
        <div className="pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
              总章节: {chapters.length}
            </span>
            <span className="flex items-center gap-1">
              <Feather className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
              总字数: {totalWords.toLocaleString()}
            </span>
          </div>
          {currentChapter && (
            <div className="flex items-center gap-1 text-xs truncate" style={{ color: 'var(--accent-primary)' }}>
              <Zap className="w-3 h-3" />
              当前: {currentChapter.title || `第${currentChapter.chapter_order}章`}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  )
}

// 空状态组件
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

// Enhanced collapsible section with accent color support
function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  badge,
  accentColor,
  children,
}: {
  title: string
  icon?: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  badge?: number
  accentColor?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-[var(--color-surface-base)] border transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
      style={{
        borderColor: 'var(--border-default)',
        boxShadow: accentColor ? `0 0 0 1px ${accentColor}08, inset 0 1px 0 ${accentColor}06` : undefined,
      }}
    >
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 active:scale-[0.99] transition-all group"
      >
        {icon && (
          <span className="transition-transform duration-200 group-hover:scale-110">
            {icon}
          </span>
        )}
        <span className="flex-1 text-left text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className="px-1.5 py-0.5 text-xs rounded-full font-medium"
            style={{
              background: 'color-mix(in srgb, var(--color-vermillion) 20%, transparent)',
              color: 'var(--color-vermillion)',
              boxShadow: '0 0 6px color-mix(in srgb, var(--color-vermillion) 20%, transparent)',
            }}
          >
            {badge}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-tertiary)' }}
        />
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-[var(--color-surface-base)]"
            >{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

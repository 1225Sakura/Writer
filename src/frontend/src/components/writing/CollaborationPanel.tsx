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
} from 'lucide-react'

export function CollaborationPanel() {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <CollaborationStatus />
      <RatioSliderSection />
      <BattleStation />
      <PlotTracker />
      <IFLinesSection />
      <CharacterStorylines />
      <ChapterProgress />
    </div>
  )
}

// Shared card style for panel sections
function PanelCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl overflow-hidden bg-[var(--color-surface-base)] border border-[var(--border-default)] ${className}`}>
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
    if (ratio < 30) return { label: 'AI主导', color: '#5e6ad2', icon: <Bot className="w-3.5 h-3.5" /> }
    if (ratio < 70) return { label: '协作模式', color: '#7eb84a', icon: <Sparkles className="w-3.5 h-3.5" /> }
    return { label: '用户主导', color: '#e8b87d', icon: <User className="w-3.5 h-3.5" /> }
  }

  const mode = getModeLabel(humanAIRatio)

  return (
    <PanelCard>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">协作状态</span>
          </div>
          <motion.div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${mode.color}20`,
              color: mode.color,
            }}
            animate={isAIGenerating && !prefersReducedMotion ? { scale: [1, 1.05, 1] } : {}}
            transition={prefersReducedMotion ? {} : { duration: 1.5, repeat: Infinity }}
          >
            {isAIGenerating ? (
              <>
                <Zap className="w-3 h-3 animate-pulse motion-reduce:animate-none" />
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
      {/* Real-time activity feed */}
      <div className="space-y-1.5">
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
              icon={<Sparkles className="w-3 h-3 text-[#5e6ad2] animate-pulse motion-reduce:animate-none" />}
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
    <div className={`flex items-center gap-2 text-xs ${highlight ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
    >
      <span className={highlight ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}>{icon}</span>
      <span className="flex-1">{text}</span>
      <span className="text-[10px] text-[var(--text-tertiary)]">{time}</span>
    </div>
  )
}

// 人机比例滑块（使用统一组件）
function RatioSliderSection() {
  const { humanAIRatio, setHumanAIRatio } = useWritingStore()

  return (
    <CollapsibleSection
      title="人机比例调节"
      icon={<GitBranch className="w-4 h-4" />}
      isExpanded={true}
      onToggle={() => {}}
    >
      <div className="space-y-3">
        <HumanAIRatioSlider
          value={humanAIRatio}
          onChange={setHumanAIRatio}
        />

        {/* Mode description */}
        <div className="p-2 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)]"
        >
          <div className="text-xs text-[var(--text-secondary)]">
            {humanAIRatio < 30 && 'AI主导模式：AI自动推进剧情，用户偶尔介入调整'}
            {humanAIRatio >= 30 && humanAIRatio < 70 && '协作模式：人机共同创作，AI辅助用户写作'}
            {humanAIRatio >= 70 && '用户主导模式：用户主导创作，AI仅按指令辅助'}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}

// IF线追踪
function IFLinesSection() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { ifLines, fetchIFLines } = useWritingStore()

  useEffect(() => {
    fetchIFLines()
  }, [fetchIFLines])

  return (
    <CollapsibleSection
      title="IF线"
      icon={<GitBranch className="w-4 h-4" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      badge={ifLines.length}
    >
      <div className="space-y-2">
        {ifLines.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] text-center py-2">
            暂无IF线
          </p>
        ) : (
          ifLines.map((line, index) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-2.5 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 bg-[var(--color-ifline)]"
                  style={{ boxShadow: '0 0 6px var(--color-ifline)40' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">{line.title}</div>
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: line.sync_mode === 'auto' ? '#7eb84a20' : '#e8b87d20',
                    color: line.sync_mode === 'auto' ? '#7eb84a' : '#e8b87d',
                  }}
                >
                  {line.sync_mode === 'auto' ? '自动' : '手动'}
                </span>
              </div>
              {line.description && (
                <div className="text-xs text-[var(--text-tertiary)] truncate mb-1.5 pl-4">
                  {line.description}
                </div>
              )}
              {/* Progress indicator */}
              <div className="pl-4 space-y-1">
                <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
                  <span>进度</span>
                  <span>{line.progress || 0}%</span>
                </div>
                <div className="h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[var(--color-ifline)]"
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
        return { color: '#7eb84a', label: '活跃', icon: <Play className="w-3 h-3" /> }
      case 'idle':
        return { color: '#e8b87d', label: '待机', icon: <Pause className="w-3 h-3" /> }
      default:
        return { color: '#d0d6e0', label: '待出场', icon: <Clock className="w-3 h-3" /> }
    }
  }

  return (
    <CollapsibleSection
      title="配角故事线"
      icon={<Users className="w-4 h-4" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      badge={charactersWithProgress.length}
    >
      <div className="space-y-2">
        {charactersWithProgress.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] text-center py-2">
            暂无配角故事线
          </p>
        ) : (
          charactersWithProgress.map((char, index) => {
            const statusConfig = getStatusConfig(char.status)
            return (
              <motion.div
                key={char.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-2.5 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)]"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 bg-[var(--color-character)]"
                    style={{ boxShadow: '0 0 6px var(--color-character)40' }}
                  />
                  <span className="flex-1 text-sm font-medium text-[var(--text-primary)] truncate">
                    {char.name}
                  </span>
                  <div
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: `${statusConfig.color}20`,
                      color: statusConfig.color,
                    }}
                  >
                    {statusConfig.icon}
                    {statusConfig.label}
                  </div>
                </div>
                {/* Storyline progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
                    <span>故事线进度</span>
                    <span>{char.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[var(--color-character)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${char.progress}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">
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
      icon={<Target className="w-4 h-4" />}
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
      <label className="text-xs text-[var(--text-tertiary)] font-medium">{label}</label>
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
      icon={<AlertCircle className="w-4 h-4" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      badge={openThreads.length}
    >
      <div className="space-y-2">
        {openThreads.length === 0 && !isCreating ? (
          <p className="text-sm text-[var(--text-secondary)] text-center py-2">
            暂无进行中的伏笔
          </p>
        ) : (
          openThreads.map((thread) => (
            <div
              key={thread.id}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)]"
            >
              <span className="text-[var(--color-ifline)] font-bold text-sm mt-0.5">❶</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-[var(--text-primary)] truncate">{thread.title}</div>
                {thread.description && (
                  <div className="text-xs text-[var(--text-tertiary)] truncate">
                    {thread.description}
                  </div>
                )}
              </div>
              <Button
                onClick={() => handleReveal(thread.id)}
                variant="ghost"
                size="icon"
                title="标记为已揭示"
                className="!h-7 !w-7"
              >
                <Check className="w-4 h-4 text-[var(--color-ifline)]" />
              </Button>
            </div>
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
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-[var(--text-primary)]">
            <span>本章: {wordCount} / {targetWordCount} 字</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-[var(--border-subtle)]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #5e6ad2 0%, #7eb84a 100%)' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex justify-between text-xs text-[var(--text-secondary)]">
            <span>总章节: {chapters.length}</span>
            <span>总字数: {totalWords.toLocaleString()}</span>
          </div>
          {currentChapter && (
            <div className="mt-1 text-xs truncate text-[var(--accent-primary)]">
              当前: {currentChapter.title || `第${currentChapter.chapter_order}章`}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  )
}

// 可折叠章节组件
function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  badge,
  children,
}: {
  title: string
  icon?: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  badge?: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl overflow-hidden bg-[var(--color-surface-base)] border border-[var(--border-default)]"
    >
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-2 active:scale-[0.99] transition-all text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
      >
        {icon && <span className="text-[var(--accent-primary)]">{icon}</span>}
        <span className="flex-1 text-left text-sm font-medium text-[var(--text-primary)]">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className="px-1.5 py-0.5 text-xs rounded-full font-medium"
            style={{
              background: 'color-mix(in srgb, var(--color-vermillion) 20%, transparent)',
              color: 'var(--color-vermillion)',
            }}
          >
            {badge}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 text-[var(--text-secondary)] ${isExpanded ? 'rotate-180' : ''}`}
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

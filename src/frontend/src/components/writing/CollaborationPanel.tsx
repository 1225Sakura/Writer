import { useWritingStore, useSettingsStore } from '@/store'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Target, AlertCircle, Users, BarChart, ChevronDown, Check } from 'lucide-react'

export function CollaborationPanel() {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <BattleStation />
      <PlotTracker />
      <CharacterStatus />
      <ChapterProgress />
    </div>
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
        <div>
          <label className="text-xs text-[#d0d6e0]">目标</label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="本章主角要达成什么？"
            className="w-full mt-1 px-2 py-1.5 text-sm rounded-md
                       border border-[rgba(255,255,255,0.08)] bg-[#0f1011]
                       text-[#f7f8f8] placeholder-[#d0d6e0]/50
                       focus:outline-none focus:ring-2 focus:ring-[#5e6ad2] focus:border-[#5e6ad2]"
          />
        </div>
        <div>
          <label className="text-xs text-[#d0d6e0]">阻力</label>
          <input
            type="text"
            value={obstacle}
            onChange={(e) => setObstacle(e.target.value)}
            placeholder="遇到什么阻碍？"
            className="w-full mt-1 px-2 py-1.5 text-sm rounded-md
                       border border-[rgba(255,255,255,0.08)] bg-[#0f1011]
                       text-[#f7f8f8] placeholder-[#d0d6e0]/50
                       focus:outline-none focus:ring-2 focus:ring-[#5e6ad2] focus:border-[#5e6ad2]"
          />
        </div>
        <div>
          <label className="text-xs text-[#d0d6e0]">代价</label>
          <input
            type="text"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="失败会有什么代价？"
            className="w-full mt-1 px-2 py-1.5 text-sm rounded-md
                       border border-[rgba(255,255,255,0.08)] bg-[#0f1011]
                       text-[#f7f8f8] placeholder-[#d0d6e0]/50
                       focus:outline-none focus:ring-2 focus:ring-[#5e6ad2] focus:border-[#5e6ad2]"
          />
        </div>
        <div>
          <label className="text-xs text-[#d0d6e0]">钩子</label>
          <input
            type="text"
            value={hook}
            onChange={(e) => setHook(e.target.value)}
            placeholder="如何吸引读者继续看？"
            className="w-full mt-1 px-2 py-1.5 text-sm rounded-md
                       border border-[rgba(255,255,255,0.08)] bg-[#0f1011]
                       text-[#f7f8f8] placeholder-[#d0d6e0]/50
                       focus:outline-none focus:ring-2 focus:ring-[#5e6ad2] focus:border-[#5e6ad2]"
          />
        </div>
      </div>
    </CollapsibleSection>
  )
}

// 伏笔追踪
function PlotTracker() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { plotThreads, closePlotThread } = useWritingStore()

  const openThreads = plotThreads.filter((t) => t.status === 'open')

  return (
    <CollapsibleSection
      title="伏笔追踪"
      icon={<AlertCircle className="w-4 h-4" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      badge={openThreads.length}
    >
      <div className="space-y-2">
        {openThreads.length === 0 ? (
          <p className="text-sm text-[#d0d6e0] text-center py-2">
            暂无进行中的伏笔
          </p>
        ) : (
          openThreads.map((thread) => (
            <div
              key={thread.id}
              className="flex items-start gap-2 p-2 rounded-md bg-[#0f1011]"
            >
              <span className="text-[#7eb84a] font-bold">❶</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-[#f7f8f8] truncate">{thread.title}</div>
                {thread.description && (
                  <div className="text-xs text-[#d0d6e0] truncate">
                    {thread.description}
                  </div>
                )}
              </div>
              <Button
                onClick={() => closePlotThread(thread.id)}
                variant="ghost"
                size="icon"
                title="标记为已揭示"
              >
                <Check className="w-4 h-4 text-[#6dd45e]" />
              </Button>
            </div>
          ))
        )}
      </div>
    </CollapsibleSection>
  )
}

// 角色状态
function CharacterStatus() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { characters } = useSettingsStore()

  // 从角色故事线进度动态获取状态
  const activeCharacters = characters.slice(0, 3).map((c) => {
    const activeStoryline = c.storylines.find((s) => s.progress > 0 && s.progress < 100)
    const state = c.cultivationRealm || (activeStoryline ? `${activeStoryline.arc} ${activeStoryline.progress}%` : '待出场')
    return { ...c, state }
  })

  return (
    <CollapsibleSection
      title="角色状态"
      icon={<Users className="w-4 h-4" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-2">
        {activeCharacters.length === 0 ? (
          <p className="text-sm text-[#d0d6e0] text-center py-2">
            暂无角色状态
          </p>
        ) : (
          activeCharacters.map((char) => (
            <div key={char.id} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-[#e8b87d]"
              />
              <span className="flex-1 text-sm text-[#f7f8f8] truncate">{char.name}</span>
              <span className="text-xs text-[#5eb5a6]">{char.state}</span>
            </div>
          ))
        )}
        {activeCharacters.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-[#e8b87d]/10 mt-2">
            <AlertCircle className="w-3 h-3 text-[#e8b87d]" />
            <span className="text-xs text-[#e8b87d]">OOC 警告</span>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

// 章节进度
function ChapterProgress() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { wordCount, targetWordCount } = useWritingStore()

  const progress = Math.min((wordCount / targetWordCount) * 100, 100)

  return (
    <CollapsibleSection
      title="章节进度"
      icon={<BarChart className="w-4 h-4" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-[#f7f8f8]">
          <span>{wordCount} / {targetWordCount} 字</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#5e6ad2] transition-all"
            style={{ width: `${progress}%` }}
          />
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
    <div className="border border-[rgba(255,255,255,0.08)] rounded-lg overflow-hidden bg-[#0f1011]">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2
                   hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.99] transition-all"
      >
        {icon && <span className="text-[#5e6ad2]">{icon}</span>}
        <span className="flex-1 text-left text-sm font-medium text-[#f7f8f8]">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded bg-[#c45c5c] text-white">
            {badge}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-[#d0d6e0] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      {isExpanded && <div className="p-3 bg-[#08090a]">{children}</div>}
    </div>
  )
}

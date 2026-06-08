import { useSettingsStore } from '@/store'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Play, Pause, Clock, AlertTriangle, ChevronRight } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { CollapsibleSection } from './CollapsibleSection'

/** 角色弧光阶段 */
const ARC_PHASES = ['起始', '发展', '转折', '高潮', '结局'] as const

/** OOC 检测规则：基于角色性格/缺陷的行为一致性检查 */
interface OOCWarning {
  characterId: number
  characterName: string
  type: 'personality_deviation' | 'desire_conflict' | 'behavioral_inconsistency'
  severity: 'warning' | 'critical'
  message: string
  chapterIndex: number
}

/** 模拟章节数据 — 角色在各章节的出场与状态 */
interface ChapterPresence {
  chapterIndex: number
  chapterTitle: string
  present: boolean
  emotionalState: string
  arcPhase: typeof ARC_PHASES[number]
}

/** 角色弧光时间线节点 */
interface ArcNode {
  chapterIndex: number
  chapterTitle: string
  phase: typeof ARC_PHASES[number]
  emotionalState: string
}

/** 生成角色在各章节的出场数据（模拟） */
function generateChapterPresence(_characterName: string, totalChapters: number): ChapterPresence[] {
  const states = ['平静', '紧张', '愤怒', '悲伤', '坚定', '迷茫', '觉醒', '释然']
  return Array.from({ length: totalChapters }, (_, i) => ({
    chapterIndex: i,
    chapterTitle: `第${i + 1}章`,
    present: Math.random() > 0.25,
    emotionalState: states[(i + Math.floor(Math.random() * 3)) % states.length],
    arcPhase: ARC_PHASES[Math.min(i, ARC_PHASES.length - 1)],
  }))
}

/** 简易 OOC 检测：检查角色情感变化是否过于突兀 */
function detectOOCWarnings(
  characterName: string,
  characterId: number,
  personality: string | undefined,
  presences: ChapterPresence[],
): OOCWarning[] {
  const warnings: OOCWarning[] = []
  const consecutive = presences.filter((p) => p.present)

  for (let i = 1; i < consecutive.length; i++) {
    const prev = consecutive[i - 1]
    const curr = consecutive[i]
    const drasticShifts: [string, string][] = [
      ['平静', '愤怒'], ['悲伤', '愤怒'], ['觉醒', '迷茫'],
    ]
    const isDrastic = drasticShifts.some(
      ([a, b]) => (prev.emotionalState === a && curr.emotionalState === b) || (prev.emotionalState === b && curr.emotionalState === a),
    )
    if (isDrastic) {
      warnings.push({
        characterId,
        characterName,
        type: 'personality_deviation',
        severity: 'warning',
        message: `${prev.chapterTitle}到${curr.chapterTitle}情感突变: ${prev.emotionalState} -> ${curr.emotionalState}`,
        chapterIndex: curr.chapterIndex,
      })
    }
  }

  if (personality && consecutive.length >= 3) {
    const angerCount = consecutive.filter((p) => p.emotionalState === '愤怒').length
    if (angerCount > consecutive.length * 0.5 && !personality.includes('暴躁') && !personality.includes('易怒')) {
      warnings.push({
        characterId,
        characterName,
        type: 'behavioral_inconsistency',
        severity: 'critical',
        message: `角色性格「${personality}」与频繁愤怒行为不符`,
        chapterIndex: consecutive[consecutive.length - 1].chapterIndex,
      })
    }
  }

  return warnings
}

/** 阶段对应颜色 */
function getPhaseColor(phase: typeof ARC_PHASES[number]): string {
  switch (phase) {
    case '起始': return 'var(--color-location)'
    case '发展': return 'var(--color-character)'
    case '转折': return 'var(--color-vermillion)'
    case '高潮': return 'var(--color-ifline)'
    case '结局': return 'var(--color-outline)'
    default: return 'var(--text-tertiary)'
  }
}

export function CharacterStorylines() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [expandedArcId, setExpandedArcId] = useState<number | null>(null)
  const { characters } = useSettingsStore()

  const totalChapters = 12

  const charactersWithProgress = useMemo(() =>
    characters.slice(0, 5).map((char, i) => ({
      ...char,
      progress: Math.min(100, (i + 1) * 20 + Math.floor(Math.random() * 15)),
      status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'idle' : 'pending' as const,
      lastActive: i === 0 ? '刚刚' : i === 1 ? '5分钟前' : '1小时前',
    })),
  [characters])

  /** 为每个角色生成弧光时间线和 OOC 检测 */
  const arcData = useMemo(() => {
    const map = new Map<number, { arcNodes: ArcNode[]; oocWarnings: OOCWarning[] }>()
    charactersWithProgress.forEach((char) => {
      const presences = generateChapterPresence(char.name, totalChapters)
      const arcNodes: ArcNode[] = presences
        .filter((p) => p.present)
        .map((p) => ({
          chapterIndex: p.chapterIndex,
          chapterTitle: p.chapterTitle,
          phase: p.arcPhase,
          emotionalState: p.emotionalState,
        }))
      const oocWarnings = detectOOCWarnings(char.name, char.id, char.personality, presences)
      map.set(char.id, { arcNodes, oocWarnings })
    })
    return map
  }, [charactersWithProgress])

  const totalWarnings = useMemo(() => {
    let count = 0
    arcData.forEach((d) => { count += d.oocWarnings.length })
    return count
  }, [arcData])

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
      {/* OOC 全局警告条 */}
      {totalWarnings > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg border"
          style={{
            background: 'color-mix(in srgb, var(--color-vermillion) 8%, transparent)',
            borderColor: 'color-mix(in srgb, var(--color-vermillion) 25%, transparent)',
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-vermillion)' }} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-vermillion)' }}>
            检测到 {totalWarnings} 条 OOC 警告
          </span>
        </motion.div>
      )}

      <div className="space-y-2">
        {charactersWithProgress.length === 0 ? (
          <EmptyState icon={<Users className="w-5 h-5" />} text="暂无配角故事线" />
        ) : (
          charactersWithProgress.map((char, index) => {
            const statusConfig = getStatusConfig(char.status)
            const data = arcData.get(char.id)
            const isArcExpanded = expandedArcId === char.id
            const charWarnings = data?.oocWarnings ?? []

            return (
              <motion.div
                key={char.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group p-2.5 rounded-lg bg-[var(--color-surface-base)] border border-[var(--border-default)] hover:border-[var(--color-character)]/30 hover:shadow-[0_0_12px_color-mix(in_srgb,_var(--color-character),_8%,_transparent)] transition-all duration-200 cursor-default"
              >
                {/* 角色头部信息 */}
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

                {/* 进度条 + 活跃时间 */}
                <div className="space-y-1 pl-8">
                  <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    <span>故事线进度</span>
                    <span className="tabular-nums font-medium" style={{ color: statusConfig.color }}>{char.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, ' + statusConfig.color + '88 0%, ' + statusConfig.color + ' 100%)', boxShadow: '0 0 6px color-mix(in srgb, ' + statusConfig.color + ' 40%, transparent)' }} initial={{ width: 0 }} animate={{ width: `${char.progress}%` }} transition={{ duration: 0.8, ease: EASE.SMOOTH }} />
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>上次活跃: {char.lastActive}</div>
                </div>

                {/* 角色弧光展开按钮 */}
                {data && data.arcNodes.length > 0 && (
                  <button
                    onClick={() => setExpandedArcId(isArcExpanded ? null : char.id)}
                    className="flex items-center gap-1 mt-2 ml-8 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--color-surface-raised)]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <ChevronRight className={`w-3 h-3 transition-transform duration-${DURATION.FAST} ${isArcExpanded ? 'rotate-90' : ''}`} />
                    角色弧光
                    {charWarnings.length > 0 && (
                      <span className="ml-1 px-1 rounded-full text-[9px] font-bold" style={{ background: 'color-mix(in srgb, var(--color-vermillion) 20%, transparent)', color: 'var(--color-vermillion)' }}>
                        {charWarnings.length}
                      </span>
                    )}
                  </button>
                )}

                {/* 角色弧光时间线 */}
                <AnimatePresence>
                  {isArcExpanded && data && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 ml-8 space-y-1.5">
                        {/* 弧光时间线 */}
                        <ArcTimeline nodes={data.arcNodes} />

                        {/* OOC 警告列表 */}
                        {charWarnings.length > 0 && (
                          <div className="space-y-1 pt-1.5 mt-1.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                            {charWarnings.map((warn, wi) => (
                              <motion.div
                                key={wi}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: wi * 0.04 }}
                                className="flex items-start gap-1.5 p-1.5 rounded-md text-[10px]"
                                style={{
                                  background: warn.severity === 'critical'
                                    ? 'color-mix(in srgb, var(--color-vermillion) 10%, transparent)'
                                    : 'color-mix(in srgb, var(--color-character) 8%, transparent)',
                                  borderLeft: `2px solid ${warn.severity === 'critical' ? 'var(--color-vermillion)' : 'var(--color-character)'}`,
                                }}
                              >
                                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: warn.severity === 'critical' ? 'var(--color-vermillion)' : 'var(--color-character)' }} />
                                <div>
                                  <span className="font-medium" style={{ color: warn.severity === 'critical' ? 'var(--color-vermillion)' : 'var(--color-character)' }}>
                                    {warn.severity === 'critical' ? '严重' : '注意'}
                                  </span>
                                  <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>{warn.message}</span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })
        )}
      </div>
    </CollapsibleSection>
  )
}

/** 角色弧光时间线组件 */
function ArcTimeline({ nodes }: { nodes: ArcNode[] }) {
  return (
    <div className="relative">
      {/* 时间线连线 */}
      <div className="absolute left-[5px] top-[8px] bottom-[8px] w-px" style={{ background: 'var(--border-subtle)' }} />

      <div className="space-y-1">
        {nodes.map((node, i) => {
          const phaseColor = getPhaseColor(node.phase)
          return (
            <motion.div
              key={`${node.chapterIndex}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-2 relative"
            >
              {/* 时间线节点圆点 */}
              <div
                className="w-[11px] h-[11px] rounded-full border-2 flex-shrink-0 z-[1]"
                style={{
                  borderColor: phaseColor,
                  background: i === nodes.length - 1 ? phaseColor : 'var(--color-surface-base)',
                  boxShadow: i === nodes.length - 1 ? `0 0 6px color-mix(in srgb, ${phaseColor} 50%, transparent)` : undefined,
                }}
              />

              {/* 章节标签 */}
              <span className="text-[10px] font-medium tabular-nums min-w-[40px]" style={{ color: 'var(--text-tertiary)' }}>
                {node.chapterTitle}
              </span>

              {/* 阶段徽章 */}
              <span
                className="text-[9px] font-medium px-1 py-0.5 rounded"
                style={{
                  background: `color-mix(in srgb, ${phaseColor} 15%, transparent)`,
                  color: phaseColor,
                }}
              >
                {node.phase}
              </span>

              {/* 情感状态 */}
              <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {node.emotionalState}
              </span>
            </motion.div>
          )
        })}
      </div>
    </div>
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

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { useChatStore } from '@/store/chatStore'
import { typeColors } from '@/lib/entityColors'
import type { ExtractedEntityLocal } from '@/store/chatStore'
import {
  PenLine,
  Target,
  Flame,
  Globe,
  User,
  Package,
  MapPin,
  Shield,
  Scale,
} from 'lucide-react'

/* ============================================================
   TOP GRADIENT DIVIDER
   ============================================================ */

function TopGradientDivider() {
  return (
    <div className="absolute top-0 left-0 right-0 h-px pointer-events-none z-10">
      <div
        className="h-full w-full"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-100) 30%, transparent) 15%, color-mix(in srgb, var(--accent-100) 50%, transparent) 50%, color-mix(in srgb, var(--accent-100) 30%, transparent) 85%, transparent 100%)',
        }}
      />
      {/* Subtle glow below the line */}
      <div
        className="absolute top-0 left-0 right-0 h-4"
        style={{
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent-100) 8%, transparent) 0%, transparent 100%)',
        }}
      />
    </div>
  )
}

/* ============================================================
   WORD COUNT DISPLAY
   ============================================================ */

function WordCountDisplay() {
  const writingStats = useChatStore((s) => s.writingStats)

  return (
    <motion.div
      className="flex items-center gap-3 text-xs"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
        <PenLine className="w-3 h-3" />
        <span className="tabular-nums">{writingStats.sessionChars.toLocaleString()}</span>
        <span className="text-[var(--text-tertiary)]">字</span>
      </div>
      <div className="w-px h-3 bg-[var(--border-default)]" />
      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
        <span className="text-[var(--text-tertiary)]">今日</span>
        <span className="tabular-nums">{writingStats.todayChars.toLocaleString()}</span>
      </div>
      {writingStats.streakDays > 0 && (
        <>
          <div className="w-px h-3 bg-[var(--border-default)]" />
          <div className="flex items-center gap-1 text-[var(--color-ifline)]">
            <Flame className="w-3 h-3" />
            <span className="tabular-nums">{writingStats.streakDays}</span>
            <span className="text-[var(--text-tertiary)]">天</span>
          </div>
        </>
      )}
    </motion.div>
  )
}

/* ============================================================
   WRITING GOAL PROGRESS
   ============================================================ */

function WritingGoalProgress() {
  const writingGoal = useChatStore((s) => s.writingGoal)
  const progress = writingGoal.dailyTarget > 0
    ? Math.min(100, Math.round((writingGoal.currentProgress / writingGoal.dailyTarget) * 100))
    : 0

  return (
    <motion.div
      className="flex items-center gap-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        <Target className="w-3 h-3" />
        <span className="tabular-nums">{writingGoal.currentProgress.toLocaleString()}</span>
        <span className="text-[var(--text-tertiary)]">/</span>
        <span className="tabular-nums">{writingGoal.dailyTarget.toLocaleString()}</span>
      </div>
      <div className="w-16 h-1.5 rounded-full overflow-hidden bg-[var(--color-surface-base)]">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: progress >= 100
              ? 'linear-gradient(90deg, var(--color-ifline), color-mix(in srgb, var(--color-ifline) 70%, var(--accent-primary)))'
              : 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: EASE.SMOOTH }}
        />
      </div>
      <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">{progress}%</span>
    </motion.div>
  )
}

/* ============================================================
   ENTITY TYPE ICONS (matching CategorySection)
   ============================================================ */

const typeIcons: Record<string, React.ReactNode> = {
  world: <Globe />,
  character: <User />,
  item: <Package />,
  location: <MapPin />,
  faction: <Shield />,
  rule: <Scale />,
}

const typeLabels: Record<string, string> = {
  world: '世界观',
  character: '角色',
  item: '物品',
  location: '地点',
  faction: '势力',
  rule: '规则',
}

/* ============================================================
   COLLECTION PROGRESS
   ============================================================ */

interface TypeProgress {
  type: string
  confirmed: number
  total: number
  percent: number
}

function useCollectionProgress(): TypeProgress[] {
  const extractedEntities = useChatStore((s) => s.extractedEntities)

  return useMemo(() => {
    const displayTypes = ['world', 'character', 'item', 'location', 'faction', 'rule'] as const
    return displayTypes.map((type) => {
      const entitiesOfType = extractedEntities.filter((e: ExtractedEntityLocal) => e.type === type)
      const total = entitiesOfType.length
      const confirmed = entitiesOfType.filter((e: ExtractedEntityLocal) => e.confirmed).length
      const percent = total > 0 ? Math.round((confirmed / total) * 100) : 0
      return { type, confirmed, total, percent }
    })
  }, [extractedEntities])
}

function CollectionProgress() {
  const progressData = useCollectionProgress()
  const hasAnyEntities = progressData.some((p) => p.total > 0)

  if (!hasAnyEntities) return null

  return (
    <motion.div
      className="flex items-center gap-3 flex-wrap"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      {progressData
        .filter((p) => p.total > 0)
        .map((p) => (
          <div key={p.type} className="flex items-center gap-1.5" title={`${typeLabels[p.type] || p.type}: ${p.confirmed}/${p.total} 已确认`}>
            <span
              className="w-3 h-3 flex items-center justify-center [&>svg]:w-3 [&>svg]:h-3"
              style={{ color: typeColors[p.type] || 'var(--text-tertiary)' }}
            >
              {typeIcons[p.type]}
            </span>
            <div className="w-10 h-0.5 rounded-full overflow-hidden bg-[var(--color-surface-base)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${p.percent}%`,
                  background: `linear-gradient(90deg, ${typeColors[p.type] || 'var(--accent-primary)'}, color-mix(in srgb, ${typeColors[p.type] || 'var(--accent-primary)'} 60%, white))`,
                }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-[var(--text-tertiary)]">{p.percent}%</span>
          </div>
        ))}
    </motion.div>
  )
}

/* ============================================================
   AI STATUS INDICATOR
   ============================================================ */

type AiStatus = 'thinking' | 'streaming' | 'idle' | 'extracting' | 'error'

function useAiStatus(): { status: AiStatus; label: string } {
  const isLoading = useChatStore((s) => s.isLoading)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const error = useChatStore((s) => s.error)
  const extractionState = useChatStore((s) => s.extractionState)

  if (error) return { status: 'error', label: 'AI 请求出错' }
  if (isStreaming) return { status: 'streaming', label: 'AI 正在生成回复' }
  if (isLoading && !isStreaming) return { status: 'thinking', label: 'AI 正在思考' }
  if (extractionState === 'extracting') return { status: 'extracting', label: '正在提取实体' }
  return { status: 'idle', label: 'AI 正在引导你完善故事设定' }
}

function AiStatusIndicator() {
  const { status, label } = useAiStatus()

  const dotStyle: React.CSSProperties = (() => {
    switch (status) {
      case 'error':
        return { backgroundColor: 'var(--color-error, #dc2626)' }
      case 'thinking':
      case 'streaming':
      case 'extracting':
        return { backgroundColor: 'var(--accent-primary)' }
      case 'idle':
      default:
        return { backgroundColor: 'var(--color-ifline, #7a9e58)' }
    }
  })()

  const dotAnimation = (() => {
    switch (status) {
      case 'thinking':
        return { opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }
      case 'streaming':
        return { opacity: [0.6, 1, 0.6], y: [-1, 1, -1] }
      case 'extracting':
        return { rotate: [0, 360] }
      default:
        return {}
    }
  })()

  const dotTransition = (() => {
    switch (status) {
      case 'thinking':
        return { duration: 2, repeat: Infinity, ease: 'easeInOut' as const }
      case 'streaming':
        return { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const }
      case 'extracting':
        return { duration: 1.5, repeat: Infinity, ease: 'linear' as const }
      default:
        return { duration: 0 }
    }
  })()

  return (
    <motion.div
      className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hidden sm:flex"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.35, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      <motion.div
        className="w-1.5 h-1.5 rounded-full"
        style={dotStyle}
        animate={dotAnimation}
        transition={dotTransition}
      />
      <span>{label}</span>
    </motion.div>
  )
}

/* ============================================================
   CHAT FOOTER
   ============================================================ */

export function ChatFooter() {
  return (
    <motion.footer
      className="h-[var(--layout-topbar-height)] flex items-center justify-between px-2 sm:px-4 shrink-0 relative z-20
                 bg-[var(--color-surface-raised)]"
      style={{
        boxShadow: `
          0 -6px 30px color-mix(in srgb, var(--ink-100) 12%, transparent),
          0 -1px 0 color-mix(in srgb, var(--accent-100) 15%, transparent) inset
        `,
      }}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Top gradient divider decoration */}
      <TopGradientDivider />

      {/* Left: AI status indicator + Collection progress */}
      <div className="flex items-center gap-3 min-w-0">
        <AiStatusIndicator />
        <CollectionProgress />
      </div>

      {/* Center: Word count stats */}
      <div className="hidden md:flex">
        <WordCountDisplay />
      </div>

      {/* Right: Writing goal progress */}
      <div className="hidden sm:flex">
        <WritingGoalProgress />
      </div>
    </motion.footer>
  )
}

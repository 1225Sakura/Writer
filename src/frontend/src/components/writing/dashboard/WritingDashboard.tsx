import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Target, Grid3X3, Activity, X } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { useWritingStore } from '@/store/writingStore'
import { GoalProgressRing } from './GoalProgressRing'
import { WritingHeatmap } from './WritingHeatmap'
import { SessionStats } from './SessionStats'

// ============================================
// Types
// ============================================

type DashboardTab = 'session' | 'goals' | 'heatmap'

interface TabDef {
  id: DashboardTab
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { id: 'session', label: '会话', icon: <Activity className="w-3 h-3" /> },
  { id: 'goals', label: '目标', icon: <Target className="w-3 h-3" /> },
  { id: 'heatmap', label: '热力图', icon: <Grid3X3 className="w-3 h-3" /> },
]

// ============================================
// Sub-tabs
// ============================================

function GoalsTab() {
  const wordCount = useWritingStore((s) => s.wordCount)
  const todayWordCount = useWritingStore((s) => s.getTodayWordCount())
  const chapterTarget = useWritingStore((s) => s.chapterTargetWordCount)
  const dailyTarget = useWritingStore((s) => s.dailyTargetWordCount)
  const globalTarget = useWritingStore((s) => s.targetWordCount)
  const dailyStats = useWritingStore((s) => s.dailyStats)

  const totalWords = dailyStats.reduce((sum, d) => sum + d.wordCount, 0)

  return (
    <div className="px-3 py-3 space-y-3">
      <div className="flex items-center justify-around">
        <GoalProgressRing
          current={wordCount}
          target={chapterTarget}
          label="本章"
          size={72}
        />
        <GoalProgressRing
          current={todayWordCount}
          target={dailyTarget}
          label="今日"
          size={72}
        />
        <GoalProgressRing
          current={totalWords}
          target={globalTarget}
          label="总计"
          size={72}
        />
      </div>
    </div>
  )
}

function HeatmapTab() {
  const dailyStats = useWritingStore((s) => s.dailyStats)
  const [range, setRange] = useState<30 | 90 | 365>(30)

  const days = dailyStats.map((d) => ({
    date: d.date,
    wordCount: d.wordCount,
  }))

  return (
    <div>
      {/* Range selector */}
      <div className="flex items-center gap-1 px-3 pt-2">
        {([30, 90, 365] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
            style={{
              background:
                range === r
                  ? 'color-mix(in srgb, var(--paper-100) 8%, transparent)'
                  : 'transparent',
              color:
                range === r
                  ? 'var(--text-primary)'
                  : 'var(--text-muted)',
            }}
          >
            {r === 30 ? '30天' : r === 90 ? '90天' : '一年'}
          </button>
        ))}
      </div>
      <WritingHeatmap days={days} range={range} />
    </div>
  )
}

// ============================================
// WritingDashboard
// ============================================

interface WritingDashboardProps {
  open: boolean
  onClose: () => void
}

export function WritingDashboard({ open, onClose }: WritingDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('session')

  const handleTabClick = useCallback((tab: DashboardTab) => {
    setActiveTab(tab)
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="writing-dashboard"
          initial={{ opacity: 0, x: 16, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 16, scale: 0.97 }}
          transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
          className="flex flex-col w-[280px] max-h-[480px] rounded-xl overflow-hidden"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--ink-100) 95%, transparent) 0%, color-mix(in srgb, var(--ink-100) 98%, transparent) 100%)',
            border: '1px solid color-mix(in srgb, var(--paper-100) 5%, transparent)',
            boxShadow:
              '0 4px 20px color-mix(in srgb, var(--ink-100) 25%, transparent), 0 8px 40px color-mix(in srgb, var(--ink-100) 15%, transparent), inset 0 1px 0 color-mix(in srgb, var(--paper-100) 4%, transparent)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 flex-shrink-0"
            style={{
              borderBottom:
                '1px solid color-mix(in srgb, var(--paper-100) 4%, transparent)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <LayoutDashboard
                className="w-3.5 h-3.5"
                style={{ color: 'var(--accent-100)' }}
              />
              <span
                className="text-xs font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                写作仪表盘
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-5 h-5 rounded-md transition-colors"
              style={{
                color: 'var(--text-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background =
                  'color-mix(in srgb, var(--paper-100) 8%, transparent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Tab bar */}
          <div
            className="flex items-center gap-0.5 px-2 py-1.5 flex-shrink-0"
            style={{
              borderBottom:
                '1px solid color-mix(in srgb, var(--paper-100) 4%, transparent)',
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
                style={{
                  background:
                    activeTab === tab.id
                      ? 'color-mix(in srgb, var(--paper-100) 8%, transparent)'
                      : 'transparent',
                  color:
                    activeTab === tab.id
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            <AnimatePresence mode="wait">
              {activeTab === 'session' && (
                <motion.div
                  key="session"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DURATION.FAST }}
                >
                  <SessionStats />
                </motion.div>
              )}

              {activeTab === 'goals' && (
                <motion.div
                  key="goals"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DURATION.FAST }}
                >
                  <GoalsTab />
                </motion.div>
              )}

              {activeTab === 'heatmap' && (
                <motion.div
                  key="heatmap"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DURATION.FAST }}
                >
                  <HeatmapTab />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

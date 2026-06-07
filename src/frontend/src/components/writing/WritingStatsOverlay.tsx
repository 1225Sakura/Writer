import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Target, Grid3X3, Trophy } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { StatsHeader } from './StatsHeader'
import { StatsGrid } from './StatsGrid'
import { StatsChart } from './StatsChart'
import { GoalProgressRing } from './GoalProgressRing'
import { WritingHeatmap } from './WritingHeatmap'
import { AchievementSystem } from './AchievementSystem'
import { useWritingStore } from '@/store/writingStore'
import type { DailyStats } from '@/store/writingStore'

type TabId = 'stats' | 'goals' | 'heatmap' | 'achievements'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { id: 'stats', label: '统计', icon: <Zap className="w-3 h-3" /> },
  { id: 'goals', label: '目标', icon: <Target className="w-3 h-3" /> },
  { id: 'heatmap', label: '热力图', icon: <Grid3X3 className="w-3 h-3" /> },
  { id: 'achievements', label: '成就', icon: <Trophy className="w-3 h-3" /> },
]

interface WritingStatsOverlayProps {
  wordCount: number
  sessionWPM: number
  sessionDuration: number
  todayWordCount: number
  targetWordCount: number
}

export function WritingStatsOverlay({
  wordCount,
  sessionWPM,
  sessionDuration,
  todayWordCount,
  targetWordCount,
}: WritingStatsOverlayProps) {
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('stats')
  const [lastWordCount, setLastWordCount] = useState(wordCount)
  const [burstWPM, setBurstWPM] = useState(0)

  const chapterTarget = useWritingStore((s) => s.chapterTargetWordCount)
  const dailyTarget = useWritingStore((s) => s.dailyTargetWordCount)
  const dailyStats = useWritingStore((s) => s.dailyStats)

  // Track burst writing speed
  useEffect(() => {
    const delta = wordCount - lastWordCount
    if (delta > 0) {
      setBurstWPM(Math.round(delta * 12))
    }
    setLastWordCount(wordCount)
  }, [wordCount])

  // Reset burst WPM after inactivity
  useEffect(() => {
    if (burstWPM === 0) return
    const timeout = setTimeout(() => {
      setBurstWPM(0)
    }, 6000)
    return () => clearTimeout(timeout)
  }, [burstWPM])

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const toggleVisible = useCallback(() => {
    setVisible((prev) => !prev)
  }, [])

  return (
    <>
      {/* Toggle button when collapsed */}
      <AnimatePresence>
        {!visible && (
          <motion.button
            key="stats-toggle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            onClick={toggleVisible}
            className="fixed left-4 bottom-16 z-50 flex items-center justify-center w-8 h-8 rounded-full
                       bg-[var(--color-surface-raised)] border border-[var(--border-default)]
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       hover:bg-[var(--border-subtle)] transition-all duration-200
                       shadow-lg"
            title="显示写作统计"
          >
            <Zap className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible && (
          <motion.div
            key="stats-overlay"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            className={`fixed left-4 bottom-16 z-50 flex flex-col
                       rounded-xl overflow-hidden
                       ${expanded ? 'min-w-[240px]' : 'min-w-[160px]'}`}
            style={{
              background: `linear-gradient(180deg, color-mix(in srgb, var(--ink-100) 95%, transparent) 0%, color-mix(in srgb, var(--ink-100) 98%, transparent) 100%)`,
              border: '1px solid color-mix(in srgb, var(--paper-100) 5%, transparent)',
              boxShadow: '0 4px 20px color-mix(in srgb, var(--ink-100) 25%, transparent), 0 8px 40px color-mix(in srgb, var(--ink-100) 15%, transparent), inset 0 1px 0 color-mix(in srgb, var(--paper-100) 4%, transparent)',
            }}
          >
            <StatsHeader
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              onToggleVisible={toggleVisible}
            />

            {/* Compact view: just stats grid */}
            {!expanded && (
              <StatsGrid wordCount={wordCount} sessionWPM={sessionWPM} />
            )}

            {/* Expanded view: tabbed content */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                  className="overflow-hidden"
                >
                  {/* Tab bar */}
                  <div
                    className="flex items-center gap-0.5 px-2 py-1.5"
                    style={{
                      borderBottom: '1px solid color-mix(in srgb, var(--paper-100) 4%, transparent)',
                    }}
                  >
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
                        style={{
                          background: activeTab === tab.id
                            ? 'color-mix(in srgb, var(--paper-100) 8%, transparent)'
                            : 'transparent',
                          color: activeTab === tab.id
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
                  <div className="max-h-[320px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {activeTab === 'stats' && (
                      <div>
                        <StatsGrid wordCount={wordCount} sessionWPM={sessionWPM} />
                        <StatsChart
                          wordCount={wordCount}
                          todayWordCount={todayWordCount}
                          targetWordCount={targetWordCount}
                          sessionDuration={sessionDuration}
                          burstWPM={burstWPM}
                        />
                      </div>
                    )}

                    {activeTab === 'goals' && (
                      <GoalsTab
                        wordCount={wordCount}
                        todayWordCount={todayWordCount}
                        chapterTarget={chapterTarget}
                        dailyTarget={dailyTarget}
                        globalTarget={targetWordCount}
                        dailyStats={dailyStats}
                      />
                    )}

                    {activeTab === 'heatmap' && (
                      <HeatmapTab dailyStats={dailyStats} />
                    )}

                    {activeTab === 'achievements' && (
                      <AchievementSystem dailyStats={dailyStats} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ---- Tab Content Sub-components ---- */

interface GoalsTabProps {
  wordCount: number
  todayWordCount: number
  chapterTarget: number
  dailyTarget: number
  globalTarget: number
  dailyStats: DailyStats[]
}

function GoalsTab({
  wordCount,
  todayWordCount,
  chapterTarget,
  dailyTarget,
  globalTarget,
  dailyStats,
}: GoalsTabProps) {
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

interface HeatmapTabProps {
  dailyStats: DailyStats[]
}

function HeatmapTab({ dailyStats }: HeatmapTabProps) {
  const [range, setRange] = useState<30 | 90 | 365>(90)

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
              background: range === r
                ? 'color-mix(in srgb, var(--paper-100) 8%, transparent)'
                : 'transparent',
              color: range === r
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

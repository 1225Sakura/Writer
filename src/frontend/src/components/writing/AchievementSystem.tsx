import { useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Flame, Star, Crown, Sparkles } from 'lucide-react'
import { EASE } from '@/components/shared/AnimationConfig'
import type { DailyStats } from '@/store/writingStore'

interface AchievementSystemProps {
  dailyStats: DailyStats[]
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  unlocked: boolean
  unlockedAt?: string
  category: 'streak' | 'milestone' | 'daily'
}

function calculateStreaks(dailyStats: DailyStats[]): {
  currentStreak: number
  longestStreak: number
} {
  if (dailyStats.length === 0) return { currentStreak: 0, longestStreak: 0 }

  // Sort by date descending
  const sorted = [...dailyStats]
    .filter((d) => d.wordCount > 0)
    .map((d) => d.date)
    .sort()
    .reverse()

  if (sorted.length === 0) return { currentStreak: 0, longestStreak: 0 }

  // Current streak: count consecutive days ending today or yesterday
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  let currentStreak = 0
  if (sorted[0] === today || sorted[0] === yesterday) {
    const activeSet = new Set(sorted)
    const checkDate = new Date(sorted[0])
    while (activeSet.has(checkDate.toISOString().split('T')[0])) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    }
  }

  // Longest streak
  let longestStreak = 1
  let streak = 1
  const dateSet = new Set(sorted)
  const allDates = [...dateSet].sort()

  for (let i = 1; i < allDates.length; i++) {
    const prev = new Date(allDates[i - 1])
    const curr = new Date(allDates[i])
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff === 1) {
      streak++
      longestStreak = Math.max(longestStreak, streak)
    } else {
      streak = 1
    }
  }

  return { currentStreak, longestStreak }
}

function useAchievements(dailyStats: DailyStats[]): Achievement[] {
  return useMemo(() => {
    const { longestStreak } = calculateStreaks(dailyStats)
    const totalWords = dailyStats.reduce((sum, d) => sum + d.wordCount, 0)
    const maxDailyWords = dailyStats.reduce((max, d) => Math.max(max, d.wordCount), 0)

    const streakMilestones = [
      { days: 3, title: '初露锋芒', desc: '连续写作3天' },
      { days: 7, title: '笔耕不辍', desc: '连续写作7天' },
      { days: 30, title: '铁杵磨针', desc: '连续写作30天' },
      { days: 100, title: '百日如一', desc: '连续写作100天' },
    ]

    const wordMilestones = [
      { words: 10000, title: '万字初成', desc: '总字数达到1万' },
      { words: 50000, title: '五万言志', desc: '总字数达到5万' },
      { words: 100000, title: '十万大山', desc: '总字数达到10万' },
      { words: 500000, title: '百万雄文', desc: '总字数达到50万' },
      { words: 1000000, title: '著作等身', desc: '总字数达到100万' },
    ]

    const dailyMilestones = [
      { words: 1000, title: '千字文', desc: '单日写作超过1000字' },
      { words: 3000, title: '三千字令', desc: '单日写作超过3000字' },
      { words: 5000, title: '五千字赋', desc: '单日写作超过5000字' },
      { words: 10000, title: '万字长歌', desc: '单日写作超过10000字' },
    ]

    const streakIcon = <Flame className="w-4 h-4" />
    const wordIcon = <Star className="w-4 h-4" />
    const dailyIcon = <Crown className="w-4 h-4" />

    const achievements: Achievement[] = []

    // Streak achievements
    for (const m of streakMilestones) {
      const unlocked = longestStreak >= m.days
      achievements.push({
        id: `streak-${m.days}`,
        title: m.title,
        description: m.desc,
        icon: streakIcon,
        unlocked,
        category: 'streak',
      })
    }

    // Word milestones
    for (const m of wordMilestones) {
      const unlocked = totalWords >= m.words
      achievements.push({
        id: `words-${m.words}`,
        title: m.title,
        description: m.desc,
        icon: wordIcon,
        unlocked,
        category: 'milestone',
      })
    }

    // Daily milestones
    for (const m of dailyMilestones) {
      const unlocked = maxDailyWords >= m.words
      achievements.push({
        id: `daily-${m.words}`,
        title: m.title,
        description: m.desc,
        icon: dailyIcon,
        unlocked,
        category: 'daily',
      })
    }

    return achievements
  }, [dailyStats])
}

/** Sparkle/confetti celebration particles */
function CelebrationParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 60,
      y: -Math.random() * 40 - 10,
      rotate: Math.random() * 360,
      scale: 0.4 + Math.random() * 0.6,
      delay: Math.random() * 0.3,
    }))
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2"
          initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: [1, 1, 0],
            scale: [0, p.scale, 0],
            rotate: p.rotate,
          }}
          transition={{
            duration: 0.8,
            delay: p.delay,
            ease: EASE.SMOOTH,
          }}
        >
          <Sparkles
            className="w-2.5 h-2.5"
            style={{ color: 'var(--color-character)' }}
          />
        </motion.div>
      ))}
    </div>
  )
}

export function AchievementSystem({ dailyStats }: AchievementSystemProps) {
  const achievements = useAchievements(dailyStats)
  const [celebratingId, setCelebratingId] = useState<string | null>(null)

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const totalCount = achievements.length

  const handleCelebrate = useCallback((id: string) => {
    setCelebratingId(id)
    setTimeout(() => setCelebratingId(null), 1200)
  }, [])

  // Group by category
  const groups = useMemo(() => {
    const streak = achievements.filter((a) => a.category === 'streak')
    const milestone = achievements.filter((a) => a.category === 'milestone')
    const daily = achievements.filter((a) => a.category === 'daily')
    return [
      { label: '连续写作', items: streak },
      { label: '总字数里程碑', items: milestone },
      { label: '单日记录', items: daily },
    ]
  }, [achievements])

  return (
    <div className="px-3 py-2 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--color-character)' }} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            成就
          </span>
        </div>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {unlockedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{
          background: 'color-mix(in srgb, var(--paper-100) 4%, transparent)',
        }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, var(--color-character), var(--color-ifline))',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
          transition={{ duration: 0.8, ease: EASE.SMOOTH }}
        />
      </div>

      {/* Achievement groups */}
      {groups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {group.label}
          </span>
          <div className="space-y-1">
            {group.items.map((achievement) => (
              <motion.button
                key={achievement.id}
                className="relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors"
                style={{
                  background: achievement.unlocked
                    ? 'color-mix(in srgb, var(--color-character) 8%, transparent)'
                    : 'color-mix(in srgb, var(--paper-100) 2%, transparent)',
                  border: `1px solid ${
                    achievement.unlocked
                      ? 'color-mix(in srgb, var(--color-character) 15%, transparent)'
                      : 'color-mix(in srgb, var(--paper-100) 4%, transparent)'
                  }`,
                  opacity: achievement.unlocked ? 1 : 0.5,
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => achievement.unlocked && handleCelebrate(achievement.id)}
              >
                {/* Icon */}
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                  style={{
                    background: achievement.unlocked
                      ? 'color-mix(in srgb, var(--color-character) 15%, transparent)'
                      : 'color-mix(in srgb, var(--paper-100) 3%, transparent)',
                    color: achievement.unlocked
                      ? 'var(--color-character)'
                      : 'var(--text-muted)',
                  }}
                >
                  {achievement.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[11px] font-medium leading-tight"
                    style={{
                      color: achievement.unlocked
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                    }}
                  >
                    {achievement.title}
                  </div>
                  <div
                    className="text-[10px] leading-tight mt-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {achievement.description}
                  </div>
                </div>

                {/* Unlock indicator */}
                {achievement.unlocked && (
                  <div
                    className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{
                      background: 'color-mix(in srgb, var(--color-ifline) 20%, transparent)',
                    }}
                  >
                    <span className="text-[8px]" style={{ color: 'var(--color-ifline)' }}>
                      &#10003;
                    </span>
                  </div>
                )}

                {/* Celebration particles */}
                <AnimatePresence>
                  {celebratingId === achievement.id && <CelebrationParticles />}
                </AnimatePresence>
              </motion.button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

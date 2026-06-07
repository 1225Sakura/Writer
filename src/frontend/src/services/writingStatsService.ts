/**
 * WritingStatsService - 字数统计和写作目标计算服务
 *
 * 提供中英文混合字数统计、会话字数计算、连续天数统计等功能。
 */

// ============================================
// Types
// ============================================

export interface WritingStats {
  totalChars: number
  todayChars: number
  sessionChars: number
  avgMessageChars: number
  streakDays: number
}

export interface WritingGoal {
  dailyTarget: number
  currentProgress: number
  lastActiveDate: string
}

// ============================================
// Character Counting
// ============================================

/**
 * 统计中英文混合字数
 * - 中文字符：每个字符计为1字
 * - 英文单词：按空格分隔的单词计为1字
 * - 标点符号：不计入字数
 */
export function countChars(text: string): number {
  if (!text) return 0

  // 移除空白字符
  const trimmed = text.trim()
  if (!trimmed) return 0

  // 统计中文字符（Unicode 范围）
  const chineseChars = trimmed.match(/[一-鿿㐀-䶿豈-﫿]/g)
  const chineseCount = chineseChars ? chineseChars.length : 0

  // 统计英文单词（移除中文和标点后，按空格分隔）
  const withoutChinese = trimmed.replace(/[一-鿿㐀-䶿豈-﫿]/g, ' ')
  const withoutPunctuation = withoutChinese.replace(/[^\w\s]/g, ' ')
  const words = withoutPunctuation.split(/\s+/).filter(w => w.length > 0)
  const englishCount = words.length

  return chineseCount + englishCount
}

/**
 * 统计消息列表的总字数
 */
export function calculateTotalChars(messages: { content: string }[]): number {
  return messages.reduce((sum, msg) => sum + countChars(msg.content), 0)
}

/**
 * 统计今日字数
 */
export function calculateTodayChars(messages: { createdAt: number }[]): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.getTime()

  return messages
    .filter(msg => msg.createdAt >= todayStart)
    .reduce((sum, msg) => sum + countChars((msg as any).content), 0)
}

// ============================================
// Streak Calculation
// ============================================

/**
 * 计算连续写作天数
 * @param activeDates 活跃日期数组，格式 "YYYY-MM-DD"
 * @returns 连续天数
 */
export function calculateStreak(activeDates: string[]): number {
  if (activeDates.length === 0) return 0

  // 去重并排序
  const uniqueDates = Array.from(new Set(activeDates)).sort().reverse()
  if (uniqueDates.length === 0) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDate(today)

  // 检查今天或昨天是否有活跃记录
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatDate(yesterday)

  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
    return 0 // 连续中断
  }

  let streak = 1
  let currentDate = new Date(uniqueDates[0])

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(currentDate)
    prevDate.setDate(prevDate.getDate() - 1)
    const prevDateStr = formatDate(prevDate)

    if (uniqueDates[i] === prevDateStr) {
      streak++
      currentDate = prevDate
    } else {
      break
    }
  }

  return streak
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取今天的日期字符串
 */
export function getTodayString(): string {
  return formatDate(new Date())
}

/**
 * 更新活跃日期列表（保持最近30天）
 */
export function updateActiveDates(activeDates: string[], newDate: string): string[] {
  const uniqueDates = Array.from(new Set([...activeDates, newDate])).sort().reverse()
  // 只保留最近30天
  return uniqueDates.slice(0, 30)
}

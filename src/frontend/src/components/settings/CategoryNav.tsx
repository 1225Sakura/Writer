import { useUIStore, useSettingsStore, UIState } from '@/store'
import { Button } from '@/components/ui/Button'
import { Globe, Users, Package, MapPin, Shield, BookOpen, FileText, GitBranch, Feather, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMemo } from 'react'

const categories: Array<{ key: UIState['settingsCategory']; label: string; icon: typeof Globe }> = [
  { key: 'world', label: '世界观', icon: Globe },
  { key: 'character', label: '角色', icon: Users },
  { key: 'item', label: '物品', icon: Package },
  { key: 'location', label: '地点', icon: MapPin },
  { key: 'faction', label: '势力', icon: Shield },
  { key: 'rule', label: '规则', icon: BookOpen },
  { key: 'outline', label: '大纲', icon: FileText },
  { key: 'ifline', label: 'IF线', icon: GitBranch },
]

// Categories that support AI review
const reviewableCategories = ['world', 'character', 'item', 'location', 'faction', 'rule']

// Color system
const categoryColors: Record<string, string> = {
  world: '#5e6ad2',
  character: '#e8b87d',
  item: '#9b7ed9',
  location: '#5eb5a6',
  faction: '#d45d5d',
  rule: '#7eb84a',
  outline: '#5b8ee8',
  ifline: '#7eb84a',
}

const categoryGlowColors: Record<string, string> = {
  world: 'rgba(94,106,210,0.15)',
  character: 'rgba(232,184,125,0.15)',
  item: 'rgba(155,126,217,0.15)',
  location: 'rgba(94,181,166,0.15)',
  faction: 'rgba(212,93,93,0.15)',
  rule: 'rgba(126,184,74,0.15)',
  outline: 'rgba(91,142,232,0.15)',
  ifline: 'rgba(126,184,74,0.15)',
}

// Animated counter for badge counts
function CountBadge({ count, color }: { count: number; color: string }) {
  return (
    <motion.span
      key={count}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium min-w-[20px] text-center"
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {count}
    </motion.span>
  )
}

export function CategoryNav() {
  const { settingsCategory, setSettingsCategory } = useUIStore()
  const generate = useSettingsStore((state) => state.generate)
  const loadCategoryData = useSettingsStore((state) => state.loadCategoryData)
  const reviewWithAI = useSettingsStore((state) => state.reviewWithAI)
  const isLoading = useSettingsStore((state) => state.isLoading)

  // Get entity counts for badges
  const counts = useSettingsStore((state) => ({
    world: state.worldSettings.length,
    character: state.characters.length,
    item: state.items.length,
    location: state.locations.length,
    faction: state.factions.length,
    rule: state.rules.length,
    outline: state.chapters.length,
    ifline: state.ifLines.length,
  }))

  const handleCategoryChange = (key: UIState['settingsCategory']) => {
    setSettingsCategory(key)
    loadCategoryData(key)
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      {/* Header */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          设定编辑
        </h2>
        <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
          管理你的世界观、角色、物品等
        </p>
      </div>

      {/* Navigation list with rich interactions */}
      <nav className="flex-1 overflow-y-auto py-3">
        {categories.map(({ key, label, icon: Icon }) => {
          const isActive = settingsCategory === key
          const color = categoryColors[key]
          const glowColor = categoryGlowColors[key]
          const count = counts[key]

          return (
            <motion.button
              key={key}
              onClick={() => handleCategoryChange(key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 mb-0.5 text-left relative overflow-hidden group"
              initial={false}
              animate={isActive ? { backgroundColor: glowColor } : { backgroundColor: 'transparent' }}
              transition={{ duration: 0.2 }}
              whileHover={!isActive ? { backgroundColor: 'rgba(255,255,255,0.04)' } : {}}
            >
              {/* Active left border with glow */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    className="absolute left-0 top-1/2 -translate-y-1/2"
                    layoutId="category-active-indicator"
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    style={{
                      width: '3px',
                      height: '20px',
                      backgroundColor: color,
                      borderRadius: '0 2px 2px 0',
                      boxShadow: `0 0 8px ${color}, 0 0 16px ${color}40`,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </AnimatePresence>

              {/* Hover slide indicator */}
              {!isActive && (
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
                  initial={{ x: -4 }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    width: '3px',
                    height: '12px',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}

              {/* Icon with animation */}
              <motion.div
                initial={false}
                animate={isActive ? { scale: 1.15, rotate: [0, -5, 5, 0] } : { scale: 1, rotate: 0 }}
                transition={{
                  scale: { type: 'spring', stiffness: 400, damping: 25 },
                  rotate: { duration: 0.4, ease: 'easeInOut' },
                }}
                className="relative"
              >
                <Icon
                  className="w-4 h-4 flex-shrink-0 transition-colors duration-200"
                  style={{ color: isActive ? color : 'var(--color-text-muted)' }}
                />
                {/* Icon glow effect when active */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    style={{ color }}
                  >
                    <Icon className="w-4 h-4" />
                  </motion.div>
                )}
              </motion.div>

              {/* Label */}
              <motion.span
                className="text-sm font-medium flex-1"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--color-text-secondary)' }}
                initial={false}
                animate={isActive ? { x: 2 } : { x: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {label}
              </motion.span>

              {/* Count badge */}
              {count > 0 && (
                <CountBadge count={count} color={isActive ? color : '#6b7280'} />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* Footer: AI tools */}
      <div className="p-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
        <AnimatePresence mode="wait">
          {reviewableCategories.includes(settingsCategory) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onClick={() => reviewWithAI(settingsCategory as 'world' | 'character' | 'item' | 'location' | 'faction' | 'rule')}
                variant="ghost"
                size="md"
                className="w-full group"
                disabled={isLoading}
              >
                <motion.div
                  className="flex items-center gap-2"
                  whileHover={{ x: 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Feather className="w-4 h-4 transition-transform group-hover:rotate-12" />
                  <span>AI审查</span>
                </motion.div>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          onClick={() => {
            if (settingsCategory !== 'outline' && settingsCategory !== 'ifline') {
              generate(settingsCategory as 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule')
            }
          }}
          variant="ghost"
          size="md"
          className="w-full group"
          disabled={isLoading}
        >
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ x: 2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Sparkles className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span>智能生成</span>
          </motion.div>
        </Button>
      </div>
    </div>
  )
}

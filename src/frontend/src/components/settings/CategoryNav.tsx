import { useUIStore, useSettingsStore, UIState } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import { Feather, Sparkles } from 'lucide-react'
import { EntityIcon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { EASE, DURATION, SPRING } from '@/components/shared/AnimationConfig'

const categories: Array<{ key: UIState['settingsCategory']; label: string; iconType: Parameters<typeof EntityIcon>[0]['type'] }> = [
  { key: 'world', label: '世界观', iconType: 'world' },
  { key: 'character', label: '角色', iconType: 'character' },
  { key: 'item', label: '物品', iconType: 'item' },
  { key: 'location', label: '地点', iconType: 'location' },
  { key: 'faction', label: '势力', iconType: 'faction' },
  { key: 'rule', label: '规则', iconType: 'rule' },
  { key: 'outline', label: '大纲', iconType: 'outline' },
  { key: 'ifline', label: 'IF线', iconType: 'ifline' },
]

const reviewableCategories = ['world', 'character', 'item', 'location', 'faction', 'rule']

const categoryColorVars: Record<string, string> = {
  world: 'var(--color-world)',
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  rule: 'var(--color-rule)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
}

function CountBadge({ count, color, isActive }: { count: number; color: string; isActive: boolean }) {
  return (
    <motion.span
      key={count}
      initial={{ scale: 0.6, opacity: 0, y: -4 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.6, opacity: 0, y: -4 }}
      transition={SPRING.BADGE}
      className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium min-w-[20px] text-center"
      style={{
        backgroundColor: isActive ? `${color}20` : 'var(--color-surface-overlay)',
        color: isActive ? color : 'var(--text-tertiary)',
        border: `1px solid ${isActive ? `${color}30` : 'transparent'}`,
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

  const counts = useSettingsStore(useShallow((state) => ({
    world: state.worldSettings.length,
    character: state.characters.length,
    item: state.items.length,
    location: state.locations.length,
    faction: state.factions.length,
    rule: state.rules.length,
    outline: state.chapters.length,
    ifline: state.ifLines.length,
  })))

  const handleCategoryChange = (key: UIState['settingsCategory']) => {
    setSettingsCategory(key)
    loadCategoryData(key)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-base)]">
      {/* Header - clean with subtle glass effect */}
      <div className="px-4 py-4 border-b border-[var(--border-subtle)]">
        <h2 className="font-semibold text-sm text-[var(--text-primary)]">
          设定编辑
        </h2>
        <p className="text-[11px] mt-1 text-[var(--text-tertiary)]">
          管理你的世界观、角色、物品等
        </p>
      </div>

      {/* Navigation list with enhanced visual hierarchy */}
      <nav className="flex-1 overflow-y-auto py-2 category-nav-scroll">
        <AnimatePresence>
          {categories.map(({ key, label, iconType }, index) => {
            const isActive = settingsCategory === key
            const color = categoryColorVars[key]
            const count = counts[key]

            return (
              <motion.button
                key={key}
                onClick={() => handleCategoryChange(key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleCategoryChange(key)
                  }
                }}
                className={`
                  w-full flex items-center gap-3 text-left relative overflow-hidden group cursor-pointer
                  mx-2 px-3 py-2.5 mb-1 rounded-lg touch-target-min
                  transition-all duration-200 ease-out
                  border-0 bg-transparent
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-100)] focus-visible:ring-offset-2 focus-visible:ring-inset
                `}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: DURATION.SLOW,
                  delay: index * 0.04,
                  ease: EASE.OUT,
                }}
                whileHover={isActive ? {} : { x: 2 }}
                whileTap={{ scale: 0.98 }}
                style={isActive ? {
                  backgroundColor: `${color}12`,
                } : undefined}
                role="tab"
                aria-pressed={isActive}
                aria-label={`${label}分类，当前${isActive ? '选中' : '未选中'}`}
                tabIndex={0}
              >
                {/* Active indicator - animated left border with glow */}
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  initial={false}
                  animate={{
                    width: isActive ? 3 : 0,
                    height: isActive ? 20 : 0,
                    opacity: isActive ? 1 : 0,
                  }}
                  transition={SPRING.SNAPPY}
                  style={{
                    background: isActive ? color : 'transparent',
                    boxShadow: isActive ? `0 0 8px ${color}60` : 'none',
                  }}
                />

                {/* Hover indicator - subtle left accent */}
                {!isActive && (
                  <motion.div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 rounded-r-full pointer-events-none"
                    initial={{ height: 0, opacity: 0 }}
                    whileHover={{ height: 12, opacity: 1 }}
                    transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                    style={{ backgroundColor: `${color}50` }}
                  />
                )}

                {/* Icon wrapper with entity color coding */}
                <motion.div
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: isActive ? `${color}15` : 'transparent',
                    border: isActive ? `1px solid ${color}25` : '1px solid transparent',
                  }}
                  whileHover={!isActive ? {
                    backgroundColor: `${color}10`,
                    borderColor: `${color}20`,
                  } : {}}
                >
                  <EntityIcon
                    type={iconType}
                    size="sm"
                    className="transition-all duration-200"
                    style={{
                      color: isActive ? color : 'var(--text-tertiary)',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                </motion.div>

                {/* Label with active weight transition */}
                <span
                  className="text-sm truncate transition-all duration-200"
                  style={{
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {label}
                </span>

                {/* Count badge with entity color */}
                {count > 0 && (
                  <CountBadge count={count} color={color} isActive={isActive} />
                )}

                {/* Active background glow */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 pointer-events-none rounded-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      background: `radial-gradient(ellipse at 30% 50%, ${color}08 0%, transparent 70%)`,
                    }}
                  />
                )}
              </motion.button>
            )
          })}
        </AnimatePresence>
      </nav>

      {/* Footer: AI tools with GlassCard container */}
      <div className="p-3 border-t border-[var(--border-subtle)]">
        <GlassCard
          intensity="light"
          border="subtle"
          variant="default"
          rounded="lg"
          padding="sm"
          className="space-y-1.5"
        >
          <AnimatePresence mode="wait">
            {reviewableCategories.includes(settingsCategory) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DURATION.NORMAL, ease: EASE.OUT }}
              >
                <motion.button
                  onClick={() => reviewWithAI(settingsCategory as 'world' | 'character' | 'item' | 'location' | 'faction' | 'rule')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-muted)]"
                  disabled={isLoading}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Feather className="w-3.5 h-3.5" />
                  <span>AI审查</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            onClick={() => {
              if (settingsCategory !== 'outline' && settingsCategory !== 'ifline') {
                generate(settingsCategory as 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule')
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--color-character)] hover:bg-[var(--color-character)]/10"
            disabled={isLoading}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>智能生成</span>
          </motion.button>
        </GlassCard>
      </div>
    </div>
  )
}

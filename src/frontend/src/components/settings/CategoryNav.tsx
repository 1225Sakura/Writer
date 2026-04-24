import { useUIStore, useSettingsStore, UIState } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/Button'
import { Feather, Sparkles } from 'lucide-react'
import { EntityIcon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'

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

function CountBadge({ count, color }: { count: number; color: string }) {
  return (
    <motion.span
      key={count}
      initial={{ scale: 0.6, opacity: 0, y: -4 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.6, opacity: 0, y: -4 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium min-w-[20px] text-center"
      style={{
        backgroundColor: `${color}18`,
        color: color,
        boxShadow: `0 0 6px ${color}25`,
        border: `1px solid ${color}20`,
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
    <div className="h-full flex flex-col bg-[var(--color-bg-surface)]">
      {/* Header */}
      <div className="px-4 py-5 relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--accent-100)_40%,transparent)] to-transparent" />
        <h2 className="font-semibold text-base text-[var(--text-primary)]">
          设定编辑
        </h2>
        <p className="text-xs mt-1.5 text-[var(--color-text-muted)]">
          管理你的世界观、角色、物品等
        </p>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 overflow-y-auto py-3 category-nav-scroll">
        <AnimatePresence>
          {categories.map(({ key, label, iconType }, index) => {
            const isActive = settingsCategory === key
            const color = categoryColorVars[key]
            const count = counts[key]

            return (
              <motion.div
                key={key}
                onClick={() => handleCategoryChange(key)}
                className={`
                  w-full flex items-center gap-3 text-left relative overflow-hidden group cursor-pointer
                  px-4 py-2.5 mb-0.5 touch-target-min
                  transition-all duration-200 ease-out
                  ${isActive
                    ? ''
                    : 'hover:bg-[var(--color-surface-hover)] hover:pl-5'
                  }
                `}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.04,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                whileHover={isActive ? {} : { x: 2 }}
                whileTap={{ scale: 0.98 }}
                style={isActive ? {
                  backgroundColor: `${color}12`,
                } : undefined}
              >
                {/* Active accent indicator bar with spring animation */}
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  initial={false}
                  animate={{
                    width: isActive ? 3 : 0,
                    height: isActive ? 20 : 12,
                    opacity: isActive ? 1 : 0,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 28,
                    mass: 0.8,
                  }}
                  style={{
                    backgroundColor: isActive ? color : 'var(--text-tertiary)',
                    boxShadow: isActive ? `0 0 8px ${color}60, 0 0 16px ${color}30` : 'none',
                  }}
                />

                {/* Hover subtle indicator */}
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full pointer-events-none"
                  initial={false}
                  animate={{
                    width: !isActive ? 2 : 0,
                    opacity: !isActive ? 0.5 : 0,
                  }}
                  transition={{ duration: 0.15 }}
                  style={{
                    height: 12,
                    backgroundColor: color,
                  }}
                />

                {/* Icon wrapper with animated background glow */}
                <motion.div
                  className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded-md"
                  animate={isActive ? {
                    backgroundColor: `${color}18`,
                    boxShadow: `0 0 10px ${color}25`,
                  } : {
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <EntityIcon
                    type={iconType}
                    size="sm"
                    className="transition-all duration-200"
                    style={{
                      color: isActive ? color : 'var(--text-tertiary)',
                      filter: isActive ? `drop-shadow(0 0 4px ${color}50)` : 'none',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                </motion.div>

                {/* Label with animated weight */}
                <motion.span
                  className="text-sm font-medium truncate"
                  animate={{
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {label}
                </motion.span>

                {/* Count badge */}
                {count > 0 && (
                  <CountBadge count={count} color={isActive ? color : 'var(--text-tertiary)'} />
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </nav>

      {/* Footer: AI tools with improved animation */}
      <div className="p-4 flex flex-col gap-2 border-t border-[var(--color-border)]">
        <AnimatePresence mode="wait">
          {reviewableCategories.includes(settingsCategory) && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
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
                  <motion.span
                    whileHover={{ rotate: -12 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                  >
                    <Feather className="w-4 h-4" />
                  </motion.span>
                  <span>AI审查</span>
                </motion.div>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
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
              <motion.span
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.span>
              <span>智能生成</span>
            </motion.div>
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

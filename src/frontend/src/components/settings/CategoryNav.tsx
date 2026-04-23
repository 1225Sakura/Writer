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

const categoryGlowColors: Record<string, string> = {
  world: 'rgba(94,106,210,0.12)',
  character: 'rgba(232,184,125,0.12)',
  item: 'rgba(155,126,217,0.12)',
  location: 'rgba(94,181,166,0.12)',
  faction: 'rgba(212,93,93,0.12)',
  rule: 'rgba(126,184,74,0.12)',
  outline: 'rgba(91,142,232,0.12)',
  ifline: 'rgba(126,184,74,0.12)',
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
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(94,106,210,0.4)] to-transparent" />
        <h2 className="font-semibold text-base text-[var(--text-primary)]">
          设定编辑
        </h2>
        <p className="text-xs mt-1.5 text-[var(--color-text-muted)]">
          管理你的世界观、角色、物品等
        </p>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 overflow-y-auto py-3">
        {categories.map(({ key, label, iconType }) => {
          const isActive = settingsCategory === key
          const color = categoryColorVars[key]
          const glowColor = categoryGlowColors[key]
          const count = counts[key]

          return (
            <motion.div
              key={key}
              onClick={() => handleCategoryChange(key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 mb-0.5 text-left relative overflow-hidden group touch-target-min"
              initial={false}
              animate={isActive ? { backgroundColor: glowColor } : { backgroundColor: 'transparent' }}
              transition={{ duration: 0.2 }}
              whileHover={!isActive ? { backgroundColor: 'rgba(255,255,255,0.04)' } : {}}
            >
              {/* Active left border indicator */}
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
                      height: '24px',
                      backgroundColor: color,
                      borderRadius: '0 3px 3px 0',
                      boxShadow: `0 0 6px ${color}, 0 0 12px ${color}35`,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </AnimatePresence>

              {/* Hover indicator */}
              {!isActive && (
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60"
                  initial={{ x: -4 }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    width: '3px',
                    height: '16px',
                    backgroundColor: 'var(--text-tertiary)',
                    borderRadius: '0 3px 3px 0',
                  }}
                />
              )}

              {/* Icon wrapper - fixed size to ensure alignment */}
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <EntityIcon
                  type={iconType}
                  size="sm"
                  className="transition-colors duration-200"
                  style={{ color: isActive ? color : 'var(--text-tertiary)' }}
                />
              </div>

              {/* Label - single line, no animation that affects layout */}
              <span
                className="text-sm font-medium truncate"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              >
                {label}
              </span>

              {/* Count badge */}
              {count > 0 && (
                <CountBadge count={count} color={isActive ? color : 'var(--text-tertiary)'} />
              )}
            </motion.div>
          )
        })}
      </nav>

      {/* Footer: AI tools */}
      <div className="p-4 flex flex-col gap-2 border-t border-[var(--color-border)]">
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

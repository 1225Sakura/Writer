import { useUIStore, useSettingsStore, UIState } from '@/store'
import { Button } from '@/components/ui/Button'
import { Globe, Users, Package, MapPin, Shield, BookOpen, FileText, GitBranch, Feather } from 'lucide-react'
import { motion } from 'framer-motion'

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

// Linear design system colors
const categoryColors: Record<string, string> = {
  world: '#5e6ad2',
  character: '#e8b87d',
  item: '#9b7ed9',
  location: '#5eb5a6',
  faction: '#d45d5d',
  rule: '#7eb84a',
  outline: '#5e6ad2',
  ifline: '#7eb84a',
}

const categoryGlowColors: Record<string, string> = {
  world: 'rgba(94,106,210,0.15)',
  character: 'rgba(232,184,125,0.15)',
  item: 'rgba(155,126,217,0.15)',
  location: 'rgba(94,181,166,0.15)',
  faction: 'rgba(212,93,93,0.15)',
  rule: 'rgba(126,184,74,0.15)',
  outline: 'rgba(94,106,210,0.15)',
  ifline: 'rgba(126,184,74,0.15)',
}

export function CategoryNav() {
  const { settingsCategory, setSettingsCategory } = useUIStore()
  const generate = useSettingsStore((state) => state.generate)
  const loadCategoryData = useSettingsStore((state) => state.loadCategoryData)
  const reviewWithAI = useSettingsStore((state) => state.reviewWithAI)
  const isLoading = useSettingsStore((state) => state.isLoading)

  const handleCategoryChange = (key: UIState['settingsCategory']) => {
    setSettingsCategory(key)
    loadCategoryData(key)
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      {/* 头部 */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          设定编辑
        </h2>
        <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
          管理你的世界观、角色、物品等
        </p>
      </div>

      {/* 导航列表 - Linear semi-transparent hover states */}
      <nav className="flex-1 overflow-y-auto py-3">
        {categories.map(({ key, label, icon: Icon }) => {
          const isActive = settingsCategory === key
          const color = categoryColors[key]
          const glowColor = categoryGlowColors[key]

          return (
            <motion.button
              key={key}
              onClick={() => handleCategoryChange(key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 mb-0.5 text-left relative overflow-hidden"
              initial={false}
              animate={isActive ? { backgroundColor: glowColor } : { backgroundColor: 'transparent' }}
              transition={{ duration: 0.2 }}
              whileHover={!isActive ? { backgroundColor: 'rgba(255,255,255,0.04)' } : {}}
            >
              {/* Active left border - Linear accent bar with glow */}
              {isActive && (
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2"
                  layoutId="category-active-indicator"
                  style={{
                    width: '3px',
                    height: '20px',
                    backgroundColor: color,
                    borderRadius: '0 2px 2px 0',
                    boxShadow: `0 0 8px ${color}`,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              {/* Hover slide indicator - appears on hover when not active */}
              {!isActive && (
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2"
                  initial={{ opacity: 0, x: -4 }}
                  whileHover={{ opacity: 1, x: 0 }}
                  style={{
                    width: '3px',
                    height: '12px',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}

              <motion.div
                initial={false}
                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: isActive ? color : 'var(--color-text-muted)' }}
                />
              </motion.div>
              <motion.span
                className="text-sm font-medium"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--color-text-secondary)' }}
                initial={false}
                animate={isActive ? { x: 2 } : { x: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {label}
              </motion.span>
            </motion.button>
          )
        })}
      </nav>

      {/* 底部：AI辅助 - Linear ghost button style */}
      <div className="p-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
        {reviewableCategories.includes(settingsCategory) && (
          <Button
            onClick={() => reviewWithAI(settingsCategory as 'world' | 'character' | 'item' | 'location' | 'faction' | 'rule')}
            variant="ghost"
            size="md"
            className="w-full"
            disabled={isLoading}
          >
            <Feather className="w-4 h-4" />
            <span>AI审查</span>
          </Button>
        )}
        <Button
          onClick={() => {
            if (settingsCategory !== 'outline' && settingsCategory !== 'ifline') {
              generate(settingsCategory as 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule')
            }
          }}
          variant="ghost"
          size="md"
          className="w-full"
          disabled={isLoading}
        >
          <Feather className="w-4 h-4" />
          <span>智能生成</span>
        </Button>
      </div>
    </div>
  )
}

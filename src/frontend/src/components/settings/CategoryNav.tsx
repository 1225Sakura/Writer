import { useUIStore, useSettingsStore, UIState } from '@/store'
import { Globe, Users, Package, MapPin, Shield, BookOpen, FileText, GitBranch, Feather } from 'lucide-react'

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

export function CategoryNav() {
  const { settingsCategory, setSettingsCategory } = useUIStore()
  const generate = useSettingsStore((state) => state.generate)

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 className="font-semibold text-base" style={{ color: '#f7f8f8' }}>
          设定编辑
        </h2>
        <p className="text-xs mt-1.5" style={{ color: '#6b7280' }}>
          管理你的世界观、角色、物品等
        </p>
      </div>

      {/* 导航列表 */}
      <nav className="flex-1 overflow-y-auto py-3">
        {categories.map(({ key, label, icon: Icon }) => {
          const isActive = settingsCategory === key
          const color = categoryColors[key]

          return (
            <button
              key={key}
              onClick={() => setSettingsCategory(key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 mb-0.5 text-left transition-all relative"
              style={{
                backgroundColor: isActive ? 'rgba(94,106,210,0.1)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              {/* Active left border */}
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2"
                  style={{
                    width: '3px',
                    height: '20px',
                    backgroundColor: color,
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}

              <Icon
                className="w-4 h-4 flex-shrink-0 transition-colors"
                style={{ color: isActive ? color : '#6b7280' }}
              />
              <span
                className="text-sm font-medium transition-colors"
                style={{ color: isActive ? '#f7f8f8' : '#9ca3af' }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* 底部：AI辅助 */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={generate}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: '#d0d6e0',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
          }}
        >
          <Feather className="w-4 h-4" />
          <span>智能生成</span>
        </button>
      </div>
    </div>
  )
}

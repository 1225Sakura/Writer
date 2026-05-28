import { motion } from 'framer-motion'
import { BookOpen, Users, MapPin, Swords, ScrollText, Settings, PenTool } from 'lucide-react'
import { typeColors } from '@/lib/entityColors'
import type { ExtractedEntityLocal } from '@/store/chatStore'

/* ============================================================
   TYPE LABELS & ICONS
   ============================================================ */

const typeLabels: Record<string, string> = {
  world: '世界观',
  character: '角色',
  item: '物品',
  location: '地点',
  faction: '势力',
  rule: '规则',
  ifline: 'IF线',
}

const typeIcons: Record<string, React.ElementType> = {
  world: BookOpen,
  character: Users,
  item: ScrollText,
  location: MapPin,
  faction: Swords,
  rule: Settings,
  ifline: PenTool,
}

/* ============================================================
   WELCOME PANEL - Left sidebar entity overview + quick navigation
   ============================================================ */

export function WelcomePanel({ entities }: { entities: ExtractedEntityLocal[] }) {
  const groupedEntities = entities.reduce(
    (acc, entity) => {
      const key = entity.type
      if (!acc[key]) acc[key] = []
      acc[key].push(entity)
      return acc
    },
    {} as Record<string, ExtractedEntityLocal[]>
  )

  const confirmedCount = entities.filter((e) => e.confirmed).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[var(--border-subtle)]">
        <h2 className="font-semibold text-sm text-[var(--text-primary)]">
          已收集信息
        </h2>
        <p className="text-[11px] mt-1 text-[var(--text-tertiary)]">
          {confirmedCount}/{entities.length} 项已确认
        </p>
      </div>

      {/* Entity summary */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {entities.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              开始对话后，这里将显示收集到的设定信息
            </p>
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {Object.entries(groupedEntities).map(([type, typeEntities]) => {
              const Icon = typeIcons[type] || BookOpen
              const color = typeColors[type] || 'var(--color-character)'
              const confirmed = typeEntities.filter((e) => e.confirmed).length
              return (
                <motion.div
                  key={type}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${color} 15%, transparent)`,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--text-primary)]">
                      {typeLabels[type] || type}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                    {confirmed}/{typeEntities.length}
                  </span>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

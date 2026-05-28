import { motion } from 'framer-motion'
import { CheckCircle, Circle } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { typeColors } from '@/lib/entityColors'
import { EASE } from '@/components/shared/AnimationConfig'
import type { ExtractedEntityLocal } from '@/store/chatStore'

/* ============================================================
   PREVIEW PANEL - Mobile sidebar content with GlassCard entity items
   ============================================================ */

export function PreviewPanel({ entities, onConfirmEntity }: {
  entities: ExtractedEntityLocal[]
  onConfirmEntity?: (id: string) => void
}) {
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
  const progressPercent = entities.length > 0 ? (confirmedCount / entities.length) * 100 : 0

  return (
    <div className="h-full flex flex-col">
      {/* Progress Header */}
      <div className="mb-4 px-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-secondary">
            {confirmedCount}/{entities.length} 项已确认
          </span>
          {progressPercent === 100 && entities.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-ifline)]/10 text-[var(--color-ifline)] border border-[var(--color-ifline)]/20">
              全部确认
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-base">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: progressPercent === 100
                ? 'linear-gradient(90deg, var(--color-ifline), color-mix(in srgb, var(--color-ifline) 70%, var(--accent-primary)))'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: EASE.SMOOTH }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {entities.length === 0 ? (
          <div className="text-center py-8 text-secondary text-sm">
            开始对话后，这里将显示收集到的设定信息
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedEntities).map(([type, typeEntities]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: typeColors[type] || 'var(--color-character)' }}
                  />
                  <span className="text-xs font-medium text-secondary">
                    {type === 'world' ? '世界观' :
                     type === 'character' ? '角色' :
                     type === 'item' ? '物品' :
                     type === 'location' ? '地点' :
                     type === 'faction' ? '势力' :
                     type === 'rule' ? '规则' :
                     type === 'ifline' ? 'IF线' : type}
                  </span>
                  <span className="text-[10px] text-tertiary ml-auto">({typeEntities.length})</span>
                </div>
                <div className="space-y-1.5">
                  {typeEntities.map((entity) => (
                    <GlassCard
                      key={entity.id}
                      intensity="light"
                      border="subtle"
                      variant="default"
                      rounded="md"
                      padding="sm"
                      hover={false}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: typeColors[entity.type] || 'var(--color-character)'
                        }}
                      />
                      <span className="text-sm text-primary flex-1 truncate">{entity.name}</span>
                      {entity.confirmed ? (
                        <CheckCircle className="w-4 h-4 text-[var(--color-ifline)]" />
                      ) : (
                        <button
                          onClick={() => onConfirmEntity?.(entity.id)}
                          className="text-secondary hover:text-primary transition-colors"
                          aria-label={`确认 ${entity.name}`}
                        >
                          <Circle className="w-4 h-4" />
                        </button>
                      )}
                    </GlassCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

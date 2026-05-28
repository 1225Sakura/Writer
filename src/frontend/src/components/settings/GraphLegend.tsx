/**
 * GraphLegend — Legend and stats bar for the relation graph.
 * Extracted from RelationGraph.tsx.
 */

import { Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { ENTITY_TYPE_CONFIG, RELATION_TYPE_COLORS, RELATION_TYPE_LABELS } from './graphTypes'
import type { EntityNodeType } from './graphTypes'

// ============================================
// Legend
// ============================================

export function Legend({
  showLegend,
  onToggle,
  visibleRelationTypes,
}: {
  showLegend: boolean
  onToggle: () => void
  visibleRelationTypes: string[]
}) {
  if (!showLegend) {
    return (
      <button
        onClick={onToggle}
        className="absolute bottom-3 right-3 z-10 p-2.5 rounded-xl transition-all duration-200 group"
        aria-label="显示图例"
        title="显示图例"
        style={{
          background: 'var(--paper-80)',
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 4px 20px rgba(var(--ink-shadow-rgb),0.3)",
        }}
      >
        <Eye className="w-4 h-4 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
      </button>
    )
  }

  const uniqueTypes = [...new Set(visibleRelationTypes)]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
      className="absolute bottom-3 right-3 z-10 rounded-xl overflow-hidden"
      style={{
        minWidth: "160px",
        background: 'var(--paper-80)',
        border: "1px solid var(--border-default)",
        boxShadow: "0 8px 32px rgba(var(--ink-shadow-rgb),0.5), 0 0 0 1px var(--border-subtle)",
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)]">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-90)', opacity: 0.6 }}>
          图例
        </span>
        <button
          onClick={onToggle}
          className="p-1 rounded-lg hover:bg-[var(--hover-bg)] transition-all duration-200"
          aria-label="隐藏图例"
        >
          <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
        </button>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
          {(
            Object.entries(ENTITY_TYPE_CONFIG) as [
              EntityNodeType,
              (typeof ENTITY_TYPE_CONFIG)["character"],
            ][]
          ).map(([type, config]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: config.color,
                  boxShadow: `0 0 8px ${config.glowColor}`,
                }}
              />
              <span className="text-[10px]" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
                {config.label}
              </span>
            </div>
          ))}
        </div>

        {uniqueTypes.length > 0 && (
          <>
            <div className="border-t border-[var(--border-subtle)] pt-2.5">
              <span className="text-[9px] font-medium uppercase tracking-wider mb-2 block" style={{ color: 'var(--ink-90)', opacity: 0.4 }}>
                关系类型
              </span>
              <div className="space-y-1.5">
                {uniqueTypes.slice(0, 6).map((type) => (
                  <div key={type} className="flex items-center gap-2.5">
                    <div
                      className="w-5 h-[2px] rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          RELATION_TYPE_COLORS[type] ||
                          RELATION_TYPE_COLORS.other,
                        boxShadow: `0 0 6px color-mix(in srgb, ${RELATION_TYPE_COLORS[type] || RELATION_TYPE_COLORS.other} 31%, transparent)`,
                      }}
                    />
                    <span className="text-[10px]" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
                      {RELATION_TYPE_LABELS[type] || type}
                    </span>
                  </div>
                ))}
                {uniqueTypes.length > 6 && (
                  <span className="text-[9px]" style={{ color: 'var(--ink-90)', opacity: 0.35 }}>
                    +{uniqueTypes.length - 6} 更多
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ============================================
// StatsBar
// ============================================

export function StatsBar({
  nodeCount,
  linkCount,
  filterRelation,
  onClearFilter,
}: {
  nodeCount: number
  linkCount: number
  filterRelation: string
  onClearFilter: () => void
}) {
  return (
    <div
      className="absolute bottom-3 left-3 z-10 text-[10px] px-3 py-2 rounded-xl flex items-center gap-2.5"
      style={{
        background: 'var(--paper-80)',
        border: "1px solid var(--border-subtle)",
        boxShadow: "0 4px 20px rgba(var(--ink-shadow-rgb),0.3), 0 0 0 1px var(--border-subtle)",
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span className="font-medium" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
        {nodeCount} 节点
      </span>
      <span style={{ color: 'var(--ink-90)', opacity: 0.3 }}>·</span>
      <span className="font-medium" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
        {linkCount} 关系
      </span>
      {filterRelation !== "all" && (
        <>
          <span style={{ color: 'var(--ink-90)', opacity: 0.3 }}>·</span>
          <button
            className="underline transition-colors duration-200"
            style={{ color: 'var(--accent-primary)' }}
            onClick={onClearFilter}
          >
            清除筛选
          </button>
        </>
      )}
    </div>
  )
}

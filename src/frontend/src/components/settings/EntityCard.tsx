import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Edit2 } from 'lucide-react'
import { TagInput, TagChips } from './TagInput'

export const entityColors: Record<string, { bg: string; text: string }> = {
  character: { bg: 'rgba(232,184,125,0.15)', text: 'var(--color-character)' },
  item: { bg: 'rgba(155,126,217,0.15)', text: 'var(--color-item)' },
  location: { bg: 'rgba(94,181,166,0.15)', text: 'var(--color-location)' },
  faction: { bg: 'rgba(212,93,93,0.15)', text: 'var(--color-faction)' },
  world: { bg: 'rgba(94,106,210,0.15)', text: 'var(--color-world)' },
  rule: { bg: 'rgba(126,184,74,0.15)', text: 'var(--color-rule)' },
  outline: { bg: 'rgba(91,142,232,0.15)', text: 'var(--color-outline)' },
  ifline: { bg: 'rgba(126,184,74,0.15)', text: 'var(--color-ifline)' },
}

export const cardStyle = {
  backgroundColor: 'var(--color-surface-raised)',
  border: '1px solid var(--border-default)',
}

export const cardGlowStyle = (color: string, isHovered: boolean) => ({
  boxShadow: isHovered ? `0 0 16px ${color}18, 0 4px 12px rgba(0,0,0,0.15)` : 'none',
})

interface EntityCardProps {
  name: string
  description?: string
  badge?: string
  badgeColor?: { bg: string; text: string }
  tags?: string[]
  entityType?: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule' | 'ifline'
  entityId?: number
  extraContent?: React.ReactNode
  onEdit?: () => void
  onDelete: () => void
  onClick?: () => void
}

export function EntityCard({
  name,
  description,
  badge,
  badgeColor,
  tags,
  entityType,
  entityId,
  extraContent,
  onEdit,
  onDelete,
  onClick,
}: EntityCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      className="p-4 rounded-lg relative overflow-hidden bg-[var(--color-surface-raised)] border border-[var(--border-default)] transition-colors duration-150"
      style={{
        ...cardGlowStyle(badgeColor?.text || 'var(--accent-primary)', isHovered),
        backgroundColor: isHovered ? 'var(--color-surface-overlay)' : 'var(--color-surface-raised)',
        borderColor: isHovered ? 'var(--border-strong)' : 'var(--border-default)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
    >
      {/* Subtle glow on hover */}
      {badgeColor && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 0.08 : 0 }}
          style={{
            background: `radial-gradient(circle at 90% 10%, ${badgeColor.text}, transparent 70%)`,
          }}
        />
      )}

      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm text-[var(--text-primary)]">
              {name}
            </h3>
            {badge && badgeColor && (
              <motion.span
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ backgroundColor: badgeColor.bg, color: badgeColor.text }}
                initial={false}
                animate={isHovered ? { scale: 1.05 } : { scale: 1 }}
              >
                {badge}
              </motion.span>
            )}
          </div>
          {description && (
            <p className="text-xs line-clamp-2 text-[var(--text-tertiary)]">
              {description}
            </p>
          )}
          {extraContent}
          {entityType && entityId !== undefined ? (
            <TagInput entityType={entityType} entityId={entityId} tags={tags || []} />
          ) : (
            tags && tags.length > 0 && <TagChips tags={tags} entityType={entityType} />
          )}
        </div>
        <div className="flex gap-1 ml-2">
          {onEdit && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="p-1.5 rounded transition-all text-[var(--text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)] hover:scale-110 active:scale-90"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Edit2 className="w-4 h-4" />
            </motion.button>
          )}
          <motion.button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 rounded transition-all text-[var(--text-tertiary)] hover:bg-[rgba(217,58,58,0.15)] hover:text-[var(--color-danger)] hover:scale-110 active:scale-90"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

interface EntityListItemProps {
  name: string
  description?: string
  type: string
  typeColor: string
  typeLabel: string
  onClick?: () => void
  onDelete?: () => void
}

export function EntityListItem({
  name,
  description,
  typeColor,
  typeLabel,
  onClick,
  onDelete,
}: EntityListItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer group relative hover:bg-white/[0.04]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.15 }}
    >
      {/* Hover glow */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            boxShadow: `inset 0 0 12px ${typeColor}15`,
          }}
        />
      )}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: typeColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate text-[var(--text-primary)]">
          {name}
        </div>
        {description && (
          <p className="text-xs truncate text-[var(--text-tertiary)]">
            {description}
          </p>
        )}
      </div>
      <span
        className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
        style={{
          backgroundColor: `${typeColor}15`,
          color: typeColor,
        }}
      >
        {typeLabel}
      </span>
      {onDelete && (
        <motion.button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:scale-110 active:scale-90"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </motion.button>
      )}
    </motion.div>
  )
}

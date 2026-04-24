import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Edit2 } from 'lucide-react'
import { TagInput, TagChips } from './TagInput'

export const entityColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  character: { bg: 'rgba(232,184,125,0.12)', text: 'var(--color-character)', border: 'rgba(232,184,125,0.20)', glow: 'rgba(232,184,125,0.08)' },
  item: { bg: 'rgba(155,126,217,0.12)', text: 'var(--color-item)', border: 'rgba(155,126,217,0.20)', glow: 'rgba(155,126,217,0.08)' },
  location: { bg: 'rgba(94,181,166,0.12)', text: 'var(--color-location)', border: 'rgba(94,181,166,0.20)', glow: 'rgba(94,181,166,0.08)' },
  faction: { bg: 'rgba(212,93,93,0.12)', text: 'var(--color-faction)', border: 'rgba(212,93,93,0.20)', glow: 'rgba(212,93,93,0.08)' },
  world: { bg: 'rgba(94,106,210,0.12)', text: 'var(--color-world)', border: 'rgba(94,106,210,0.20)', glow: 'rgba(94,106,210,0.08)' },
  rule: { bg: 'rgba(126,184,74,0.12)', text: 'var(--color-rule)', border: 'rgba(126,184,74,0.20)', glow: 'rgba(126,184,74,0.08)' },
  outline: { bg: 'rgba(91,142,232,0.12)', text: 'var(--color-outline)', border: 'rgba(91,142,232,0.20)', glow: 'rgba(91,142,232,0.08)' },
  ifline: { bg: 'rgba(126,184,74,0.12)', text: 'var(--color-ifline)', border: 'rgba(126,184,74,0.20)', glow: 'rgba(126,184,74,0.08)' },
}

export const cardStyle = {
  backgroundColor: 'var(--color-surface-raised)',
  border: '1px solid var(--border-default)',
}

export const cardGlowStyle = (color: string, isHovered: boolean, borderColor?: string) => ({
  boxShadow: isHovered
    ? `0 0 20px ${color}20, 0 4px 16px rgba(0,0,0,0.20), 0 1px 4px rgba(0,0,0,0.12), inset 0 0 0 1px ${borderColor || color}18`
    : `0 1px 3px rgba(0,0,0,0.06), 0 0 0 0 transparent`,
  transition: 'box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, background-color 0.25s ease',
})

interface EntityCardProps {
  name: string
  description?: string
  badge?: string
  badgeColor?: { bg: string; text: string; border?: string }
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
      className="p-4 rounded-xl relative overflow-hidden bg-[var(--color-surface-raised)] border"
      style={{
        ...cardGlowStyle(badgeColor?.text || 'var(--accent-primary)', isHovered, badgeColor?.border),
        backgroundColor: isHovered ? 'var(--color-surface-overlay)' : 'var(--color-surface-raised)',
        borderColor: isHovered ? (badgeColor?.border || 'var(--border-strong)') : 'var(--border-default)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
    >
      {/* Top accent line with entity color */}
      {badgeColor && (
        <motion.div
          className="absolute top-0 left-4 right-4 h-px rounded-full"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{
            opacity: isHovered ? 0.6 : 0.2,
            scaleX: isHovered ? 1 : 0.5,
          }}
          transition={{ duration: 0.3 }}
          style={{
            background: `linear-gradient(90deg, transparent, ${badgeColor.text}, transparent)`,
          }}
        />
      )}

      {/* Subtle corner glow on hover */}
      {badgeColor && (
        <motion.div
          className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 0.06 : 0 }}
          transition={{ duration: 0.3 }}
          style={{
            background: `radial-gradient(circle at 100% 0%, ${badgeColor.text}, transparent 70%)`,
          }}
        />
      )}

      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-medium text-sm text-[var(--text-primary)]">
              {name}
            </h3>
            {badge && badgeColor && (
              <motion.span
                className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                style={{
                  backgroundColor: badgeColor.bg,
                  color: badgeColor.text,
                  border: `1px solid ${badgeColor.border}`,
                }}
                initial={false}
                animate={isHovered ? { scale: 1.05 } : { scale: 1 }}
              >
                {badge}
              </motion.span>
            )}
          </div>
          {description && (
            <p className="text-xs line-clamp-2 text-[var(--text-tertiary)] leading-relaxed">
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
        <div className="flex gap-0.5 ml-2">
          {onEdit && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="p-1.5 rounded-lg transition-all text-[var(--text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </motion.button>
          )}
          <motion.button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 rounded-lg transition-all text-[var(--text-tertiary)] hover:bg-[rgba(217,58,58,0.12)] hover:text-[var(--color-danger)]"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Trash2 className="w-3.5 h-3.5" />
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
      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer group relative"
      style={{
        backgroundColor: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderBottom: '1px solid var(--border-subtle)',
        transition: 'background-color 0.2s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      whileHover={{ x: 3 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Hover glow */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            boxShadow: `inset 0 0 16px ${typeColor}12, inset 2px 0 0 ${typeColor}40`,
          }}
        />
      )}
      <motion.div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: typeColor }}
        animate={isHovered ? { scale: 1.3 } : { scale: 1 }}
        transition={{ duration: 0.2 }}
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

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Edit2 } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { TagInput, TagChips } from './TagInput'
import { GlassCard } from '@/components/ui/GlassCard'
import { EASE, DURATION } from '@/components/shared/AnimationConfig'

export const entityColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  character: { bg: 'color-mix(in srgb, var(--color-character) 12%, transparent)', text: 'var(--color-character)', border: 'color-mix(in srgb, var(--color-character) 20%, transparent)', glow: 'color-mix(in srgb, var(--color-character) 8%, transparent)' },
  item: { bg: 'color-mix(in srgb, var(--color-item) 12%, transparent)', text: 'var(--color-item)', border: 'color-mix(in srgb, var(--color-item) 20%, transparent)', glow: 'color-mix(in srgb, var(--color-item) 8%, transparent)' },
  location: { bg: 'color-mix(in srgb, var(--color-location) 12%, transparent)', text: 'var(--color-location)', border: 'color-mix(in srgb, var(--color-location) 20%, transparent)', glow: 'color-mix(in srgb, var(--color-location) 8%, transparent)' },
  faction: { bg: 'color-mix(in srgb, var(--color-faction) 12%, transparent)', text: 'var(--color-faction)', border: 'color-mix(in srgb, var(--color-faction) 20%, transparent)', glow: 'color-mix(in srgb, var(--color-faction) 8%, transparent)' },
  world: { bg: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', text: 'var(--color-world)', border: 'color-mix(in srgb, var(--accent-primary) 20%, transparent)', glow: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' },
  rule: { bg: 'color-mix(in srgb, var(--color-faction) 12%, transparent)', text: 'var(--color-rule)', border: 'color-mix(in srgb, var(--color-faction) 20%, transparent)', glow: 'color-mix(in srgb, var(--color-faction) 8%, transparent)' },
  outline: { bg: 'color-mix(in srgb, var(--color-outline) 12%, transparent)', text: 'var(--color-outline)', border: 'color-mix(in srgb, var(--color-outline) 20%, transparent)', glow: 'color-mix(in srgb, var(--color-outline) 8%, transparent)' },
  ifline: { bg: 'color-mix(in srgb, var(--color-ifline) 12%, transparent)', text: 'var(--color-ifline)', border: 'color-mix(in srgb, var(--color-ifline) 20%, transparent)', glow: 'color-mix(in srgb, var(--color-ifline) 8%, transparent)' },
}

export const cardStyle = {
  backgroundColor: 'var(--color-surface-raised)',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-card)',
}

interface EntityCardProps {
  name: string
  description?: string
  badge?: string
  badgeColor?: { bg: string; text: string; border?: string; glow?: string }
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

  const entityColorKey = entityType || 'accent'
  const colors = badgeColor || entityColors[entityType || 'character']

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
    <GlassCard
      intensity="medium"
      border="subtle"
      variant="elevated"
      rounded="lg"
      padding="md"
      hover={!!onClick}
      entityColor={entityColorKey as 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'accent'}
      onClick={onClick}
      className="relative group"
    >
      {/* Top accent line with hover animation */}
      {colors && (
        <div className="absolute top-0 left-4 right-4 h-px rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={{ opacity: 0, scaleX: 0.4 }}
            animate={{
              opacity: isHovered ? 0.6 : 0.15,
              scaleX: isHovered ? 1 : 0.4,
            }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            style={{
              background: `linear-gradient(90deg, transparent, ${colors.text}, transparent)`,
            }}
          />
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-medium text-sm text-[var(--text-primary)]">
              {name}
            </h3>
            {badge && colors && (
              <span
                className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                style={{
                  backgroundColor: colors.bg,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                }}
              >
                {badge}
              </span>
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
        <div className="flex gap-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
              <Icon icon={Edit2} size="xs" color="inherit" />
            </motion.button>
          )}
          <motion.button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 rounded-lg transition-all text-[var(--text-tertiary)] hover:bg-[var(--vermillion-muted)] hover:text-[var(--color-danger)]"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Icon icon={Trash2} size="xs" color="inherit" />
          </motion.button>
        </div>
      </div>
    </GlassCard>
    </div>
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
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer group relative"
      style={{
        backgroundColor: isHovered ? 'var(--color-surface-hover)' : 'transparent',
        borderBottom: '1px solid var(--border-subtle)',
        transition: 'background-color 0.2s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      whileHover={{ x: 3 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      {/* Hover glow effect */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-lg"
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
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
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
          <Icon icon={Trash2} size="xs" color="inherit" />
        </motion.button>
      )}
    </motion.div>
  )
}

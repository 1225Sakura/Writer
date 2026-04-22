import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Edit2 } from 'lucide-react'
import { TagInput, TagChips } from './TagInput'

// Entity type colors
export const entityColors: Record<string, { bg: string; text: string }> = {
  character: { bg: 'rgba(232,184,125,0.15)', text: '#e8b87d' },
  item: { bg: 'rgba(155,126,217,0.15)', text: '#9b7ed9' },
  location: { bg: 'rgba(94,181,166,0.15)', text: '#5eb5a6' },
  faction: { bg: 'rgba(212,93,93,0.15)', text: '#d45d5d' },
  world: { bg: 'rgba(94,106,210,0.15)', text: '#5e6ad2' },
  rule: { bg: 'rgba(126,184,74,0.15)', text: '#7eb84a' },
  outline: { bg: 'rgba(91,142,232,0.15)', text: '#5b8ee8' },
  ifline: { bg: 'rgba(126,184,74,0.15)', text: '#7eb84a' },
}

// Linear card style with glow support
export const cardStyle = {
  backgroundColor: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
}

// Glow effect for active/hovered cards
export const cardGlowStyle = (color: string, isHovered: boolean) => ({
  boxShadow: isHovered ? `0 0 20px ${color}20, 0 4px 12px rgba(0,0,0,0.2)` : 'none',
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
      className="p-4 rounded-lg relative overflow-hidden"
      style={{
        ...cardStyle,
        ...cardGlowStyle(badgeColor?.text || '#5e6ad2', isHovered),
        backgroundColor: isHovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        borderColor: isHovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
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
            <h3 className="font-medium text-sm" style={{ color: '#f7f8f8' }}>
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
            <p className="text-xs line-clamp-2" style={{ color: '#6b7280' }}>
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
              className="p-1.5 rounded transition-all"
              style={{ color: '#6b7280' }}
              whileHover={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#f7f8f8',
                scale: 1.1,
              }}
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
            className="p-1.5 rounded transition-all"
            style={{ color: '#6b7280' }}
            whileHover={{
              backgroundColor: 'rgba(196,92,92,0.15)',
              color: '#d45d5d',
              scale: 1.1,
            }}
            whileTap={{ scale: 0.9 }}
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// Compact entity card for list views
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
      className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer group relative"
      style={{
        backgroundColor: isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
      }}
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
        <div className="text-sm font-medium truncate" style={{ color: '#f7f8f8' }}>
          {name}
        </div>
        {description && (
          <p className="text-xs truncate" style={{ color: '#6b7280' }}>
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
          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          style={{ color: '#6b7280' }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </motion.button>
      )}
    </motion.div>
  )
}

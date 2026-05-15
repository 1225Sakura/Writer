/**
 * CharacterActions — CharacterCard, NewCharacterForm, EditableEntityCard.
 * Extracted from EntityActions.tsx.
 */

import { useSettingsStore } from '@/store/settingsStore'
import type { CharacterLocal } from '@/store/settingsStore'
import { Trash2, Edit2, Plus } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { useState } from 'react'
import { TagInput } from './TagInput'
import { EntityCard, entityColors, cardStyle } from './EntityCard'
import { EntityForm } from './EntityForm'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

// ============================================
// Character tier badges
// ============================================

const tierLabels: Record<string, string> = {
  core: '核心',
  supporting: '配角',
  minor: '路人',
}

// ============================================
// CharacterCard
// ============================================

export function CharacterCard({ character }: { character: CharacterLocal }) {
  const { updateCharacter, deleteCharacter } = useSettingsStore()
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const color = entityColors.character

  const handleSave = (data: { name: string; description?: string }) => {
    updateCharacter(character.id, data)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <EntityForm
        entity={character}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
        fields={[
          { key: 'name', label: '姓名', required: true, maxLength: 50 },
          { key: 'description', label: '描述', type: 'textarea', maxLength: 500 },
        ]}
      />
    )
  }

  return (
    <motion.div
      className="p-4 rounded-lg"
      style={{
        ...cardStyle,
        backgroundColor: isHovered ? 'var(--hover-bg)' : 'var(--color-surface-raised)',
        borderColor: isHovered ? 'var(--border-strong)' : 'var(--border-default)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -1 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
            {character.name}
          </h3>
          <motion.span
            className="text-xs px-2 py-0.5 rounded font-medium"
            style={{ backgroundColor: color.bg, color: color.text }}
            whileHover={{ scale: 1.05 }}
          >
            {tierLabels[character.tier]}
          </motion.span>
        </div>
        <div className="flex gap-1">
          <motion.button
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded transition-all"
            style={{ color: 'var(--text-tertiary)' }}
            whileHover={{
              backgroundColor: 'var(--border-default)',
              color: 'var(--text-primary)',
              scale: 1.1,
            }}
            whileTap={{ scale: 0.9 }}
            aria-label="编辑角色"
          >
            <Icon icon={Edit2} size="sm" color="inherit" />
          </motion.button>
          <motion.button
            onClick={() => deleteCharacter(character.id)}
            className="p-1.5 rounded transition-all"
            style={{ color: 'var(--text-tertiary)' }}
            whileHover={{
              backgroundColor: 'var(--vermillion-muted)',
              color: 'var(--color-danger)',
              scale: 1.1,
            }}
            whileTap={{ scale: 0.9 }}
            aria-label="删除角色"
          >
            <Icon icon={Trash2} size="sm" color="inherit" />
          </motion.button>
        </div>
      </div>
      {character.description && (
        <p className="text-xs line-clamp-2 mb-2" style={{ color: 'var(--text-tertiary)' }}>
          {character.description}
        </p>
      )}
      {character.personality && (
        <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
          性格: {character.personality}
        </p>
      )}
      {character.cultivationRealm && (
        <p className="text-xs mb-2" style={{ color: 'var(--color-location)' }}>
          境界: {character.cultivationRealm}
        </p>
      )}
      <TagInput entityType="character" entityId={character.id} tags={character.tags} />
      {character.relationships.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {character.relationships.length} 条关系
          </span>
        </div>
      )}
    </motion.div>
  )
}

// ============================================
// NewCharacterForm
// ============================================

export function NewCharacterForm() {
  const { addCharacter } = useSettingsStore()
  const [showForm, setShowForm] = useState(false)

  const handleSave = (data: { name: string; description?: string }) => {
    addCharacter({ ...data, tier: 'supporting', tags: [] })
    setShowForm(false)
  }

  if (showForm) {
    return (
      <EntityForm
        onSave={handleSave}
        onCancel={() => setShowForm(false)}
        fields={[
          { key: 'name', label: '姓名', required: true, maxLength: 50 },
          { key: 'description', label: '描述', type: 'textarea', maxLength: 500 },
        ]}
      />
    )
  }

  return (
    <motion.button
      onClick={() => setShowForm(true)}
      className="w-full p-4 rounded-lg transition-all flex items-center justify-center gap-2"
      style={{
        ...cardStyle,
        borderStyle: 'dashed',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
        e.currentTarget.style.borderColor = 'var(--accent-100)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)'
        e.currentTarget.style.borderColor = 'var(--border-default)'
      }}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.99 }}
    >
      <Icon icon={Plus} size="sm" color="accent" />
      <span className="text-sm" style={{ color: 'var(--accent-primary)' }}>
        添加角色
      </span>
    </motion.button>
  )
}

// ============================================
// EditableEntityCard
// ============================================

export function EditableEntityCard<T extends { id: number; name?: string; title?: string; description?: string }>({
  entity,
  entityType,
  badge,
  badgeColor,
  tags,
  extraFields,
  onDelete,
  onUpdate,
  editFields,
}: {
  entity: T
  entityType: 'item' | 'location' | 'faction' | 'world' | 'rule' | 'ifline'
  badge?: string
  badgeColor?: { bg: string; text: string; border?: string; glow?: string }
  tags?: string[]
  extraFields?: React.ReactNode
  onDelete: () => void
  onUpdate: (id: number, data: Partial<T>) => void
  editFields: Array<{ key: keyof T; label: string; type?: 'text' | 'textarea'; required?: boolean; maxLength?: number }>
}) {
  const [isEditing, setIsEditing] = useState(false)

  const handleSave = (data: T) => {
    onUpdate(entity.id, data)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <EntityForm
        entity={entity}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
        fields={editFields}
        extraFields={extraFields}
      />
    )
  }

  return (
    <EntityCard
      name={entity.name || entity.title || ''}
      description={entity.description}
      badge={badge}
      badgeColor={badgeColor}
      tags={tags}
      entityType={entityType}
      entityId={entity.id}
      onEdit={() => setIsEditing(true)}
      onDelete={onDelete}
    />
  )
}

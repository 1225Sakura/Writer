import { useSettingsStore, type CharacterLocal, UIState, Chapter } from '@/store'
import { Trash2, Edit2, Users, Plus, FileText, X, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { TagInput, TagChips } from './TagInput'

interface EntityEditorProps {
  category: UIState['settingsCategory']
}

// Entity type colors for badges
const entityColors: Record<string, { bg: string; text: string }> = {
  character: { bg: 'rgba(232,184,125,0.15)', text: '#e8b87d' },
  item: { bg: 'rgba(155,126,217,0.15)', text: '#9b7ed9' },
  location: { bg: 'rgba(94,181,166,0.15)', text: '#5eb5a6' },
  faction: { bg: 'rgba(212,93,93,0.15)', text: '#d45d5d' },
  world: { bg: 'rgba(94,106,210,0.15)', text: '#5e6ad2' },
  rule: { bg: 'rgba(126,184,74,0.15)', text: '#7eb84a' },
  outline: { bg: 'rgba(94,106,210,0.15)', text: '#5e6ad2' },
  ifline: { bg: 'rgba(126,184,74,0.15)', text: '#7eb84a' },
}

// Linear card style
const cardStyle = {
  backgroundColor: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
}

// Common input style for Linear design
const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f7f8f8',
}

// Generic entity card for simple CRUD entities
function EntityCard({
  name,
  description,
  badge,
  badgeColor,
  tags,
  entityType,
  entityId,
  onDelete,
}: {
  name: string
  description?: string
  badge?: string
  badgeColor?: { bg: string; text: string }
  tags?: string[]
  entityType?: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule' | 'ifline'
  entityId?: number
  onDelete: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="p-4 rounded-lg transition-all cursor-pointer"
      style={{
        ...cardStyle,
        backgroundColor: isHovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        borderColor: isHovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm" style={{ color: '#f7f8f8' }}>
              {name}
            </h3>
            {badge && badgeColor && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: badgeColor.bg, color: badgeColor.text }}
              >
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs line-clamp-2" style={{ color: '#6b7280' }}>
              {description}
            </p>
          )}
          {entityType && entityId !== undefined && (
            <TagInput entityType={entityType} entityId={entityId} tags={tags || []} />
          )}
          {!entityType && tags && tags.length > 0 && <TagChips tags={tags} />}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-1.5 rounded transition-all"
          style={{ color: '#6b7280' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(196,92,92,0.15)'
            e.currentTarget.style.color = '#d45d5d'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#6b7280'
          }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Generic add form for entities
function AddEntityForm({
  placeholder,
  onAdd,
  onCancel,
}: {
  placeholder: string
  onAdd: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')

  return (
    <div className="p-3 rounded-lg" style={cardStyle}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) onAdd(name.trim())
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        autoFocus
        className="w-full px-3 py-2 rounded-md text-sm mb-3 transition-all focus:outline-none"
        style={{
          ...inputStyle,
          borderColor: 'rgba(94,106,210,0.3)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(94,106,210,0.5)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
        }}
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: 'transparent',
            color: '#9ca3af',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          取消
        </button>
        <button
          onClick={() => name.trim() && onAdd(name.trim())}
          disabled={!name.trim()}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
          style={{
            backgroundColor: '#5e6ad2',
            color: '#fff',
          }}
          onMouseEnter={(e) => {
            if (name.trim()) e.currentTarget.style.backgroundColor = '#4f5cbd'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#5e6ad2'
          }}
        >
          添加
        </button>
      </div>
    </div>
  )
}

// Section header with add and AI generate buttons
function SectionHeader({
  title,
  count,
  onAdd,
  onGenerate,
}: {
  title: string
  count: number
  onAdd: () => void
  onGenerate?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold" style={{ color: '#f7f8f8' }}>
          {title}
        </h2>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}
        >
          {count}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {onGenerate && (
          <button
            onClick={onGenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: 'rgba(94,106,210,0.15)',
              color: '#5e6ad2',
              border: '1px solid rgba(94,106,210,0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(94,106,210,0.25)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(94,106,210,0.15)'
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI生成
          </button>
        )}
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
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
          <Plus className="w-3.5 h-3.5" />
          新增
        </button>
      </div>
    </div>
  )
}

// 通用实体编辑表单
function EntityForm<T extends { name: string; description?: string }>({
  entity,
  onSave,
  onCancel,
  fields,
}: {
  entity?: T
  onSave: (data: T) => void
  onCancel: () => void
  fields: Array<{ key: keyof T; label: string; type?: 'text' | 'textarea' }>
}) {
  const [formData, setFormData] = useState<T>(() => {
    if (entity) return entity
    const empty = {} as T
    return empty
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-lg" style={cardStyle}>
      {fields.map(({ key, label, type }) => (
        <div key={key as string}>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
            {label}
          </label>
          {type === 'textarea' ? (
            <textarea
              value={(formData[key] as string) || ''}
              onChange={(e) => {
                const value = e.target.value as T[keyof T]
                setFormData({ ...formData, [key]: value })
              }}
              className="w-full px-3 py-2 rounded-md text-sm transition-all focus:outline-none resize-none"
              style={{
                ...inputStyle,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(94,106,210,0.5)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              }}
              rows={3}
            />
          ) : (
            <input
              type="text"
              value={(formData[key] as string) || ''}
              onChange={(e) => {
                const value = e.target.value as T[keyof T]
                setFormData({ ...formData, [key]: value })
              }}
              className="w-full px-3 py-2 rounded-md text-sm transition-all focus:outline-none"
              style={{
                ...inputStyle,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(94,106,210,0.5)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              }}
            />
          )}
        </div>
      ))}
      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: 'transparent',
            color: '#9ca3af',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          取消
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: '#5e6ad2',
            color: '#fff',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#4f5cbd'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#5e6ad2'
          }}
        >
          保存
        </button>
      </div>
    </form>
  )
}

// Character tier badges
const tierLabels: Record<string, string> = {
  core: '核心',
  supporting: '配角',
  minor: '路人',
}

// 角色卡片
function CharacterCard({ character }: { character: CharacterLocal }) {
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
          { key: 'name', label: '姓名' },
          { key: 'description', label: '描述', type: 'textarea' },
        ]}
      />
    )
  }

  return (
    <div
      className="p-4 rounded-lg transition-all"
      style={{
        ...cardStyle,
        backgroundColor: isHovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        borderColor: isHovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm" style={{ color: '#f7f8f8' }}>
            {character.name}
          </h3>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: color.bg, color: color.text }}
          >
            {tierLabels[character.tier]}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded transition-all"
            style={{ color: '#6b7280' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = '#f7f8f8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#6b7280'
            }}
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => deleteCharacter(character.id)}
            className="p-1.5 rounded transition-all"
            style={{ color: '#6b7280' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(196,92,92,0.15)'
              e.currentTarget.style.color = '#d45d5d'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#6b7280'
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {character.description && (
        <p className="text-xs line-clamp-2 mb-2" style={{ color: '#6b7280' }}>
          {character.description}
        </p>
      )}
      {character.cultivationRealm && (
        <p className="text-xs" style={{ color: '#5eb5a6' }}>
          境界: {character.cultivationRealm}
        </p>
      )}
      <TagInput entityType="character" entityId={character.id} tags={character.tags} />
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs" style={{ color: '#6b7280' }}>
          {character.relationships.length} 条关系
        </span>
      </div>
    </div>
  )
}

// 新建角色表单
function NewCharacterForm() {
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
          { key: 'name', label: '姓名' },
          { key: 'description', label: '描述', type: 'textarea' },
        ]}
      />
    )
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className="w-full p-4 rounded-lg transition-all flex items-center justify-center gap-2"
      style={{
        ...cardStyle,
        borderStyle: 'dashed',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.borderColor = 'rgba(94,106,210,0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      }}
    >
      <Plus className="w-4 h-4" style={{ color: '#5e6ad2' }} />
      <span className="text-sm" style={{ color: '#5e6ad2' }}>
        添加角色
      </span>
    </button>
  )
}

// 大纲编辑器
function OutlineEditor() {
  const { outline, chapters, addChapter, updateChapter, deleteChapter } = useSettingsStore()
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [summaryModalChapterId, setSummaryModalChapterId] = useState<number | null>(null)
  const [isCreatingOutline, setIsCreatingOutline] = useState(false)
  const [newOutlineTitle, setNewOutlineTitle] = useState('')
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [showAddChapter, setShowAddChapter] = useState(false)

  const handleCreateOutline = () => {
    if (newOutlineTitle.trim()) {
      useSettingsStore.getState().setOutline({
        id: Date.now(),
        title: newOutlineTitle.trim(),
        description: '',
      })
      setIsCreatingOutline(false)
      setNewOutlineTitle('')
    }
  }

  const handleAddChapter = () => {
    if (newChapterTitle.trim()) {
      addChapter({
        title: newChapterTitle.trim(),
        summary: '',
        status: 'planning',
        word_count: 0,
        chapter_order: chapters.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      setNewChapterTitle('')
      setShowAddChapter(false)
    }
  }

  const startEditTitle = (chapter: Chapter) => {
    setEditingChapterId(chapter.id)
    setEditingTitle(chapter.title || '')
  }

  const handleSaveTitle = (chapterId: number) => {
    if (editingTitle.trim()) {
      updateChapter(chapterId, { title: editingTitle.trim() })
    }
    setEditingChapterId(null)
    setEditingTitle('')
  }

  const handleKeyDown = (e: React.KeyboardEvent, chapterId: number) => {
    if (e.key === 'Enter') {
      handleSaveTitle(chapterId)
    } else if (e.key === 'Escape') {
      setEditingChapterId(null)
      setEditingTitle('')
    }
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    planning: { bg: 'rgba(255,255,255,0.08)', text: '#9ca3af' },
    writing: { bg: 'rgba(94,106,210,0.15)', text: '#5e6ad2' },
    completed: { bg: 'rgba(126,184,74,0.15)', text: '#7eb84a' },
  }

  const statusLabels: Record<string, string> = {
    planning: '规划中',
    writing: '写作中',
    completed: '已完成',
  }

  // 无大纲状态
  if (!outline) {
    return (
      <div>
        <h2 className="text-base font-semibold mb-4" style={{ color: '#f7f8f8' }}>
          大纲管理
        </h2>
        <div className="rounded-lg p-8 text-center" style={cardStyle}>
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: '#6b7280' }} />
          <p className="text-sm mb-4" style={{ color: '#9ca3af' }}>
            尚未创建故事大纲
          </p>
          {isCreatingOutline ? (
            <div className="space-y-3 max-w-sm mx-auto">
              <input
                type="text"
                value={newOutlineTitle}
                onChange={(e) => setNewOutlineTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateOutline()
                  if (e.key === 'Escape') setIsCreatingOutline(false)
                }}
                placeholder="输入大纲标题..."
                autoFocus
                className="w-full px-3 py-2 rounded-md text-sm transition-all focus:outline-none"
                style={{
                  ...inputStyle,
                  borderColor: 'rgba(94,106,210,0.3)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(94,106,210,0.5)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                }}
              />
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setIsCreatingOutline(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#9ca3af',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateOutline}
                  disabled={!newOutlineTitle.trim()}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40"
                  style={{ backgroundColor: '#5e6ad2', color: '#fff' }}
                >
                  创建
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingOutline(true)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
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
              创建大纲
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold" style={{ color: '#f7f8f8' }}>
            大纲管理
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: 'rgba(94,106,210,0.15)', color: '#5e6ad2' }}
          >
            {chapters.length} 章节
          </span>
        </div>
        <button
          onClick={() => setShowAddChapter(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
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
          <Plus className="w-3.5 h-3.5" />
          新增章节
        </button>
      </div>

      <div className="mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-sm font-medium" style={{ color: '#f7f8f8' }}>
          {outline.title}
        </h3>
      </div>

      {/* 章节列表 */}
      <div className="space-y-2">
        {chapters.length === 0 && !showAddChapter ? (
          <div className="rounded-lg p-6 text-center" style={cardStyle}>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              暂无章节
            </p>
            <p className="text-xs mt-1" style={{ color: '#6b7280', opacity: 0.7 }}>
              点击右上角按钮添加第一章
            </p>
          </div>
        ) : (
          chapters.map((chapter, index) => (
            <div
              key={chapter.id}
              className="p-3 rounded-lg transition-all group"
              style={{
                ...cardStyle,
                backgroundColor: 'rgba(255,255,255,0.02)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'
              }}
            >
              <div className="flex items-start gap-3">
                {/* 章节序号 */}
                <span
                  className="text-sm font-mono mt-0.5"
                  style={{ minWidth: '24px', color: '#5e6ad2', opacity: 0.7 }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                {/* 章节内容 */}
                <div className="flex-1 min-w-0">
                  {editingChapterId === chapter.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveTitle(chapter.id)}
                      onKeyDown={(e) => handleKeyDown(e, chapter.id)}
                      autoFocus
                      className="w-full px-2 py-1 rounded border text-sm focus:outline-none"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderColor: '#5e6ad2',
                        color: '#f7f8f8',
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => startEditTitle(chapter)}
                      className="font-medium text-sm cursor-pointer transition-colors"
                      style={{ color: '#f7f8f8' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#5e6ad2'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#f7f8f8'
                      }}
                    >
                      {chapter.title || '未命名章节'}
                    </div>
                  )}

                  {/* 章节摘要 */}
                  {chapter.summary && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: '#6b7280' }}>
                      {chapter.summary}
                    </p>
                  )}

                  {/* 章节元信息 */}
                  <div className="flex items-center gap-3 mt-2">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: statusColors[chapter.status].bg,
                        color: statusColors[chapter.status].text,
                      }}
                    >
                      {statusLabels[chapter.status]}
                    </span>
                    <span className="text-xs" style={{ color: '#6b7280' }}>
                      {chapter.word_count.toLocaleString()} 字
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEditTitle(chapter)}
                    className="p-1.5 rounded transition-all"
                    style={{ color: '#6b7280' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
                      e.currentTarget.style.color = '#f7f8f8'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = '#6b7280'
                    }}
                    title="编辑标题"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSummaryModalChapterId(chapter.id)}
                    className="p-1.5 rounded transition-all"
                    style={{ color: '#6b7280' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
                      e.currentTarget.style.color = '#f7f8f8'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = '#6b7280'
                    }}
                    title="编辑摘要"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteChapter(chapter.id)}
                    className="p-1.5 rounded transition-all"
                    style={{ color: '#6b7280' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(196,92,92,0.15)'
                      e.currentTarget.style.color = '#d45d5d'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = '#6b7280'
                    }}
                    title="删除章节"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 添加章节输入框 */}
      {showAddChapter && (
        <div className="mt-3 p-3 rounded-lg" style={cardStyle}>
          <input
            type="text"
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddChapter()
              if (e.key === 'Escape') {
                setShowAddChapter(false)
                setNewChapterTitle('')
              }
            }}
            placeholder="输入章节标题..."
            autoFocus
            className="w-full px-3 py-2 rounded-md text-sm mb-3 transition-all focus:outline-none"
            style={{
              ...inputStyle,
              borderColor: 'rgba(94,106,210,0.3)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(94,106,210,0.5)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowAddChapter(false)
                setNewChapterTitle('')
              }}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: 'transparent',
                color: '#9ca3af',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              取消
            </button>
            <button
              onClick={handleAddChapter}
              disabled={!newChapterTitle.trim()}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
              style={{ backgroundColor: '#5e6ad2', color: '#fff' }}
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* 章节摘要编辑 Modal */}
      {summaryModalChapterId && (
        <ChapterSummaryModal
          chapter={chapters.find((c) => c.id === summaryModalChapterId)!}
          onSave={(summary) => {
            updateChapter(summaryModalChapterId, { summary })
            setSummaryModalChapterId(null)
          }}
          onClose={() => setSummaryModalChapterId(null)}
        />
      )}
    </div>
  )
}

// 章节摘要编辑弹窗
function ChapterSummaryModal({
  chapter,
  onSave,
  onClose,
}: {
  chapter: Chapter
  onSave: (summary: string) => void
  onClose: () => void
}) {
  const [summary, setSummary] = useState(chapter.summary || '')

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg p-5"
        style={{ backgroundColor: '#0f1011', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: '#f7f8f8' }}>
            编辑章节摘要
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded transition-all"
            style={{ color: '#6b7280' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = '#f7f8f8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#6b7280'
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>
          {chapter.title}
        </p>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="编写章节摘要..."
          rows={4}
          className="w-full px-3 py-2 rounded-md text-sm mb-4 resize-none transition-all focus:outline-none"
          style={{
            ...inputStyle,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(94,106,210,0.5)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
          }}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: 'transparent',
              color: '#9ca3af',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            取消
          </button>
          <button
            onClick={() => onSave(summary)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={{ backgroundColor: '#5e6ad2', color: '#fff' }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export function EntityEditor({ category }: EntityEditorProps) {
  const {
    characters,
    items,
    locations,
    factions,
    worldSettings,
    rules,
    ifLines,
    generate,
    generateRelations,
  } = useSettingsStore()

  const handleGenerate = (type: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule') => {
    generate(type)
  }

  switch (category) {
    case 'character':
      return (
        <div>
          <SectionHeader
            title="角色管理"
            count={characters.length}
            onAdd={() => {}}
            onGenerate={() => handleGenerate('character')}
          />
          <div className="space-y-3">
            {characters.map((char) => (
              <CharacterCard key={char.id} character={char} />
            ))}
            {characters.length === 0 && (
              <div className="text-center py-8" style={{ color: '#6b7280' }}>
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无角色</p>
                <p className="text-xs mt-1 opacity-70">点击下方按钮创建第一个角色</p>
              </div>
            )}
            <NewCharacterForm />
          </div>
        </div>
      )

    case 'item':
      return (
        <div>
          <SectionHeader
            title="物品管理"
            count={items.length}
            onAdd={() => {}}
            onGenerate={() => handleGenerate('item')}
          />
          <div className="space-y-3">
            {items.map((item) => (
              <EntityCard
                key={item.id}
                name={item.name}
                description={item.description}
                badge={item.owner ? `持有者: ${item.owner}` : undefined}
                badgeColor={entityColors.item}
                tags={item.tags}
                entityType="item"
                entityId={item.id}
                onDelete={() => useSettingsStore.getState().deleteItem(item.id)}
              />
            ))}
            {items.length === 0 && (
              <div className="text-center py-8" style={{ color: '#6b7280' }}>
                <p className="text-sm">暂无物品</p>
              </div>
            )}
            <AddEntityForm
              placeholder="输入物品名称..."
              onAdd={(name) => useSettingsStore.getState().addItem({ name })}
              onCancel={() => {}}
            />
          </div>
        </div>
      )

    case 'location':
      return (
        <div>
          <SectionHeader
            title="地点管理"
            count={locations.length}
            onAdd={() => {}}
            onGenerate={() => handleGenerate('location')}
          />
          <div className="space-y-3">
            {locations.map((loc) => (
              <EntityCard
                key={loc.id}
                name={loc.name}
                description={loc.description}
                badge={loc.importance === 'major' ? '重要地点' : '次要地点'}
                badgeColor={entityColors.location}
                tags={loc.tags}
                entityType="location"
                entityId={loc.id}
                onDelete={() => useSettingsStore.getState().deleteLocation(loc.id)}
              />
            ))}
            {locations.length === 0 && (
              <div className="text-center py-8" style={{ color: '#6b7280' }}>
                <p className="text-sm">暂无地点</p>
              </div>
            )}
            <AddEntityForm
              placeholder="输入地点名称..."
              onAdd={(name) => useSettingsStore.getState().addLocation({ name, importance: 'minor' })}
              onCancel={() => {}}
            />
          </div>
        </div>
      )

    case 'faction':
      return (
        <div>
          <SectionHeader
            title="势力管理"
            count={factions.length}
            onAdd={() => {}}
            onGenerate={() => handleGenerate('faction')}
          />
          <div className="space-y-3">
            {factions.map((fac) => (
              <EntityCard
                key={fac.id}
                name={fac.name}
                description={fac.description}
                badge={fac.type}
                badgeColor={entityColors.faction}
                tags={fac.tags}
                entityType="faction"
                entityId={fac.id}
                onDelete={() => useSettingsStore.getState().deleteFaction(fac.id)}
              />
            ))}
            {factions.length === 0 && (
              <div className="text-center py-8" style={{ color: '#6b7280' }}>
                <p className="text-sm">暂无势力</p>
              </div>
            )}
            <AddEntityForm
              placeholder="输入势力名称..."
              onAdd={(name) => useSettingsStore.getState().addFaction({ name, type: 'other' })}
              onCancel={() => {}}
            />
          </div>
        </div>
      )

    case 'world':
      return (
        <div>
          <SectionHeader
            title="世界观设定"
            count={worldSettings.length}
            onAdd={() => {}}
            onGenerate={() => handleGenerate('world')}
          />
          <div className="space-y-3">
            {worldSettings.map((world) => (
              <EntityCard
                key={world.id}
                name={world.name}
                description={world.description}
                badgeColor={entityColors.world}
                tags={world.tags}
                entityType="world"
                entityId={world.id}
                onDelete={() => useSettingsStore.getState().deleteWorldSetting(world.id)}
              />
            ))}
            {worldSettings.length === 0 && (
              <div className="text-center py-8" style={{ color: '#6b7280' }}>
                <p className="text-sm">暂无世界观设定</p>
              </div>
            )}
            <AddEntityForm
              placeholder="输入世界观设定名称..."
              onAdd={(name) => useSettingsStore.getState().addWorldSetting({ name, description: '' })}
              onCancel={() => {}}
            />
          </div>
        </div>
      )

    case 'rule':
      return (
        <div>
          <SectionHeader
            title="规则设定"
            count={rules.length}
            onAdd={() => {}}
            onGenerate={() => handleGenerate('rule')}
          />
          <div className="space-y-3">
            {rules.map((rule) => (
              <EntityCard
                key={rule.id}
                name={rule.name}
                description={rule.description}
                badge={rule.type}
                badgeColor={entityColors.rule}
                tags={rule.tags}
                entityType="rule"
                entityId={rule.id}
                onDelete={() => useSettingsStore.getState().deleteRule(rule.id)}
              />
            ))}
            {rules.length === 0 && (
              <div className="text-center py-8" style={{ color: '#6b7280' }}>
                <p className="text-sm">暂无规则设定</p>
              </div>
            )}
            <AddEntityForm
              placeholder="输入规则名称..."
              onAdd={(name) => useSettingsStore.getState().addRule({ name, description: '', type: 'other' })}
              onCancel={() => {}}
            />
          </div>
        </div>
      )

    case 'outline':
      return <OutlineEditor />

    case 'ifline':
      return (
        <div>
          <SectionHeader
            title="IF线管理"
            count={ifLines.length}
            onAdd={() => {}}
            onGenerate={generateRelations}
          />
          <div className="space-y-3">
            {ifLines.map((ifline) => (
              <EntityCard
                key={ifline.id}
                name={ifline.title}
                description={ifline.description}
                badge={ifline.sync_mode === 'auto' ? '自动同步' : '手动同步'}
                badgeColor={entityColors.ifline}
                tags={ifline.tags}
                entityType="ifline"
                entityId={ifline.id}
                onDelete={() => useSettingsStore.getState().deleteIFLine(ifline.id)}
              />
            ))}
            {ifLines.length === 0 && (
              <div className="text-center py-8" style={{ color: '#6b7280' }}>
                <p className="text-sm">暂无IF线</p>
              </div>
            )}
            <AddEntityForm
              placeholder="输入IF线标题..."
              onAdd={(title) => useSettingsStore.getState().addIFLine({ title, sync_mode: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })}
              onCancel={() => {}}
            />
          </div>
        </div>
      )

    default:
      return (
        <div className="text-center py-12" style={{ color: '#6b7280' }}>
          <p>选择左侧分类开始编辑</p>
        </div>
      )
  }
}

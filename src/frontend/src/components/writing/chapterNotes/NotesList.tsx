import { motion, AnimatePresence } from 'framer-motion'
import { EASE } from '@/components/shared/AnimationConfig'
import { StickyNote, Trash2, Plus, Pin, Clock, PenLine, FileText } from 'lucide-react'
import { NOTE_CATEGORIES } from './NoteTags'

interface ChapterNote {
  id: string
  content: string
  category: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
}

interface NotesListProps {
  notes: ChapterNote[]
  editingNoteId: string | null
  onEdit: (note: ChapterNote) => void
  onDelete: (noteId: string) => void
  onTogglePin: (noteId: string) => void
  onCreate: () => void
}

export function NotesList({
  notes,
  editingNoteId,
  onEdit,
  onDelete,
  onTogglePin,
  onCreate,
}: NotesListProps) {
  return (
    <motion.div
      key="list"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="p-3 space-y-2 max-h-[360px] overflow-y-auto"
    >
      {notes.length === 0 ? (
        <EmptyNotesState onCreate={onCreate} />
      ) : (
        <>
          <AnimatePresence>
            {notes.map((note) => (
              <div key={note.id} onClick={() => onEdit(note)}>
                <NoteCard
                  note={note}
                  onDelete={onDelete}
                  onTogglePin={onTogglePin}
                  isActive={editingNoteId === note.id}
                />
              </div>
            ))}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onCreate}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                       border border-dashed border-[var(--border-default)]
                       text-xs font-medium text-[var(--text-tertiary)]
                       hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/40
                       hover:bg-[var(--accent-primary)]/5
                       transition-all duration-200
                       group"
          >
            <Plus className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
            <span>添加笔记</span>
          </motion.button>
        </>
      )}
    </motion.div>
  )
}

function NoteCard({
  note,
  onDelete,
  onTogglePin,
  isActive,
}: {
  note: ChapterNote
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  isActive: boolean
}) {
  const category = NOTE_CATEGORIES.find((c) => c.id === note.category) || NOTE_CATEGORIES[4]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.25, ease: EASE.SMOOTH }}
      className={`
        relative p-3 rounded-xl border transition-all duration-200 group
        ${isActive
          ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5'
          : 'border-[var(--border-default)] bg-[var(--color-surface-base)] hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]/30'
        }
      `}
      style={{
        boxShadow: isActive ? `0 0 12px color-mix(in srgb, ${category.color} 8%, transparent)` : 'none',
      }}
    >
      {note.pinned && (
        <div className="absolute -top-1.5 -right-1.5 z-10">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              background: category.color,
              boxShadow: `0 2px 6px color-mix(in srgb, ${category.color} 25%, transparent)`,
            }}
          >
            <Pin className="w-2.5 h-2.5 text-[var(--text-inverse)]" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md"
          style={{
            background: category.bgColor,
            color: category.color,
          }}
        >
          {category.icon}
          <span className="text-[10px] font-medium">{category.label}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTogglePin(note.id)
            }}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-hover)] transition-colors"
            title={note.pinned ? '取消置顶' : '置顶'}
          >
            <Pin className={`w-3 h-3 ${note.pinned ? 'text-[var(--color-warning)]' : 'text-[var(--text-tertiary)]'}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(note.id)
            }}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[color-mix(in_srgb,var(--color-vermillion)_10%,transparent)] transition-colors"
            title="删除"
          >
            <Trash2 className="w-3 h-3 text-[var(--icon-danger)]" />
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
        {note.content}
      </p>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
          <Clock className="w-2.5 h-2.5" />
          <span>{formatTimeAgo(note.updatedAt)}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
          <PenLine className="w-2.5 h-2.5" />
          <span>{note.content.length} 字</span>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyNotesState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE.SMOOTH }}
      className="flex flex-col items-center justify-center py-10 px-6 text-center"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-outline) 8%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 5%, transparent) 100%)',
          border: '1px solid color-mix(in srgb, var(--color-outline) 12%, transparent)',
        }}
      >
        <FileText className="w-6 h-6 text-[var(--color-outline)] opacity-50" />
      </div>
      <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">暂无笔记</p>
      <p className="text-xs text-[var(--text-tertiary)] mb-4">记录灵感、伏笔或待办事项，辅助写作思路</p>
      <button
        onClick={onCreate}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/15 transition-colors"
      >
        <StickyNote className="w-3.5 h-3.5" />
        创建笔记
      </button>
    </motion.div>
  )
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

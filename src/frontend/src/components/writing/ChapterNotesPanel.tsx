import { useState, useCallback, useEffect, useRef } from 'react'
import { useWritingStore } from '@/store'
import { Textarea } from '@/components/ui/textarea'
import {
  StickyNote,
  X,
  Trash2,
  Save,
  Tag,
  Plus,
  Lightbulb,
  AlertTriangle,
  Bookmark,
  MessageSquare,
  CheckCircle2,
  Pin,
  Clock,
  PenLine,
  FileText,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface NoteCategory {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
}

const NOTE_CATEGORIES: NoteCategory[] = [
  {
    id: 'idea',
    label: '灵感',
    icon: <Lightbulb className="w-3 h-3" />,
    color: 'var(--color-character)',
    bgColor: 'color-mix(in srgb, var(--color-character) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-character) 25%, transparent)',
  },
  {
    id: 'foreshadow',
    label: '伏笔',
    icon: <Bookmark className="w-3 h-3" />,
    color: 'var(--color-item)',
    bgColor: 'color-mix(in srgb, var(--color-item) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-item) 25%, transparent)',
  },
  {
    id: 'todo',
    label: '待办',
    icon: <CheckCircle2 className="w-3 h-3" />,
    color: 'var(--color-ifline)',
    bgColor: 'color-mix(in srgb, var(--color-ifline) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-ifline) 25%, transparent)',
  },
  {
    id: 'warning',
    label: '注意',
    icon: <AlertTriangle className="w-3 h-3" />,
    color: 'var(--color-vermillion)',
    bgColor: 'color-mix(in srgb, var(--color-vermillion) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-vermillion) 25%, transparent)',
  },
  {
    id: 'note',
    label: '笔记',
    icon: <MessageSquare className="w-3 h-3" />,
    color: 'var(--color-outline)',
    bgColor: 'color-mix(in srgb, var(--color-outline) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-outline) 25%, transparent)',
  },
]

interface ChapterNote {
  id: string
  content: string
  category: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
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

/* ============================================================
   NoteCard — Elegant note card with subtle borders
   ============================================================ */

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
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
      {/* Pin indicator */}
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

      {/* Category header */}
      <div className="flex items-center justify-between mb-2"
      >
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md"
          style={{
            background: category.bgColor,
            color: category.color,
          }}
        >
          {category.icon}
          <span className="text-[10px] font-medium"
          >{category.label}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <button
            onClick={() => onTogglePin(note.id)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-hover)] transition-colors"
            title={note.pinned ? '取消置顶' : '置顶'}
          >
            <Pin className={`w-3 h-3 ${note.pinned ? 'text-[var(--color-warning)]' : 'text-[var(--text-tertiary)]'}`} />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[color-mix(in_srgb,var(--color-vermillion)_10%,transparent)] transition-colors"
            title="删除"
          >
            <Trash2 className="w-3 h-3 text-[var(--icon-danger)]" />
          </button>
        </div>
      </div>

      {/* Content */}
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap"
      >
        {note.content}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)]"
      >
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]"
        >
          <Clock className="w-2.5 h-2.5" />
          <span>{formatTimeAgo(note.updatedAt)}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]"
        >
          <PenLine className="w-2.5 h-2.5" />
          <span>{note.content.length} 字</span>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================
   Empty Notes State
   ============================================================ */

function EmptyNotesState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
      <p className="text-sm font-medium text-[var(--text-secondary)] mb-1"
      >暂无笔记</p>
      <p className="text-xs text-[var(--text-tertiary)] mb-4"
      >记录灵感、伏笔或待办事项，辅助写作思路</p>
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

/* ============================================================
   ChapterNotesPanel — Main Component
   ============================================================ */

export function ChapterNotesPanel() {
  const {
    currentChapterId,
    getChapterNote,
    setChapterNote,
    deleteChapterNote,
  } = useWritingStore()

  const [isOpen, setIsOpen] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('note')
  const [notes, setNotes] = useState<ChapterNote[]>([])
  const [activeTab, setActiveTab] = useState<'write' | 'list'>('list')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load notes when chapter changes or panel opens
  useEffect(() => {
    if (currentChapterId && isOpen) {
      const note = getChapterNote(currentChapterId)
      setNoteContent(note?.content || '')
      // Parse stored notes if they exist in a structured format
      // For now, we'll treat the single note as a "note" category
      if (note?.content) {
        setNotes([
          {
            id: 'default',
            content: note.content,
            category: 'note',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            pinned: false,
          },
        ])
      } else {
        setNotes([])
      }
    }
  }, [currentChapterId, isOpen, getChapterNote])

  const handleSave = useCallback(() => {
    if (currentChapterId && noteContent.trim()) {
      setChapterNote(currentChapterId, noteContent)
      // Update local notes
      const newNote: ChapterNote = {
        id: editingNoteId || `note-${Date.now()}`,
        content: noteContent,
        category: selectedCategory,
        createdAt: editingNoteId ? (notes.find((n) => n.id === editingNoteId)?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now(),
        pinned: false,
      }
      if (editingNoteId) {
        setNotes((prev) => prev.map((n) => (n.id === editingNoteId ? newNote : n)))
        setEditingNoteId(null)
      } else {
        setNotes((prev) => [newNote, ...prev])
      }
      setNoteContent('')
      setActiveTab('list')
    }
  }, [currentChapterId, noteContent, selectedCategory, editingNoteId, notes, setChapterNote])

  const handleDelete = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
    if (notes.length <= 1 && currentChapterId) {
      deleteChapterNote(currentChapterId)
    }
  }, [notes.length, currentChapterId, deleteChapterNote])

  const handleTogglePin = useCallback((noteId: string) => {
    setNotes((prev) => {
      const note = prev.find((n) => n.id === noteId)
      if (!note) return prev
      const updated = prev.map((n) =>
        n.id === noteId ? { ...n, pinned: !n.pinned } : n
      )
      // Sort: pinned first
      return updated.sort((a, b) => {
        if (a.pinned === b.pinned) return b.updatedAt - a.updatedAt
        return a.pinned ? -1 : 1
      })
    })
  }, [])

  const handleEdit = useCallback((note: ChapterNote) => {
    setNoteContent(note.content)
    setSelectedCategory(note.category)
    setEditingNoteId(note.id)
    setActiveTab('write')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [])

  const handleClear = useCallback(() => {
    if (currentChapterId) {
      deleteChapterNote(currentChapterId)
      setNoteContent('')
      setNotes([])
      setEditingNoteId(null)
    }
  }, [currentChapterId, deleteChapterNote])

  // Auto-save after 1 second of no typing
  useEffect(() => {
    if (!currentChapterId || !isOpen) return
    const timeout = setTimeout(() => {
      if (noteContent.trim()) {
        setChapterNote(currentChapterId, noteContent)
      }
    }, 1000)
    return () => clearTimeout(timeout)
  }, [noteContent, currentChapterId, isOpen, setChapterNote])

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId)
    const category = NOTE_CATEGORIES.find((c) => c.id === categoryId)
    if (category) {
      const tagText = `[${category.label}] `
      if (noteContent && !noteContent.startsWith(tagText)) {
        setNoteContent((prev) => {
          const tagPattern = /^\[[^\]]+\]\s*/
          if (tagPattern.test(prev)) {
            return prev.replace(tagPattern, tagText)
          }
          return tagText + prev
        })
      } else if (!noteContent) {
        setNoteContent(tagText)
      }
    }
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const activeCategory = NOTE_CATEGORIES.find((c) => c.id === selectedCategory)
  const pinnedCount = notes.filter((n) => n.pinned).length

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!isOpen ? (
        <motion.button
          key="notes-trigger"
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 12 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setIsOpen(true)}
          className="fixed right-4 bottom-14 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium
                     bg-[var(--color-surface-raised)] border border-[var(--border-default)] text-[var(--text-secondary)]
                     shadow-float transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated-lg)]"
          style={{
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          title="章节笔记"
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
          >
            <StickyNote className="w-4 h-4 text-[var(--icon-secondary)]" />
          </motion.div>
          <span>笔记</span>
          {notes.length > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold"
              style={{
                background: 'var(--color-ifline)',
                color: 'white',
              }}
            >
              {notes.length}
            </motion.span>
          )}
        </motion.button>
      ) : (
        <motion.div
          key="notes-panel"
          initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-4 bottom-14 z-50 w-80 flex flex-col rounded-2xl overflow-hidden"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-float), 0 0 0 1px var(--border-subtle)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Subtle panel texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.012]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] relative overflow-hidden"
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-ifline) 3%, transparent) 0%, transparent 60%)',
              }}
            />
            <div className="flex items-center gap-2.5 relative z-10"
            >
              <motion.div
                initial={{ rotate: -15, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              >
                <StickyNote className="w-4 h-4 text-[var(--color-ifline)]" />
              </motion.div>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)]"
                >章节笔记</span>
                {notes.length > 0 && (
                  <span className="ml-2 text-[10px] text-[var(--text-tertiary)]"
                  >
                    {notes.length} 条{pinnedCount > 0 && ` · ${pinnedCount} 置顶`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 relative z-10"
            >
              {/* Tab toggle */}
              <div className="flex items-center mr-1 bg-[var(--color-surface-base)] rounded-lg p-0.5"
              >
                <button
                  onClick={() => setActiveTab('list')}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    activeTab === 'list'
                      ? 'bg-[var(--color-surface-hover)] text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  列表
                </button>
                <button
                  onClick={() => {
                    setActiveTab('write')
                    setEditingNoteId(null)
                    setNoteContent('')
                  }}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    activeTab === 'write'
                      ? 'bg-[var(--color-surface-hover)] text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  新建
                </button>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleSave}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[color-mix(in_srgb,var(--color-ifline)_10%,transparent)] transition-colors duration-150"
                title="保存笔记"
              >
                <Save className="w-3.5 h-3.5 text-[var(--icon-secondary)]" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleClear}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[color-mix(in_srgb,var(--color-vermillion)_10%,transparent)] transition-colors duration-150"
                title="清空笔记"
              >
                <Trash2 className="w-3.5 h-3.5 text-[var(--icon-danger)]" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
                title="关闭"
              >
                <X className="w-3.5 h-3.5 text-[var(--icon-secondary)]" />
              </motion.button>
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10"
          >
            <AnimatePresence mode="wait"
            >
              {activeTab === 'write' ? (
                <motion.div
                  key="write"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Category Tags */}
                  <div className="px-4 pt-3 pb-2"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap"
                    >
                      <Tag className="w-3 h-3 mr-0.5 text-[var(--icon-muted)]" />
                      {NOTE_CATEGORIES.map((category, index) => (
                        <motion.button
                          key={category.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            delay: index * 0.04,
                            duration: 0.2,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          onClick={() => handleCategorySelect(category.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                                     transition-all duration-150 hover:scale-105 active:scale-95"
                          style={{
                            color: selectedCategory === category.id ? category.color : 'var(--text-tertiary)',
                            background:
                              selectedCategory === category.id
                                ? category.bgColor
                                : 'color-mix(in srgb, var(--paper-100) 3%, transparent)',
                            border:
                              selectedCategory === category.id
                                ? `1px solid ${category.borderColor}`
                                : '1px solid transparent',
                            boxShadow: selectedCategory === category.id
                              ? `0 0 8px ${category.color}20`
                              : 'none',
                          }}
                          title={`插入${category.label}标签`}
                        >
                          {category.icon}
                          <span>{category.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Active category indicator */}
                  <AnimatePresence mode="wait"
                  >
                    {activeCategory && (
                      <motion.div
                        key={activeCategory.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-3 pb-1"
                      >
                        <div
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md"
                          style={{
                            background: activeCategory.bgColor,
                            color: activeCategory.color,
                          }}
                        >
                          {activeCategory.icon}
                          <span className="text-[11px]"
                          >当前标签: {activeCategory.label}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Textarea */}
                  <div className="p-3"
                  >
                    <Textarea
                      ref={textareaRef}
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="记录本章灵感、伏笔、待办事项..."
                      className="min-h-[140px] resize-none text-sm transition-all duration-200
                                 bg-[var(--color-surface-base)] border border-[var(--border-default)] text-[var(--text-secondary)]
                                 focus:border-[var(--accent-primary)]/40 focus:ring-1 focus:ring-[var(--accent-primary)]/20"
                    />

                    <div className="flex items-center justify-between mt-2"
                    >
                      <p className="text-[10px] text-[var(--text-tertiary)]"
                      >
                        自动保存 · 按章节独立存储
                      </p>
                      <div className="flex items-center gap-2"
                      >
                        {noteContent.length > 0 && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[10px] text-[var(--text-tertiary)]"
                          >
                            {noteContent.length} 字
                          </motion.span>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSave}
                          disabled={!noteContent.trim()}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium
                                     bg-[var(--accent-primary)] text-white
                                     hover:bg-[var(--accent-95)]
                                     disabled:opacity-40 disabled:cursor-not-allowed
                                     transition-all duration-150"
                        >
                          {editingNoteId ? '更新' : '保存'}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  className="p-3 space-y-2 max-h-[360px] overflow-y-auto"
                >
                  {notes.length === 0 ? (
                    <EmptyNotesState onCreate={() => setActiveTab('write')} />
                  ) : (
                    <>
                      <AnimatePresence>
                        {notes.map((note) => (
                          <div key={note.id} onClick={() => handleEdit(note)}>
                            <NoteCard
                              note={note}
                              onDelete={handleDelete}
                              onTogglePin={handleTogglePin}
                              isActive={editingNoteId === note.id}
                            />
                          </div>
                        ))}
                      </AnimatePresence>

                      {/* Add note button */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          setEditingNoteId(null)
                          setNoteContent('')
                          setActiveTab('write')
                        }}
                        className="
                          w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                          border border-dashed border-[var(--border-default)]
                          text-xs font-medium text-[var(--text-tertiary)]
                          hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/40
                          hover:bg-[var(--accent-primary)]/5
                          transition-all duration-200
                          group
                        "
                      >
                        <Plus className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
                        <span>添加笔记</span>
                      </motion.button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 flex items-center justify-between border-t border-[var(--border-subtle)] relative z-10"
          >
            <span className="text-[10px] text-[var(--text-tertiary)]"
            >
              {currentChapterId ? '已关联当前章节' : '未选择章节'}
            </span>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: notes.length > 0 ? 1 : 0 }}
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-ifline)]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

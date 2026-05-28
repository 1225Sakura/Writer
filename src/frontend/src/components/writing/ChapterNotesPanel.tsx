import { useState, useCallback, useEffect, useRef } from 'react'
import { useWritingStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import { StickyNote, X, Trash2, Save } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { NoteEditor } from './chapterNotes/NoteEditor'
import { NotesList } from './chapterNotes/NotesList'

interface ChapterNote {
  id: string
  content: string
  category: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
}

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

  useEffect(() => {
    if (currentChapterId && isOpen) {
      const note = getChapterNote(currentChapterId)
      setNoteContent(note?.content || '')
      if (note?.content) {
        setNotes([{
          id: 'default',
          content: note.content,
          category: note.category || 'note',
          createdAt: note.createdAt || Date.now(),
          updatedAt: note.updatedAt || Date.now(),
          pinned: note.pinned || false,
        }])
      } else {
        setNotes([])
      }
    }
  }, [currentChapterId, isOpen, getChapterNote])

  const handleSave = useCallback(() => {
    if (currentChapterId && noteContent.trim()) {
      const existingPinned = editingNoteId ? (notes.find((n) => n.id === editingNoteId)?.pinned ?? false) : false
      setChapterNote(currentChapterId, noteContent, selectedCategory, existingPinned)
      const newNote: ChapterNote = {
        id: editingNoteId || `note-${Date.now()}`,
        content: noteContent,
        category: selectedCategory,
        createdAt: editingNoteId ? (notes.find((n) => n.id === editingNoteId)?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now(),
        pinned: existingPinned,
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
      const newPinned = !note.pinned
      if (currentChapterId) {
        setChapterNote(currentChapterId, note.content, note.category, newPinned)
      }
      const updated = prev.map((n) =>
        n.id === noteId ? { ...n, pinned: newPinned } : n
      )
      return updated.sort((a, b) => {
        if (a.pinned === b.pinned) return b.updatedAt - a.updatedAt
        return a.pinned ? -1 : 1
      })
    })
  }, [currentChapterId, setChapterNote])

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

  useEffect(() => {
    if (!currentChapterId || !isOpen) return
    const timeout = setTimeout(() => {
      if (noteContent.trim()) {
        setChapterNote(currentChapterId, noteContent, selectedCategory)
      }
    }, 1000)
    return () => clearTimeout(timeout)
  }, [noteContent, currentChapterId, isOpen, selectedCategory, setChapterNote])

  const pinnedCount = notes.filter((n) => n.pinned).length

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!isOpen ? (
        <motion.button
          key="notes-trigger"
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 12 }}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
          onClick={() => setIsOpen(true)}
          className="fixed right-4 bottom-14 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium
                     bg-[var(--color-surface-raised)] border border-[var(--border-default)] text-[var(--text-secondary)]
                     shadow-float transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated-lg)]"
          title="章节笔记"
          aria-label="章节笔记"
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
              style={{ background: 'var(--color-ifline)', color: 'var(--text-inverse)' }}
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
          transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
          className="fixed right-4 bottom-14 z-50 w-80 flex flex-col rounded-2xl overflow-hidden"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-float), 0 0 0 1px var(--border-subtle)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-[0.012]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />

          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-ifline) 3%, transparent) 0%, transparent 60%)' }} />
            <div className="flex items-center gap-2.5 relative z-10">
              <motion.div initial={{ rotate: -15, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}>
                <StickyNote className="w-4 h-4 text-[var(--color-ifline)]" />
              </motion.div>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">章节笔记</span>
                {notes.length > 0 && (
                  <span className="ml-2 text-[10px] text-[var(--text-tertiary)]">
                    {notes.length} 条{pinnedCount > 0 && ` · ${pinnedCount} 置顶`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 relative z-10">
              <div className="flex items-center mr-1 bg-[var(--color-surface-base)] rounded-lg p-0.5">
                <button onClick={() => setActiveTab('list')} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${activeTab === 'list' ? 'bg-[var(--color-surface-hover)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>列表</button>
                <button onClick={() => { setActiveTab('write'); setEditingNoteId(null); setNoteContent('') }} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${activeTab === 'write' ? 'bg-[var(--color-surface-hover)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>新建</button>
              </div>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleSave} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[color-mix(in_srgb,var(--color-ifline)_10%,transparent)] transition-colors duration-150" title="保存笔记">
                <Save className="w-3.5 h-3.5 text-[var(--icon-secondary)]" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleClear} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[color-mix(in_srgb,var(--color-vermillion)_10%,transparent)] transition-colors duration-150" title="清空笔记">
                <Trash2 className="w-3.5 h-3.5 text-[var(--icon-danger)]" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setIsOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors duration-150" title="关闭">
                <X className="w-3.5 h-3.5 text-[var(--icon-secondary)]" />
              </motion.button>
            </div>
          </div>

          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {activeTab === 'write' ? (
                <NoteEditor
                  noteContent={noteContent}
                  setNoteContent={setNoteContent}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  editingNoteId={editingNoteId}
                  onSave={handleSave}
                />
              ) : (
                <NotesList
                  notes={notes}
                  editingNoteId={editingNoteId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onTogglePin={handleTogglePin}
                  onCreate={() => { setEditingNoteId(null); setNoteContent(''); setActiveTab('write') }}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="px-3 py-2 flex items-center justify-between border-t border-[var(--border-subtle)] relative z-10">
            <span className="text-[10px] text-[var(--text-tertiary)]">
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

import { useState, useCallback, useEffect, useRef } from 'react'
import { useWritingStore } from '@/store'
import { Textarea } from '@/components/ui/textarea'
import {
  StickyNote,
  X,
  Trash2,
  Save,
  Tag,
  // Plus,
  Lightbulb,
  AlertTriangle,
  Bookmark,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface NoteCategory {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
}

const NOTE_CATEGORIES: NoteCategory[] = [
  {
    id: 'idea',
    label: '灵感',
    icon: <Lightbulb className="w-3 h-3" />,
    color: '#e8b87d',
    bgColor: 'rgba(232, 184, 125, 0.12)',
  },
  {
    id: 'foreshadow',
    label: '伏笔',
    icon: <Bookmark className="w-3 h-3" />,
    color: '#9b7ed9',
    bgColor: 'rgba(155, 126, 217, 0.12)',
  },
  {
    id: 'todo',
    label: '待办',
    icon: <CheckCircle2 className="w-3 h-3" />,
    color: '#7eb84a',
    bgColor: 'rgba(126, 184, 74, 0.12)',
  },
  {
    id: 'warning',
    label: '注意',
    icon: <AlertTriangle className="w-3 h-3" />,
    color: '#c45c5c',
    bgColor: 'rgba(196, 92, 92, 0.12)',
  },
  {
    id: 'note',
    label: '笔记',
    icon: <MessageSquare className="w-3 h-3" />,
    color: '#5b8ee8',
    bgColor: 'rgba(91, 142, 232, 0.12)',
  },
]

interface ChapterNote {
  id: string
  content: string
  category: string
  createdAt: number
  updatedAt: number
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
  const [_notes, _setNotes] = useState<ChapterNote[]>([])
  const [_activeTab, _setActiveTab] = useState<'write' | 'list'>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load notes when chapter changes or panel opens
  useEffect(() => {
    if (currentChapterId && isOpen) {
      const note = getChapterNote(currentChapterId)
      setNoteContent(note?.content || '')
      // Parse stored notes if they exist in a structured format
      // For now, we'll treat the single note as a "note" category
    }
  }, [currentChapterId, isOpen, getChapterNote])

  const handleSave = useCallback(() => {
    if (currentChapterId) {
      setChapterNote(currentChapterId, noteContent)
    }
  }, [currentChapterId, noteContent, setChapterNote])

  const handleClear = useCallback(() => {
    if (currentChapterId) {
      deleteChapterNote(currentChapterId)
      setNoteContent('')
    }
  }, [currentChapterId, deleteChapterNote])

  // Auto-save after 1 second of no typing
  useEffect(() => {
    if (!currentChapterId || !isOpen) return
    const timeout = setTimeout(() => {
      setChapterNote(currentChapterId, noteContent)
    }, 1000)
    return () => clearTimeout(timeout)
  }, [noteContent, currentChapterId, isOpen, setChapterNote])

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId)
    // Insert category tag at cursor position or beginning
    const category = NOTE_CATEGORIES.find((c) => c.id === categoryId)
    if (category) {
      const tagText = `[${category.label}] `
      if (noteContent && !noteContent.startsWith(tagText)) {
        setNoteContent((prev) => {
          // If there's already a category tag at the start, replace it
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
    // Focus textarea after selecting category
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const activeCategory = NOTE_CATEGORIES.find((c) => c.id === selectedCategory)

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
                     shadow-float transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
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
          {noteContent && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-2 h-2 rounded-full"
              style={{
                background: 'var(--color-ifline)',
                boxShadow: '0 0 6px color-mix(in srgb, var(--color-ifline) 40%, transparent)',
              }}
            />
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
            boxShadow: '0 16px 48px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Refined Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] relative overflow-hidden"
          >
            {/* Subtle header gradient */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-ifline) 3%, transparent) 0%, transparent 60%)',
              }}
            />
            <div className="flex items-center gap-2.5 relative z-10">
              <motion.div
                initial={{ rotate: -15, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              >
                <StickyNote className="w-4 h-4 text-[var(--color-ifline)]" />
              </motion.div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">章节笔记</span>
            </div>
            <div className="flex items-center gap-0.5 relative z-10">
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

          {/* Category Tags */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
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
                        ? `1px solid ${category.color}30`
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
          <AnimatePresence mode="wait">
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
                  <span className="text-[11px]">当前标签: {activeCategory.label}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          <div className="p-3">
            <Textarea
              ref={textareaRef}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="记录本章灵感、伏笔、待办事项..."
              className="min-h-[140px] resize-none text-sm transition-all duration-200
                         bg-[var(--color-surface-base)] border border-[var(--border-default)] text-[var(--text-secondary)]"
            />

            {/* Quick action hints */}
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-[var(--text-tertiary)]">
                自动保存 · 按章节独立存储
              </p>
              <div className="flex items-center gap-1">
                {noteContent.length > 0 && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-[var(--text-tertiary)]"
                  >
                    {noteContent.length} 字
                  </motion.span>
                )}
              </div>
            </div>
          </div>

          {/* Footer with chapter info */}
          <div className="px-3 py-2 flex items-center justify-between border-t border-[var(--border-subtle)]"
          >
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {currentChapterId ? '已关联当前章节' : '未选择章节'}
            </span>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: noteContent ? 1 : 0 }}
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-ifline)]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { useState, useCallback, useEffect, useRef } from 'react'
import { useWritingStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
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
          initial={{ opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setIsOpen(true)}
          className="fixed right-4 bottom-14 z-50 flex items-center gap-2 px-3 py-2 rounded-lg
                     bg-[#191a1b] border border-[rgba(255,255,255,0.08)]
                     text-[#d0d6e0] text-xs font-medium
                     hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200
                     shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          title="章节笔记"
        >
          <StickyNote className="w-4 h-4 text-[#e8b87d]" />
          <span>笔记</span>
          {noteContent && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-1.5 h-1.5 rounded-full bg-[#7eb84a]"
            />
          )}
        </motion.button>
      ) : (
        <motion.div
          key="notes-panel"
          initial={{ opacity: 0, scale: 0.92, y: 16, x: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16, x: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-4 bottom-14 z-50 w-80 flex flex-col
                      bg-[#191a1b] border border-[rgba(255,255,255,0.08)] rounded-xl
                      overflow-hidden"
          style={{
            boxShadow: `
              0 4px 20px rgba(0, 0, 0, 0.25),
              0 8px 40px rgba(0, 0, 0, 0.15),
              0 0 0 1px rgba(255, 255, 255, 0.04)
            `,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5
                          border-b border-[rgba(255,255,255,0.06)]"
          >
            <div className="flex items-center gap-2">
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <StickyNote className="w-4 h-4 text-[#e8b87d]" />
              </motion.div>
              <span className="text-sm font-medium text-[#f7f8f8]">章节笔记</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                onClick={handleSave}
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[rgba(126,184,74,0.1)] transition-colors duration-150"
                title="保存笔记"
              >
                <Save className="w-3.5 h-3.5 text-[#7eb84a]" />
              </Button>
              <Button
                onClick={handleClear}
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[rgba(196,92,92,0.1)] transition-colors duration-150"
                title="清空笔记"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#c45c5c]" />
              </Button>
              <Button
                onClick={() => setIsOpen(false)}
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[rgba(255,255,255,0.06)] transition-colors duration-150"
                title="关闭"
              >
                <X className="w-3.5 h-3.5 text-[#d0d6e0]" />
              </Button>
            </div>
          </div>

          {/* Category Tags */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className="w-3 h-3 text-[#8a8f98] mr-0.5" />
              {NOTE_CATEGORIES.map((category, index) => (
                <motion.button
                  key={category.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: index * 0.04,
                    duration: 0.15,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  onClick={() => handleCategorySelect(category.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium
                             transition-all duration-150 hover:scale-105 active:scale-95"
                  style={{
                    color: selectedCategory === category.id ? category.color : '#8a8f98',
                    background:
                      selectedCategory === category.id
                        ? category.bgColor
                        : 'rgba(255, 255, 255, 0.03)',
                    border:
                      selectedCategory === category.id
                        ? `1px solid ${category.color}30`
                        : '1px solid transparent',
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
              className="min-h-[140px] resize-none bg-[#0f1011] border-[rgba(255,255,255,0.08)]
                         text-[#d0d6e0] text-sm placeholder:text-[#d0d6e0]/40
                         focus:border-[#5e6ad2]/50 focus:ring-1 focus:ring-[#5e6ad2]/20
                         transition-all duration-200"
            />

            {/* Quick action hints */}
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-[#d0d6e0]/50">
                自动保存 · 按章节独立存储
              </p>
              <div className="flex items-center gap-1">
                {noteContent.length > 0 && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-[#8a8f98]"
                  >
                    {noteContent.length} 字
                  </motion.span>
                )}
              </div>
            </div>
          </div>

          {/* Footer with chapter info */}
          <div
            className="px-3 py-2 border-t border-[rgba(255,255,255,0.06)]
                       flex items-center justify-between"
          >
            <span className="text-[10px] text-[#8a8f98]">
              {currentChapterId ? '已关联当前章节' : '未选择章节'}
            </span>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: noteContent ? 1 : 0 }}
              className="w-1.5 h-1.5 rounded-full bg-[#7eb84a]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

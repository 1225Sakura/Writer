import { useState, useCallback, useEffect } from 'react'
import { useWritingStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { StickyNote, X, Trash2, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function ChapterNotesPanel() {
  const {
    currentChapterId,
    getChapterNote,
    setChapterNote,
    deleteChapterNote,
  } = useWritingStore()

  const [isOpen, setIsOpen] = useState(false)
  const [noteContent, setNoteContent] = useState('')

  // Load note when chapter changes or panel opens
  useEffect(() => {
    if (currentChapterId && isOpen) {
      const note = getChapterNote(currentChapterId)
      setNoteContent(note?.content || '')
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

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!isOpen ? (
        <motion.button
          key="notes-trigger"
          initial={{ opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setIsOpen(true)}
          className="fixed right-4 bottom-14 z-50 flex items-center gap-2 px-3 py-2 rounded-lg
                     bg-[#191a1b] border border-[rgba(255,255,255,0.08)]
                     text-[#d0d6e0] text-xs font-medium
                     hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200
                     shadow-lg"
          title="章节笔记"
        >
          <StickyNote className="w-4 h-4 text-[#e8b87d]" />
          <span>笔记</span>
        </motion.button>
      ) : (
        <motion.div
          key="notes-panel"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-4 bottom-14 z-50 w-72 flex flex-col
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
                          border-b border-[rgba(255,255,255,0.08)]"
          >
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-[#e8b87d]" />
              <span className="text-sm font-medium text-[#f7f8f8]">章节笔记</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                onClick={handleSave}
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[rgba(126,184,74,0.1)]"
                title="保存笔记"
              >
                <Save className="w-3.5 h-3.5 text-[#7eb84a]" />
              </Button>
              <Button
                onClick={handleClear}
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[rgba(196,92,92,0.1)]"
                title="清空笔记"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#c45c5c]" />
              </Button>
              <Button
                onClick={() => setIsOpen(false)}
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[rgba(255,255,255,0.06)]"
                title="关闭"
              >
                <X className="w-3.5 h-3.5 text-[#d0d6e0]" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-3">
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="记录本章灵感、伏笔、待办事项..."
              className="min-h-[160px] resize-none bg-[#0f1011] border-[rgba(255,255,255,0.08)]
                         text-[#d0d6e0] text-sm placeholder:text-[#d0d6e0]/40
                         focus:border-[#5e6ad2]/50 focus:ring-1 focus:ring-[#5e6ad2]/20"
            />
            <p className="mt-2 text-[10px] text-[#d0d6e0]/50">
              自动保存 · 按章节独立存储
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

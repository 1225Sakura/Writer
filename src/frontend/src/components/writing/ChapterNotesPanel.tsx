import { useState, useCallback, useEffect } from 'react'
import { useWritingStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { StickyNote, X, Trash2, Save } from 'lucide-react'

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

  if (!isOpen) {
    return (
      <button
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
      </button>
    )
  }

  return (
    <div className="fixed right-4 bottom-14 z-50 w-72 flex flex-col
                    bg-[#191a1b] border border-[rgba(255,255,255,0.08)] rounded-xl
                    shadow-xl overflow-hidden"
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
            className="h-7 w-7"
            title="保存笔记"
          >
            <Save className="w-3.5 h-3.5 text-[#7eb84a]" />
          </Button>
          <Button
            onClick={handleClear}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="清空笔记"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#c45c5c]" />
          </Button>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
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
    </div>
  )
}

import { useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { motion } from 'framer-motion'
import { Tag } from 'lucide-react'
import { NOTE_CATEGORIES } from './NoteTags'

interface NoteEditorProps {
  noteContent: string
  setNoteContent: (content: string) => void
  selectedCategory: string
  setSelectedCategory: (category: string) => void
  editingNoteId: string | null
  onSave: () => void
}

export function NoteEditor({
  noteContent,
  setNoteContent,
  selectedCategory,
  setSelectedCategory,
  editingNoteId,
  onSave,
}: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeCategory = NOTE_CATEGORIES.find((c) => c.id === selectedCategory)

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId)
    const category = NOTE_CATEGORIES.find((c) => c.id === categoryId)
    if (category) {
      const tagText = `[${category.label}] `
      if (noteContent && !noteContent.startsWith(tagText)) {
        const newContent = noteContent.replace(/^\[[^\]]+\]\s*/, tagText)
        setNoteContent(newContent)
      } else if (!noteContent) {
        setNoteContent(tagText)
      }
    }
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  return (
    <motion.div
      key="write"
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
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

      <div className="p-3">
        <Textarea
          ref={textareaRef}
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="记录本章灵感、伏笔、待办事项..."
          className="min-h-[140px] resize-none text-sm transition-all duration-200
                     bg-[var(--color-surface-base)] border border-[var(--border-default)] text-[var(--text-secondary)]
                     focus:border-[var(--accent-primary)]/40 focus:ring-1 focus:ring-[var(--accent-primary)]/20"
        />

        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-[var(--text-tertiary)]">
            自动保存 · 按章节独立存储
          </p>
          <div className="flex items-center gap-2">
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
              onClick={onSave}
              disabled={!noteContent.trim()}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium
                         bg-[var(--accent-primary)] text-[var(--text-inverse)]
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
  )
}

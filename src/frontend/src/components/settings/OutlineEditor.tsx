/**
 * OutlineEditor — Story outline and chapter management.
 * Extracted from EntityActions.tsx.
 */

import { useSettingsStore } from '@/store/settingsStore'
import type { Chapter } from '@/shared/types'
import { Trash2, Edit2, Plus, FileText } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { useState } from 'react'
import { cardStyle } from './EntityCard'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { FloatingLabelInput } from './EntityFieldGroup'
import { ChapterSummaryModal } from './ChapterSummaryModal'

const statusColors: Record<string, { bg: string; text: string }> = {
  planning: { bg: 'var(--color-surface-overlay)', text: 'var(--text-tertiary)' },
  writing: { bg: 'var(--accent-muted)', text: 'var(--accent-primary)' },
  completed: { bg: 'rgba(126,184,74,0.15)', text: 'var(--color-ifline)' },
}

const statusLabels: Record<string, string> = {
  planning: '规划中',
  writing: '写作中',
  completed: '已完成',
}

function ChapterItem({
  chapter,
  index,
  isEditing,
  editingTitle,
  onStartEdit,
  onSaveTitle,
  onEditTitleChange,
  onEditKeyDown,
  onEditSummary,
  onDelete,
}: {
  chapter: Chapter
  index: number
  isEditing: boolean
  editingTitle: string
  onStartEdit: () => void
  onSaveTitle: () => void
  onEditTitleChange: (v: string) => void
  onEditKeyDown: (e: React.KeyboardEvent) => void
  onEditSummary: () => void
  onDelete: () => void
}) {
  return (
    <motion.div
      className="p-3 rounded-lg group"
      style={{ ...cardStyle, backgroundColor: 'var(--color-surface-raised)' }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg)' }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)' }}
      whileHover={{ x: 2 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      <div className="flex items-start gap-3">
        <span className="text-sm font-mono mt-0.5" style={{ minWidth: '24px', color: 'var(--color-outline)', opacity: 0.7 }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input type="text" value={editingTitle} onChange={(e) => onEditTitleChange(e.target.value)}
              onBlur={onSaveTitle} onKeyDown={onEditKeyDown} autoFocus
              className="w-full px-2 py-1 rounded border text-sm focus:outline-none"
              style={{ backgroundColor: 'var(--color-surface-base)', borderColor: 'var(--color-outline)', color: 'var(--text-primary)' }} />
          ) : (
            <div role="button" tabIndex={0} onClick={onStartEdit}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStartEdit() } }}
              className="font-medium text-sm cursor-pointer transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-outline)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}>
              {chapter.title || '未命名章节'}
            </div>
          )}
          {chapter.summary && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>{chapter.summary}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: statusColors[chapter.status].bg, color: statusColors[chapter.status].text }}>
              {statusLabels[chapter.status]}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{chapter.word_count.toLocaleString()} 字</span>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <motion.button onClick={onStartEdit} className="p-1.5 rounded transition-all" style={{ color: 'var(--text-tertiary)' }}
            whileHover={{ backgroundColor: 'var(--border-default)', color: 'var(--text-primary)' }} whileTap={{ scale: 0.9 }} aria-label="编辑标题" title="编辑标题">
            <Icon icon={Edit2} size="sm" color="inherit" />
          </motion.button>
          <motion.button onClick={onEditSummary} className="p-1.5 rounded transition-all" style={{ color: 'var(--text-tertiary)' }}
            whileHover={{ backgroundColor: 'var(--border-default)', color: 'var(--text-primary)' }} whileTap={{ scale: 0.9 }} aria-label="编辑摘要" title="编辑摘要">
            <Icon icon={FileText} size="sm" color="inherit" />
          </motion.button>
          <motion.button onClick={onDelete} className="p-1.5 rounded transition-all" style={{ color: 'var(--text-tertiary)' }}
            whileHover={{ backgroundColor: 'var(--vermillion-muted)', color: 'var(--color-danger)' }} whileTap={{ scale: 0.9 }} aria-label="删除章节" title="删除章节">
            <Icon icon={Trash2} size="sm" color="inherit" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

export function OutlineEditor() {
  const { outline, chapters, addChapter, updateChapter, deleteChapter, updateOutline } = useSettingsStore()
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [summaryModalChapterId, setSummaryModalChapterId] = useState<number | null>(null)
  const [isCreatingOutline, setIsCreatingOutline] = useState(false)
  const [newOutlineTitle, setNewOutlineTitle] = useState('')
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [showAddChapter, setShowAddChapter] = useState(false)
  const [isEditingOutlineTitle, setIsEditingOutlineTitle] = useState(false)
  const [outlineTitleDraft, setOutlineTitleDraft] = useState('')
  const [isEditingOutlineDesc, setIsEditingOutlineDesc] = useState(false)
  const [outlineDescDraft, setOutlineDescDraft] = useState('')

  const handleCreateOutline = () => {
    if (newOutlineTitle.trim()) {
      useSettingsStore.getState().setOutline({ id: Date.now(), title: newOutlineTitle.trim(), description: '' })
      setIsCreatingOutline(false)
      setNewOutlineTitle('')
    }
  }

  const handleAddChapter = () => {
    if (newChapterTitle.trim()) {
      addChapter({
        title: newChapterTitle.trim(), summary: '', status: 'planning', word_count: 0,
        chapter_order: chapters.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
      setNewChapterTitle('')
      setShowAddChapter(false)
    }
  }

  const handleSaveTitle = (chapterId: number) => {
    if (editingTitle.trim()) updateChapter(chapterId, { title: editingTitle.trim() })
    setEditingChapterId(null)
    setEditingTitle('')
  }

  if (!outline) {
    return (
      <div>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>大纲管理</h2>
        <div className="rounded-lg p-8 text-center" style={cardStyle}>
          <Icon icon={FileText} size="lg" color="muted" className="mx-auto mb-3" />
          <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>尚未创建故事大纲</p>
          {isCreatingOutline ? (
            <div className="space-y-3 max-w-sm mx-auto">
              <FloatingLabelInput value={newOutlineTitle} onChange={setNewOutlineTitle}
                placeholder="输入大纲标题..." label="标题" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateOutline(); if (e.key === 'Escape') setIsCreatingOutline(false) }}
                required maxLength={100} />
              <div className="flex gap-2 justify-center">
                <motion.button onClick={() => setIsCreatingOutline(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all"
                  style={{ backgroundColor: 'transparent', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)' }}
                  whileTap={{ scale: 0.97 }}>取消</motion.button>
                <motion.button onClick={handleCreateOutline} disabled={!newOutlineTitle.trim()}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40 flex items-center gap-2"
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--paper-100)' }}
                  whileTap={{ scale: 0.97 }}>
                  <Icon icon={Plus} size="sm" color="inherit" />创建
                </motion.button>
              </div>
            </div>
          ) : (
            <motion.button onClick={() => setIsCreatingOutline(true)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--border-default)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg)' }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>创建大纲</motion.button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>大纲管理</h2>
          <motion.span key={chapters.length} className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-outline) 15%, transparent)', color: 'var(--color-outline)' }}
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}>{chapters.length} 章节</motion.span>
        </div>
        <motion.button onClick={() => setShowAddChapter(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--border-default)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg)' }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Icon icon={Plus} size="xs" color="secondary" />新增章节
        </motion.button>
      </div>

      <div className="mb-4 pb-3 space-y-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {isEditingOutlineTitle ? (
          <input type="text" value={outlineTitleDraft} onChange={(e) => setOutlineTitleDraft(e.target.value)}
            onBlur={() => { if (outlineTitleDraft.trim()) updateOutline({ title: outlineTitleDraft.trim() }); setIsEditingOutlineTitle(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { if (outlineTitleDraft.trim()) updateOutline({ title: outlineTitleDraft.trim() }); setIsEditingOutlineTitle(false) } if (e.key === 'Escape') setIsEditingOutlineTitle(false) }}
            autoFocus
            className="w-full px-2 py-1 rounded border text-sm font-medium focus:outline-none"
            style={{ backgroundColor: 'var(--color-surface-base)', borderColor: 'var(--color-outline)', color: 'var(--text-primary)' }} />
        ) : (
          <h3 role="button" tabIndex={0} onClick={() => { setOutlineTitleDraft(outline.title); setIsEditingOutlineTitle(true) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOutlineTitleDraft(outline.title); setIsEditingOutlineTitle(true) } }}
            className="text-sm font-medium cursor-pointer transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-outline)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}>
            {outline.title}
          </h3>
        )}
        {isEditingOutlineDesc ? (
          <textarea value={outlineDescDraft} onChange={(e) => setOutlineDescDraft(e.target.value)}
            onBlur={() => { updateOutline({ description: outlineDescDraft.trim() }); setIsEditingOutlineDesc(false) }}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsEditingOutlineDesc(false) }}
            autoFocus rows={3}
            className="w-full px-2 py-1 rounded border text-xs focus:outline-none resize-y"
            style={{ backgroundColor: 'var(--color-surface-base)', borderColor: 'var(--color-outline)', color: 'var(--text-primary)' }} />
        ) : (
          <p role="button" tabIndex={0} onClick={() => { setOutlineDescDraft(outline.description || ''); setIsEditingOutlineDesc(true) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOutlineDescDraft(outline.description || ''); setIsEditingOutlineDesc(true) } }}
            className="text-xs cursor-pointer transition-colors"
            style={{ color: outline.description ? 'var(--text-tertiary)' : 'var(--text-tertiary)', opacity: outline.description ? 1 : 0.6 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-outline)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}>
            {outline.description || '点击添加大纲描述...'}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {chapters.length === 0 && !showAddChapter ? (
          <div className="rounded-lg p-6 text-center" style={cardStyle}>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>暂无章节</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>点击右上角按钮添加第一章</p>
          </div>
        ) : chapters.map((chapter, index) => (
          <ChapterItem key={chapter.id} chapter={chapter} index={index}
            isEditing={editingChapterId === chapter.id} editingTitle={editingTitle}
            onStartEdit={() => { setEditingChapterId(chapter.id); setEditingTitle(chapter.title || '') }}
            onSaveTitle={() => handleSaveTitle(chapter.id)}
            onEditTitleChange={setEditingTitle}
            onEditKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(chapter.id); if (e.key === 'Escape') { setEditingChapterId(null); setEditingTitle('') } }}
            onEditSummary={() => setSummaryModalChapterId(chapter.id)}
            onDelete={() => deleteChapter(chapter.id)} />
        ))}
      </div>

      <AnimatePresence>
        {showAddChapter && (
          <motion.div className="mt-3 p-3 rounded-lg" style={cardStyle}
            initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}>
            <FloatingLabelInput value={newChapterTitle} onChange={setNewChapterTitle}
              placeholder="输入章节标题..." label="章节标题" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddChapter(); if (e.key === 'Escape') { setShowAddChapter(false); setNewChapterTitle('') } }}
              required maxLength={100} />
            <div className="flex gap-2 justify-end mt-3">
              <motion.button onClick={() => { setShowAddChapter(false); setNewChapterTitle('') }}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{ backgroundColor: 'transparent', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)' }}
                whileTap={{ scale: 0.97 }}>取消</motion.button>
              <motion.button onClick={handleAddChapter} disabled={!newChapterTitle.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40 flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--color-outline)', color: 'var(--paper-100)' }}
                whileTap={{ scale: 0.97 }}>
                <Icon icon={Plus} size="xs" color="inherit" />添加
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {summaryModalChapterId && (
        <ChapterSummaryModal
          chapter={chapters.find((c) => c.id === summaryModalChapterId)!}
          onSave={(summary) => { updateChapter(summaryModalChapterId, { summary }); setSummaryModalChapterId(null) }}
          onClose={() => setSummaryModalChapterId(null)} />
      )}
    </div>
  )
}

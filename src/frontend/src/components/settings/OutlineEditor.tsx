/**
 * OutlineEditor — Story outline and chapter management.
 * Extracted from EntityActions.tsx.
 */

import { useSettingsStore } from '@/store/settingsStore'
import type { Chapter, ChapterStatus } from '@/shared/types'
import { Trash2, Edit2, Plus, FileText, GripVertical } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { useState, useCallback, useMemo } from 'react'
import { cardStyle } from './EntityCard'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { FloatingLabelInput } from './EntityFieldGroup'
import { ChapterSummaryModal } from './ChapterSummaryModal'
import { ChapterEntityLinker, type LinkedEntity } from './ChapterEntityLinker'

/** Build a name lookup map for character/location/faction entities. */
function buildEntityNameMap() {
  const { characters, locations, factions } = useSettingsStore.getState()
  const map = new Map<string, string>()
  for (const c of characters) map.set(`character:${c.id}`, c.name)
  for (const l of locations) map.set(`location:${l.id}`, l.name)
  for (const f of factions) map.set(`faction:${f.id}`, f.name)
  return map
}

const statusColors: Record<string, { bg: string; text: string }> = {
  planning: { bg: 'var(--color-surface-overlay)', text: 'var(--text-tertiary)' },
  pending: { bg: 'color-mix(in srgb, var(--color-outline) 12%, transparent)', text: 'var(--color-outline)' },
  writing: { bg: 'var(--accent-muted)', text: 'var(--accent-primary)' },
  review: { bg: 'color-mix(in srgb, var(--color-character) 12%, transparent)', text: 'var(--color-character)' },
  completed: { bg: 'color-mix(in srgb, var(--color-ifline) 15%, transparent)', text: 'var(--color-ifline)' },
  archived: { bg: 'var(--color-surface-overlay)', text: 'var(--text-disabled)' },
}

const statusLabels: Record<string, string> = {
  planning: '规划中',
  pending: '待处理',
  writing: '写作中',
  review: '审查中',
  completed: '已完成',
  archived: '已归档',
}

/** Clickable status cycle order */
const STATUS_CYCLE: ChapterStatus[] = ['planning', 'writing', 'completed']

function nextStatus(current: ChapterStatus): ChapterStatus {
  const idx = STATUS_CYCLE.indexOf(current)
  if (idx < 0) return 'planning'
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
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
  onStatusToggle,
  linkedEntities,
  onLink,
  onUnlink,
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
  onStatusToggle: () => void
  linkedEntities: LinkedEntity[]
  onLink: (entityType: string, entityId: number) => void
  onUnlink: (entityType: string, entityId: number) => void
}) {
  const sc = statusColors[chapter.status] || statusColors.planning

  return (
    <motion.div
      className="p-3 rounded-lg group hover:bg-[var(--hover-bg)]"
      style={{ ...cardStyle, backgroundColor: 'var(--color-surface-raised)' }}
      whileHover={{ x: 2 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing opacity-40 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-tertiary)', touchAction: 'none' }}
        >
          <GripVertical size={16} />
        </div>
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
              className="font-medium text-sm cursor-pointer transition-colors hover:text-[var(--color-outline)]"
              style={{ color: 'var(--text-primary)' }}>
              {chapter.title || '未命名章节'}
            </div>
          )}
          {chapter.summary && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>{chapter.summary}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <motion.button
              onClick={onStatusToggle}
              className="text-xs px-1.5 py-0.5 rounded cursor-pointer transition-all"
              style={{ backgroundColor: sc.bg, color: sc.text }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="点击切换状态"
            >
              {statusLabels[chapter.status] || chapter.status}
            </motion.button>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{chapter.word_count.toLocaleString()} 字</span>
          </div>
          {/* Chapter-Entity Linker */}
          <div className="mt-2">
            <ChapterEntityLinker
              chapterId={chapter.id}
              linkedEntities={linkedEntities}
              onLink={onLink}
              onUnlink={onUnlink}
            />
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
  const { outline, chapters, addChapter, updateChapter, deleteChapter, updateOutline, relations } = useSettingsStore()
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

  // ---- Progress Tracking ----
  const progressStats = useMemo(() => {
    const total = chapters.length
    if (total === 0) return { planning: 0, writing: 0, completed: 0, total: 0 }
    let planning = 0
    let writing = 0
    let completed = 0
    for (const ch of chapters) {
      if (ch.status === 'completed') completed++
      else if (ch.status === 'writing' || ch.status === 'review') writing++
      else planning++
    }
    return { planning, writing, completed, total }
  }, [chapters])

  // ---- Chapter-Entity Association ----
  // chapter entity links stored as relations: source_type='chapter', source_id=chapterId -> target entity
  const chapterEntityMap = useMemo(() => {
    const map = new Map<number, LinkedEntity[]>()
    for (const r of relations) {
      if (r.source_type === 'chapter') {
        const list = map.get(r.source_id) || []
        list.push({ type: r.target_type, id: r.target_id, name: r.label || `#${r.target_id}` })
        map.set(r.source_id, list)
      }
      // Also handle reverse: target is chapter
      if (r.target_type === 'chapter') {
        const list = map.get(r.target_id) || []
        list.push({ type: r.source_type, id: r.source_id, name: r.label || `#${r.source_id}` })
        map.set(r.target_id, list)
      }
    }
    return map
  }, [relations])

  // Resolve entity names from store data
  const resolvedChapterEntityMap = useMemo(() => {
    const nameMap = buildEntityNameMap()
    const resolved = new Map<number, LinkedEntity[]>()
    for (const [chapterId, entities] of chapterEntityMap) {
      resolved.set(
        chapterId,
        entities.map((e) => ({
          ...e,
          name: nameMap.get(`${e.type}:${e.id}`) || e.name,
        })),
      )
    }
    return resolved
  }, [chapterEntityMap])

  const handleLinkEntity = useCallback(
    (chapterId: number, entityType: string, entityId: number) => {
      const label = buildEntityNameMap().get(`${entityType}:${entityId}`) || ''
      useSettingsStore.getState().addRelation({
        source_type: 'chapter',
        source_id: chapterId,
        target_type: entityType,
        target_id: entityId,
        relation_type: 'appears_in',
        label,
      })
    },
    [],
  )

  const handleUnlinkEntity = useCallback(
    (chapterId: number, entityType: string, entityId: number) => {
      const rel = relations.find(
        (r) =>
          r.relation_type === 'appears_in' &&
          ((r.source_type === 'chapter' && r.source_id === chapterId && r.target_type === entityType && r.target_id === entityId) ||
            (r.target_type === 'chapter' && r.target_id === chapterId && r.source_type === entityType && r.source_id === entityId)),
      )
      if (rel) {
        useSettingsStore.getState().deleteRelation(rel.id)
      }
    },
    [relations],
  )

  const handleStatusToggle = useCallback(
    (chapterId: number, currentStatus: ChapterStatus) => {
      const newStatus = nextStatus(currentStatus)
      updateChapter(chapterId, { status: newStatus })
    },
    [updateChapter],
  )

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

  const handleReorder = useCallback(
    (newOrder: Chapter[]) => {
      const updates = newOrder.map((ch, i) => {
        if (ch.chapter_order !== i) {
          return updateChapter(ch.id, { chapter_order: i })
        }
        return Promise.resolve()
      })
      Promise.all(updates)
    },
    [updateChapter],
  )

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
              className="px-4 py-2 rounded-md text-sm font-medium transition-all hover:bg-[var(--border-default)]"
              style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-[var(--border-default)]"
          style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
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
            className="text-sm font-medium cursor-pointer transition-colors hover:text-[var(--color-outline)]"
            style={{ color: 'var(--text-primary)' }}>
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
            className="text-xs cursor-pointer transition-colors hover:text-[var(--color-outline)]"
            style={{ color: outline.description ? 'var(--text-tertiary)' : 'var(--text-tertiary)', opacity: outline.description ? 1 : 0.6 }}>
            {outline.description || '点击添加大纲描述...'}
          </p>
        )}
      </div>

      {/* Progress Tracking Bar */}
      {chapters.length > 0 && (
        <motion.div
          className="mb-4 p-3 rounded-lg"
          style={{ ...cardStyle, backgroundColor: 'var(--color-surface-raised)' }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>写作进度</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span style={{ color: statusColors.planning.text }}>
                规划 {progressStats.planning}
              </span>
              <span style={{ color: statusColors.writing.text }}>
                写作 {progressStats.writing}
              </span>
              <span style={{ color: statusColors.completed.text }}>
                完成 {progressStats.completed}
              </span>
            </div>
          </div>
          {/* Segmented progress bar */}
          <div
            className="h-2 rounded-full overflow-hidden flex"
            style={{ backgroundColor: 'var(--color-surface-overlay)' }}
          >
            <motion.div
              className="h-full"
              style={{
                backgroundColor: statusColors.completed.text,
                width: `${progressStats.total > 0 ? (progressStats.completed / progressStats.total) * 100 : 0}%`,
              }}
              initial={{ width: 0 }}
              animate={{
                width: `${progressStats.total > 0 ? (progressStats.completed / progressStats.total) * 100 : 0}%`,
              }}
              transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            />
            <motion.div
              className="h-full"
              style={{
                backgroundColor: statusColors.writing.text,
                width: `${progressStats.total > 0 ? (progressStats.writing / progressStats.total) * 100 : 0}%`,
              }}
              initial={{ width: 0 }}
              animate={{
                width: `${progressStats.total > 0 ? (progressStats.writing / progressStats.total) * 100 : 0}%`,
              }}
              transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            />
            <motion.div
              className="h-full"
              style={{
                backgroundColor: 'var(--color-surface-hover)',
                width: `${progressStats.total > 0 ? (progressStats.planning / progressStats.total) * 100 : 0}%`,
              }}
              initial={{ width: 0 }}
              animate={{
                width: `${progressStats.total > 0 ? (progressStats.planning / progressStats.total) * 100 : 0}%`,
              }}
              transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            />
          </div>
        </motion.div>
      )}

      {chapters.length === 0 && !showAddChapter ? (
        <div className="rounded-lg p-6 text-center" style={cardStyle}>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>暂无章节</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>点击右上角按钮添加第一章</p>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={chapters}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {chapters.map((chapter, index) => (
            <Reorder.Item
              key={chapter.id}
              value={chapter}
              whileDrag={{
                scale: 1.02,
                boxShadow: '0 8px 24px color-mix(in srgb, var(--color-outline) 20%, transparent)',
                zIndex: 50,
                opacity: 0.9,
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="list-none"
              style={{ touchAction: 'none' }}
            >
              <ChapterItem chapter={chapter} index={index}
                isEditing={editingChapterId === chapter.id} editingTitle={editingTitle}
                onStartEdit={() => { setEditingChapterId(chapter.id); setEditingTitle(chapter.title || '') }}
                onSaveTitle={() => handleSaveTitle(chapter.id)}
                onEditTitleChange={setEditingTitle}
                onEditKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(chapter.id); if (e.key === 'Escape') { setEditingChapterId(null); setEditingTitle('') } }}
                onEditSummary={() => setSummaryModalChapterId(chapter.id)}
                onDelete={() => deleteChapter(chapter.id)}
                onStatusToggle={() => handleStatusToggle(chapter.id, chapter.status)}
                linkedEntities={resolvedChapterEntityMap.get(chapter.id) || []}
                onLink={(entityType, entityId) => handleLinkEntity(chapter.id, entityType, entityId)}
                onUnlink={(entityType, entityId) => handleUnlinkEntity(chapter.id, entityType, entityId)} />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

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

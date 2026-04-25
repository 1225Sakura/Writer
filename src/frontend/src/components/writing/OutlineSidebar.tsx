import { useState, useEffect, useCallback } from 'react'
import { useWritingStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronDown,
  FileText,
  AlertCircle,
  List,
  Check,
  MoreHorizontal,
  Plus,
  GripVertical,
  BookOpen,
  GitBranch,
  Layers,
  Sparkles,
} from 'lucide-react'
import { PlotThreadIcon, EntityIcon } from '@/components/ui/Icon'

interface OutlineItem {
  id: string
  title: string
  level: number
  children: OutlineItem[]
  isExpanded?: boolean
  status?: 'draft' | 'writing' | 'review' | 'completed'
  wordCount?: number
}

/* ============================================================
   TreeNode — Optimized outline chapter tree node
   ============================================================ */

const depthColorMap = [
  'var(--color-outline)',       // depth 0 - chapters
  'var(--color-character)',     // depth 1 - scenes
  'var(--color-item)',          // depth 2
  'var(--color-location)',      // depth 3
  'var(--color-ifline)',        // depth 4
]

const statusConfig = {
  draft: { label: '草稿', color: 'var(--text-tertiary)', bg: 'color-mix(in srgb, var(--text-tertiary) 12%, transparent)' },
  writing: { label: '写作中', color: 'var(--accent-primary)', bg: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' },
  review: { label: '审阅', color: 'var(--color-warning)', bg: 'color-mix(in srgb, var(--color-warning) 12%, transparent)' },
  completed: { label: '完成', color: 'var(--color-success)', bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)' },
}

function TreeNode({
  item,
  depth = 0,
  onSelect,
  selectedId,
  isDragging,
  isDragOver,
  dragOverPosition,
}: {
  item: OutlineItem
  depth?: number
  onSelect: (id: string) => void
  selectedId: string | null
  isDragging?: boolean
  isDragOver?: boolean
  dragOverPosition?: 'before' | 'after' | 'inside'
}) {
  const [isExpanded, setIsExpanded] = useState(item.isExpanded ?? depth < 2)
  const hasChildren = item.children.length > 0
  const isSelected = selectedId === item.id

  const indentColor = depthColorMap[Math.min(depth, depthColorMap.length - 1)]
  const status = item.status || 'draft'
  const statusInfo = statusConfig[status]

  return (
    <div className="select-none relative">
      {/* Drag drop indicator - before */}
      {isDragOver && dragOverPosition === 'before' && (
        <div className="drag-over-indicator" style={{ top: '-1px' }} />
      )}

      {/* Drag drop indicator - after */}
      {isDragOver && dragOverPosition === 'after' && (
        <div className="drag-over-indicator" style={{ bottom: '-1px' }} />
      )}

      <div
        className={`
          flex items-center gap-1.5 rounded-lg cursor-pointer transition-all duration-200 group relative
          ${isSelected
            ? 'text-[var(--accent-primary)]'
            : 'hover:bg-[var(--color-surface-hover)] text-[var(--text-secondary)]'
          }
          ${isDragging ? 'dragging-item' : 'opacity-100'}
        `}
        style={{
          paddingLeft: `${depth * 18 + 10}px`,
          paddingRight: '8px',
          paddingTop: '6px',
          paddingBottom: '6px',
          background: isSelected
            ? 'linear-gradient(90deg, color-mix(in srgb, var(--accent-primary) 10%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 5%, transparent) 50%, transparent 100%)'
            : undefined,
        }}
        onClick={() => onSelect(item.id)}
      >
        {/* Active chapter left indicator with glow */}
        {isSelected && (
          <motion.div
            layoutId="outline-selected-indicator"
            className="outline-active-glow"
            style={{
              '--active-color': indentColor,
            } as React.CSSProperties}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}

        {/* Indent guide line */}
        {depth > 0 && (
          <div
            className="outline-indent-guide"
            style={{
              left: `${(depth - 1) * 18 + 18}px`,
              top: '0',
              bottom: '0',
              '--indent-color': indentColor,
            } as React.CSSProperties}
          />
        )}

        {/* Drag handle */}
        <div className="opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3 h-3 text-[var(--text-tertiary)]" />
        </div>

        {/* Expand/collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          className={`
            w-5 h-5 flex items-center justify-center rounded-md transition-all duration-150
            ${hasChildren
              ? 'text-[var(--text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-secondary)]'
              : 'text-[var(--text-tertiary)]/40'
            }
          `}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <FileText className="w-3 h-3 opacity-50" />
          )}
        </button>

        {/* Title */}
        <span className={`
          flex-1 text-sm truncate transition-colors duration-150
          ${isSelected ? 'font-medium' : 'font-normal'}
        `}
          style={{
            color: isSelected ? indentColor : undefined,
            paddingLeft: depth > 0 ? '2px' : undefined,
          }}
        >
          {item.title}
        </span>

        {/* Status badge with progress ring for completed chapters */}
        {depth === 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {status === 'completed' && (
              <svg className="progress-ring w-3.5 h-3.5" viewBox="0 0 16 16">
                <circle className="progress-ring__track" cx="8" cy="8" r="6" />
                <circle
                  className="progress-ring__fill"
                  cx="8" cy="8" r="6"
                  strokeDasharray={`${2 * Math.PI * 6}`}
                  strokeDashoffset={0}
                  style={{ '--progress-color': 'var(--color-success)' } as React.CSSProperties}
                />
              </svg>
            )}
            {status === 'writing' && (
              <svg className="progress-ring w-3.5 h-3.5" viewBox="0 0 16 16">
                <circle className="progress-ring__track" cx="8" cy="8" r="6" />
                <circle
                  className="progress-ring__fill"
                  cx="8" cy="8" r="6"
                  strokeDasharray={`${2 * Math.PI * 6}`}
                  strokeDashoffset={`${2 * Math.PI * 6 * 0.3}`}
                  style={{ '--progress-color': 'var(--accent-primary)' } as React.CSSProperties}
                />
              </svg>
            )}
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: statusInfo.bg,
                color: statusInfo.color,
              }}
            >
              {statusInfo.label}
            </span>
          </div>
        )}

        {/* Word count */}
        {item.wordCount && item.wordCount > 0 && (
          <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0 tabular-nums">
            {item.wordCount.toLocaleString()}
          </span>
        )}

        {/* Hover actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5">
          <button
            className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-secondary)] transition-colors"
            title="更多操作"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden relative"
          >
            <div
              className="outline-indent-guide"
              style={{
                left: `${depth * 18 + 18}px`,
                top: '0',
                bottom: '4px',
                '--indent-color': indentColor,
              } as React.CSSProperties}
            />
            {item.children.map((child) => (
              <TreeNode
                key={child.id}
                item={child}
                depth={depth + 1}
                onSelect={onSelect}
                selectedId={selectedId}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ============================================================
   Empty State — Helpful illustration with action
   ============================================================ */

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-outline) 8%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 5%, transparent) 100%)',
          border: '1px solid color-mix(in srgb, var(--color-outline) 12%, transparent)',
        }}
      >
        <Icon className="w-6 h-6 text-[var(--color-outline)] opacity-50" />
      </div>
      <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{title}</p>
      <p className="text-xs text-[var(--text-tertiary)] mb-4 max-w-[200px]">{description}</p>
      {action}
    </motion.div>
  )
}

/* ============================================================
   Plot Thread Item
   ============================================================ */

function PlotThreadItem({
  thread,
  onReveal,
}: {
  thread: { id: number; title: string; description?: string }
  onReveal: (id: number) => void
}) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="
        flex items-start gap-2.5 p-3 rounded-xl
        bg-[var(--color-surface-base)] border border-[var(--border-default)]
        hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]/50
        group transition-all duration-200
      "
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: 'color-mix(in srgb, var(--color-ifline) 10%, transparent)',
        }}
      >
        <PlotThreadIcon size="sm" className="text-[var(--color-ifline)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-[var(--text-primary)] truncate">{thread.title}</div>
        {thread.description && (
          <div className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">{thread.description}</div>
        )}
      </div>
      <button
        onClick={() => onReveal(thread.id)}
        className="
          opacity-0 group-hover:opacity-100
          w-7 h-7 flex items-center justify-center rounded-lg
          hover:bg-[var(--color-ifline)]/10
          transition-all duration-150
        "
        title="标记为已揭示"
      >
        <Check className="w-4 h-4 text-[var(--icon-success)]" />
      </button>
    </motion.div>
  )
}

/* ============================================================
   IF Line Item
   ============================================================ */

function IFLineItem({
  line,
}: {
  line: { id: number; title: string; description?: string; progress?: number; sync_mode: string }
}) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="
        p-3 rounded-xl
        bg-[var(--color-surface-base)] border border-[var(--border-default)]
        hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]/50
        transition-all duration-200
      "
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'color-mix(in srgb, var(--color-ifline) 10%, transparent)',
          }}
        >
          <EntityIcon type="ifline" size="xs" className="text-[var(--color-ifline)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{line.title}</div>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: line.sync_mode === 'auto' ? 'color-mix(in srgb, var(--color-ifline) 12%, transparent)' : 'color-mix(in srgb, var(--color-character) 12%, transparent)',
            color: line.sync_mode === 'auto' ? 'var(--color-ifline)' : 'var(--color-character)',
          }}
        >
          {line.sync_mode === 'auto' ? '自动' : '手动'}
        </span>
      </div>
      {line.description && (
        <div className="text-xs text-[var(--text-tertiary)] truncate mb-2 pl-9">{line.description}</div>
      )}
      {/* Progress */}
      <div className="pl-9 space-y-1">
        <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
          <span>进度</span>
          <span className="font-medium tabular-nums">{line.progress || 0}%</span>
        </div>
        <div className="h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--color-ifline)' }}
            initial={{ width: 0 }}
            animate={{ width: `${line.progress || 0}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================
   OutlineSidebar — Main Component
   ============================================================ */

export function OutlineSidebar() {
  const {
    chapters,
    currentChapterId,
    setCurrentChapter,
    plotThreads,
    fetchPlotThreads,
    updatePlotThread,
    ifLines,
    fetchIFLines,
  } = useWritingStore()

  const [activeTab, setActiveTab] = useState<'outline' | 'plot' | 'ifline'>('outline')
  const [outlineData, setOutlineData] = useState<OutlineItem[]>([])

  useEffect(() => {
    fetchPlotThreads('open')
    fetchIFLines()
  }, [fetchPlotThreads, fetchIFLines])

  // Build outline tree from chapters
  useEffect(() => {
    const buildTree = (): OutlineItem[] => {
      return chapters.map((chapter) => ({
        id: String(chapter.id),
        title: chapter.title || `第${chapter.chapter_order}章`,
        level: 0,
        children: [],
        status: chapter.status as OutlineItem['status'] || 'draft',
        wordCount: chapter.word_count,
      }))
    }
    setOutlineData(buildTree())
  }, [chapters])

  const handleChapterSelect = useCallback((id: string) => {
    const chapterId = parseInt(id)
    if (!isNaN(chapterId)) {
      setCurrentChapter(chapterId)
    }
  }, [setCurrentChapter])

  const handleRevealThread = useCallback(async (threadId: number) => {
    await updatePlotThread(threadId, { status: 'revealed' })
    fetchPlotThreads('open')
  }, [updatePlotThread, fetchPlotThreads])

  const openThreads = plotThreads.filter((t) => t.status === 'open')

  const tabs = [
    { id: 'outline' as const, label: '章节', icon: Layers, badge: chapters.length },
    { id: 'plot' as const, label: '伏笔', icon: Sparkles, badge: openThreads.length },
    { id: 'ifline' as const, label: 'IF线', icon: GitBranch, badge: ifLines.length },
  ]

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] relative">
      {/* Subtle panel background texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] relative z-10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(91, 142, 232, 0.15) 0%, rgba(94, 106, 210, 0.1) 100%)',
              border: '1px solid rgba(91, 142, 232, 0.2)',
            }}
          >
            <BookOpen className="w-4 h-4 text-[var(--color-outline)]" />
          </div>
          <div>
            <span className="font-semibold text-sm text-[var(--text-primary)] tracking-tight">大纲</span>
            <div className="text-[10px] text-[var(--text-tertiary)] leading-tight">
              {chapters.length} 章节 · {openThreads.length} 伏笔 · {ifLines.length} IF线
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-default)] px-2 relative z-10">
        {tabs.map((tab) => {
          const TabIcon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium
                transition-all duration-200 relative
                ${activeTab === tab.id
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)]/50'
                }
              `}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="outline-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, var(--accent-primary) 20%, var(--accent-primary) 80%, transparent 100%)',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <TabIcon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span
                  className="px-1.5 py-0.5 text-[10px] rounded-full font-semibold"
                  style={{
                    background: 'color-mix(in srgb, var(--color-vermillion) 15%, transparent)',
                    color: 'var(--color-vermillion)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'outline' && (
            <motion.div
              key="outline"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="p-2 space-y-0.5"
            >
              {outlineData.length === 0 ? (
                <EmptyState
                  icon={List}
                  title="暂无章节大纲"
                  description="从添加第一个章节开始，构建你的故事结构"
                  action={
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/15 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                      添加章节
                    </button>
                  }
                />
              ) : (
                <>
                  {outlineData.map((item) => (
                    <TreeNode
                      key={item.id}
                      item={item}
                      onSelect={handleChapterSelect}
                      selectedId={currentChapterId ? String(currentChapterId) : null}
                    />
                  ))}

                  {/* Add chapter button */}
                  <div className="pt-2 pb-1 px-1">
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
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
                      <span>添加章节</span>
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'plot' && (
            <motion.div
              key="plot"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="p-3 space-y-2.5"
            >
              {openThreads.length === 0 ? (
                <EmptyState
                  icon={AlertCircle}
                  title="暂无进行中的伏笔"
                  description="在设定编辑器中添加伏笔线索，追踪故事中的悬念"
                />
              ) : (
                openThreads.map((thread) => (
                  <PlotThreadItem
                    key={thread.id}
                    thread={thread}
                    onReveal={handleRevealThread}
                  />
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'ifline' && (
            <motion.div
              key="ifline"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="p-3 space-y-2.5"
            >
              {ifLines.length === 0 ? (
                <EmptyState
                  icon={GitBranch}
                  title="暂无IF线"
                  description="创建IF线来探索不同的故事分支和角色命运"
                />
              ) : (
                ifLines.map((line) => (
                  <IFLineItem key={line.id} line={line} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

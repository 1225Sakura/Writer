import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { PlotThreadIcon, EntityIcon } from '@/components/ui/Icon'

interface OutlineItem {
  id: string
  title: string
  level: number
  children: OutlineItem[]
  isExpanded?: boolean
}

function TreeNode({
  item,
  depth = 0,
  onSelect,
  selectedId,
}: {
  item: OutlineItem
  depth?: number
  onSelect: (id: string) => void
  selectedId: string | null
}) {
  const [isExpanded, setIsExpanded] = useState(item.isExpanded ?? depth < 2)
  const hasChildren = item.children.length > 0

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-150 group
          ${selectedId === item.id
            ? 'bg-[var(--accent-primary)]/15'
            : 'hover:bg-[var(--hover-bg)]'
          }`}
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          color: selectedId === item.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
        }}
        onClick={() => onSelect(item.id)}
      >
        {/* Expand/collapse icon */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          className="w-4 h-4 flex items-center justify-center rounded"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--hover-bg)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )
          ) : (
            <FileText className="w-3 h-3 opacity-40" />
          )}
        </button>

        {/* Title */}
        <span className="flex-1 text-sm truncate">{item.title}</span>

        {/* Actions on hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          <button
            className="w-5 h-5 flex items-center justify-center rounded"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hover-bg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <MoreHorizontal className="w-3 h-3" />
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
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
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

// Plot thread item
function PlotThreadItem({
  thread,
  onReveal,
}: {
  thread: { id: number; title: string; description?: string }
  onReveal: (id: number) => void
}) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-[#0f1011] border border-[rgba(255,255,255,0.06)] group">
      <PlotThreadIcon size="sm" className="text-[var(--color-ifline)] mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-[#f7f8f8] truncate">{thread.title}</div>
        {thread.description && (
          <div className="text-xs text-[#d0d6e0]/60 truncate">{thread.description}</div>
        )}
      </div>
      <button
        onClick={() => onReveal(thread.id)}
        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-[rgba(126,210,94,0.1)] transition-opacity"
        title="标记为已揭示"
      >
        <Check className="w-4 h-4 text-[#6dd45e]" />
      </button>
    </div>
  )
}

// IF line item
function IFLineItem({
  line,
}: {
  line: { id: number; title: string; description?: string; progress?: number; sync_mode: string }
}) {
  return (
    <div className="p-2.5 rounded-lg bg-[#0f1011] border border-[rgba(255,255,255,0.06)]">
      <div className="flex items-center gap-2 mb-1.5">
        <EntityIcon type="ifline" size="xs" className="text-[var(--color-ifline)]" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[#f7f8f8] truncate">{line.title}</div>
        </div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: line.sync_mode === 'auto' ? '#7eb84a20' : '#e8b87d20',
            color: line.sync_mode === 'auto' ? '#7eb84a' : '#e8b87d',
          }}
        >
          {line.sync_mode === 'auto' ? '自动' : '手动'}
        </span>
      </div>
      {line.description && (
        <div className="text-xs text-[#d0d6e0]/60 truncate mb-2 pl-5">{line.description}</div>
      )}
      {/* Progress */}
      <div className="pl-5 space-y-1">
        <div className="flex justify-between text-[10px] text-[#d0d6e0]/50">
          <span>进度</span>
          <span>{line.progress || 0}%</span>
        </div>
        <div className="h-1 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: 'var(--color-ifline)' }}
            initial={{ width: 0 }}
            animate={{ width: `${line.progress || 0}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </div>
  )
}

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
      }))
    }
    setOutlineData(buildTree())
  }, [chapters])

  const handleChapterSelect = (id: string) => {
    const chapterId = parseInt(id)
    if (!isNaN(chapterId)) {
      setCurrentChapter(chapterId)
    }
  }

  const handleRevealThread = async (threadId: number) => {
    await updatePlotThread(threadId, { status: 'revealed' })
    fetchPlotThreads('open')
  }

  const openThreads = plotThreads.filter((t) => t.status === 'open')

  const tabs = [
    { id: 'outline' as const, label: '章节', icon: <List className="w-3.5 h-3.5" /> },
    { id: 'plot' as const, label: '伏笔', icon: <AlertCircle className="w-3.5 h-3.5" />, badge: openThreads.length },
    { id: 'ifline' as const, label: 'IF线', icon: <EntityIcon type="ifline" size="xs" />, badge: ifLines.length },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-surface-raised)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>大纲</span>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid var(--border-default)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all"
            style={{
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'var(--hover-bg)'
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className="px-1 py-0.5 text-[10px] rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--color-vermillion) 20%, transparent)',
                  color: 'var(--color-vermillion)',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {activeTab === 'outline' && (
            <motion.div
              key="outline"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-1"
            >
              {outlineData.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  暂无章节大纲
                </div>
              ) : (
                outlineData.map((item) => (
                  <TreeNode
                    key={item.id}
                    item={item}
                    onSelect={handleChapterSelect}
                    selectedId={currentChapterId ? String(currentChapterId) : null}
                  />
                ))
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
              className="space-y-2"
            >
              {openThreads.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  暂无进行中的伏笔
                </div>
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
              className="space-y-2"
            >
              {ifLines.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  暂无IF线
                </div>
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

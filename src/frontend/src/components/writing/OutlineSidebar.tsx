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
  Plus,
  GripVertical,
} from 'lucide-react'
import { PlotThreadIcon, EntityIcon } from '@/components/ui/Icon'

interface OutlineItem {
  id: string
  title: string
  level: number
  children: OutlineItem[]
  isExpanded?: boolean
}

/* ============================================================
   TreeNode — 大纲章节树节点
   改进点：
   1. 层级指示线 (indent guide) + 颜色编码
   2. 当前章节高亮（左边框 + accent 背景 + glow）
   3. 拖拽排序视觉反馈（placeholder + 半透明 + 缩放）
   4. 优化 hover 效果（subtle 背景变化 + glow）
   ============================================================ */

const depthColorMap = [
  'var(--accent-primary)',      // depth 0
  'var(--color-character)',     // depth 1
  'var(--color-item)',          // depth 2
  'var(--color-location)',      // depth 3
  'var(--color-outline)',       // depth 4
]

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

  return (
    <div className="select-none relative">
      {/* 拖拽放置指示线 — before */}
      {isDragOver && dragOverPosition === 'before' && (
        <div className="absolute -top-[1px] left-0 right-0 z-10">
          <div className="h-[2px] rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_rgba(94,106,210,0.7)]" />
          <div className="absolute -top-[3px] left-0 w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] shadow-[0_0_6px_rgba(94,106,210,0.9)]" />
        </div>
      )}

      {/* 拖拽放置指示线 — after */}
      {isDragOver && dragOverPosition === 'after' && (
        <div className="absolute -bottom-[1px] left-0 right-0 z-10">
          <div className="h-[2px] rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_rgba(94,106,210,0.7)]" />
          <div className="absolute -top-[3px] left-0 w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] shadow-[0_0_6px_rgba(94,106,210,0.9)]" />
        </div>
      )}

      <div
        className={`
          flex items-center gap-1.5 rounded-lg cursor-pointer transition-all duration-200 group relative
          ${isSelected
            ? 'text-[var(--accent-primary)]'
            : 'hover:bg-[var(--color-surface-hover)] text-[var(--text-secondary)]'
          }
          ${isDragging ? 'opacity-30 scale-[0.97] rotate-1' : 'opacity-100'}
        `}
        style={{
          paddingLeft: `${depth * 18 + 10}px`,
          paddingRight: '8px',
          paddingTop: '5px',
          paddingBottom: '5px',
          background: isSelected
            ? 'linear-gradient(90deg, color-mix(in srgb, var(--accent-primary) 10%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 5%, transparent) 50%, transparent 100%)'
            : undefined,
        }}
        onClick={() => onSelect(item.id)}
      >
        {/* 当前选中左边框指示 - 带glow效果 */}
        {isSelected && (
          <motion.div
            layoutId="outline-selected-indicator"
            className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
            style={{
              background: `linear-gradient(180deg, ${indentColor} 0%, color-mix(in srgb, ${indentColor} 60%, transparent) 100%)`,
              boxShadow: `0 0 10px color-mix(in srgb, ${indentColor} 40%, transparent), 0 0 20px color-mix(in srgb, ${indentColor} 20%, transparent)`,
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}

        {/* 层级缩进指示线 - 颜色编码 */}
        {depth > 0 && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${(depth - 1) * 18 + 18}px`,
              top: '0',
              bottom: '0',
              width: '1.5px',
              background: `linear-gradient(180deg, color-mix(in srgb, ${indentColor} 25%, transparent) 0%, color-mix(in srgb, ${indentColor} 15%, transparent) 50%, color-mix(in srgb, ${indentColor} 25%, transparent) 100%)`,
              opacity: 0.6,
            }}
          />
        )}

        {/* 拖拽手柄 */}
        <div className="opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3 h-3 text-[var(--text-tertiary)]" />
        </div>

        {/* Expand/collapse icon */}
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

        {/* Title - 层级颜色编码 */}
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

        {/* Actions on hover */}
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
            {/* 子节点区域左侧层级线 - 颜色编码 */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${depth * 18 + 18}px`,
                top: '0',
                bottom: '4px',
                width: '1.5px',
                background: `linear-gradient(180deg, color-mix(in srgb, ${indentColor} 20%, transparent) 0%, transparent 100%)`,
                opacity: 0.5,
              }}
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

// Plot thread item
function PlotThreadItem({
  thread,
  onReveal,
}: {
  thread: { id: number; title: string; description?: string }
  onReveal: (id: number) => void
}) {
  return (
    <div className="
      flex items-start gap-2 p-2.5 rounded-xl
      bg-[var(--color-surface-base)] border border-[var(--border-default)]
      hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]/50
      group transition-all duration-200
    ">
      <PlotThreadIcon size="sm" className="text-[var(--color-ifline)] mt-0.5 flex-shrink-0" />
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
    <div className="
      p-3 rounded-xl
      bg-[var(--color-surface-base)] border border-[var(--border-default)]
      hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]/50
      transition-all duration-200
    ">
      <div className="flex items-center gap-2 mb-1.5">
        <EntityIcon type="ifline" size="xs" className="text-[var(--color-ifline)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{line.title}</div>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: line.sync_mode === 'auto' ? 'rgba(126, 184, 74, 0.12)' : 'rgba(232, 184, 125, 0.12)',
            color: line.sync_mode === 'auto' ? '#7eb84a' : '#e8b87d',
          }}
        >
          {line.sync_mode === 'auto' ? '自动' : '手动'}
        </span>
      </div>
      {line.description && (
        <div className="text-xs text-[var(--text-tertiary)] truncate mb-2 pl-6">{line.description}</div>
      )}
      {/* Progress */}
      <div className="pl-6 space-y-1">
        <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
          <span>进度</span>
          <span className="font-medium">{line.progress || 0}%</span>
        </div>
        <div className="h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[var(--color-ifline)]"
            initial={{ width: 0 }}
            animate={{ width: `${line.progress || 0}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   OutlineSidebar — 大纲侧边栏
   改进点：
   1. 头部视觉层次增强（图标 + 标题 + 副标题）
   2. Tab 样式优化（更精致的激活态）
   3. "添加章节"按钮 hover glow 效果
   4. 整体间距和视觉节奏优化
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
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)]">
      {/* Header — 增强视觉层次 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2.5">
          {/* 大纲图标 */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(91, 142, 232, 0.15) 0%, rgba(94, 106, 210, 0.1) 100%)',
              border: '1px solid rgba(91, 142, 232, 0.2)',
            }}
          >
            <List className="w-3.5 h-3.5 text-[var(--color-outline)]" />
          </div>
          <div>
            <span className="font-semibold text-sm text-[var(--text-primary)] tracking-tight">大纲</span>
            <div className="text-[10px] text-[var(--text-tertiary)] leading-tight">
              {chapters.length} 章节 · {openThreads.length} 伏笔 · {ifLines.length} IF线
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — 优化激活态视觉 */}
      <div className="flex border-b border-[var(--border-default)] px-2">
        {tabs.map((tab) => (
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
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
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
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
                <div className="text-center py-10 text-sm text-[var(--text-tertiary)]">
                  <List className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  暂无章节大纲
                </div>
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

                  {/* 添加章节按钮 — hover glow 效果 */}
                  <div className="pt-2 pb-1 px-1">
                    <button
                      className="
                        w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                        border border-dashed border-[var(--border-default)]
                        text-xs font-medium text-[var(--text-tertiary)]
                        hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/40
                        hover:bg-[var(--accent-primary)]/5
                        transition-all duration-200
                        group
                      "
                      style={{
                        '--glow-color': 'rgba(94, 106, 210, 0.15)',
                      } as React.CSSProperties}
                    >
                      <Plus className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
                      <span>添加章节</span>
                    </button>
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
                <div className="text-center py-10 text-sm text-[var(--text-tertiary)]">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
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
              className="p-3 space-y-2.5"
            >
              {ifLines.length === 0 ? (
                <div className="text-center py-10 text-sm text-[var(--text-tertiary)]">
                  <EntityIcon type="ifline" size="lg" className="mx-auto mb-2 opacity-30" />
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

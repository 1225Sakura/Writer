/**
 * OutlineSidebar - Outline sidebar for the writing editor
 *
 * Thin wrapper that composes TreeNode, PlotThreadItem, IFLineItem, and EmptyState.
 * Sub-modules:
 * - OutlineTreeNode: Recursive tree node component
 * - OutlineItems: EmptyState, PlotThreadItem, IFLineItem
 */

import { useState, useEffect, useCallback } from 'react'
import { useWritingStore, useContentStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  List,
  Plus,
  BookOpen,
  GitBranch,
  Layers,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

// Re-export sub-components
export { TreeNode } from './OutlineTreeNode'
export type { OutlineItem } from './OutlineTreeNode'
export { EmptyState, PlotThreadItem, IFLineItem } from './OutlineItems'

import { TreeNode, type OutlineItem } from './OutlineTreeNode'
import { EmptyState, PlotThreadItem, IFLineItem } from './OutlineItems'

/* ============================================================
   OutlineSidebar -- Main Component
   ============================================================ */

export function OutlineSidebar() {
  const {
    currentChapterId,
    setCurrentChapter,
  } = useWritingStore()
  const {
    chapters,
    plotThreads,
    fetchPlotThreads,
    updatePlotThread,
    ifLines,
    fetchIFLines,
    createChapter,
  } = useContentStore()

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

  const handleAddChapter = useCallback(async () => {
    await createChapter({})
  }, [createChapter])

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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] relative z-10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'color-mix(in srgb, var(--color-outline) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-outline) 15%, transparent)',
            }}
          >
            <Icon icon={BookOpen} size="xs" style={{ color: 'var(--color-outline)' }} />
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
              <Icon icon={TabIcon} size="xs" />
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
      <div className="flex-1 overflow-y-auto scrollbar-thin relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'outline' && (
            <motion.div
              key="outline"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
              className="p-2 space-y-0.5"
            >
              {outlineData.length === 0 ? (
                <EmptyState
                  icon={List}
                  title="暂无章节大纲"
                  description="从添加第一个章节开始，构建你的故事结构"
                  action={
                    <button onClick={handleAddChapter} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/15 transition-colors">
                      <Icon icon={Plus} size="xs" />
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
                      onClick={handleAddChapter}
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
                      <Icon icon={Plus} size="xs" className="transition-transform duration-200 group-hover:scale-110" />
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
              transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
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
              transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
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

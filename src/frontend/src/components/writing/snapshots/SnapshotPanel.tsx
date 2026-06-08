import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Bookmark,
  BookmarkCheck,
  RotateCcw,
  GitCompare,
  RefreshCw,
  ChevronRight,
  X,
} from 'lucide-react'
import { snapshotApi } from '@/api/writing'
import type { ChapterSnapshot } from '@/api/types'
import { useWritingStore } from '@/store'
import { showOperationError, showWarning } from '@/utils/toastHelper'
import { EASE, DURATION, STAGGER_CONTAINER, STAGGER_ITEM } from '@/components/shared/AnimationConfig'
import { SnapshotDiffView } from './SnapshotDiffView'

interface SnapshotPanelProps {
  chapterId: number
  onClose: () => void
}

export function SnapshotPanel({ chapterId, onClose }: SnapshotPanelProps) {
  const [snapshots, setSnapshots] = useState<ChapterSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState<ChapterSnapshot | null>(null)
  const [diffTarget, setDiffTarget] = useState<ChapterSnapshot | null>(null)
  const currentContent = useWritingStore((s) => s.currentContent)

  const fetchSnapshots = useCallback(async () => {
    setLoading(true)
    try {
      const data = await snapshotApi.list(chapterId)
      setSnapshots(data.sort((a, b) => b.version_number - a.version_number))
    } catch (error) {
      showOperationError('加载快照列表', error)
    } finally {
      setLoading(false)
    }
  }, [chapterId])

  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  const handleToggleMark = useCallback(
    async (snapshot: ChapterSnapshot) => {
      try {
        const updated = await snapshotApi.mark(chapterId, snapshot.id, {
          is_marked: !snapshot.is_marked,
        })
        setSnapshots((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        )
      } catch (error) {
        showOperationError('标记快照', error)
      }
    },
    [chapterId]
  )

  const handleRollback = useCallback(
    async (snapshot: ChapterSnapshot) => {
      const updateContent = useWritingStore.getState().updateContent
      const saveCurrentChapter = useWritingStore.getState().saveCurrentChapter
      updateContent(snapshot.content)
      try {
        await saveCurrentChapter()
      } catch {
        // saveCurrentChapter handles its own errors
      }
      showWarning(`已回退到版本 v${snapshot.version_number}`)
    },
    []
  )

  const handleDiffWithCurrent = useCallback(
    (snapshot: ChapterSnapshot) => {
      setSelectedSnapshot(snapshot)
    },
    []
  )

  const handleDiffBetweenSnapshots = useCallback(
    (snapshot: ChapterSnapshot) => {
      if (diffTarget && diffTarget.id !== snapshot.id) {
        // We have two different snapshots selected — open diff
        setSelectedSnapshot(snapshot)
      } else {
        setDiffTarget(snapshot)
      }
    },
    [diffTarget]
  )

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `今天 ${time}`
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + time
  }

  // If a snapshot is selected for diff view, show the diff
  if (selectedSnapshot) {
    return (
      <SnapshotDiffView
        snapshot={selectedSnapshot}
        currentContent={currentContent}
        secondSnapshot={diffTarget && diffTarget.id !== selectedSnapshot.id ? diffTarget : undefined}
        onBack={() => {
          setSelectedSnapshot(null)
          setDiffTarget(null)
        }}
        onRollback={handleRollback}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-outline) 18%, transparent) 0%, color-mix(in srgb, var(--color-outline) 8%, transparent) 100%)',
              border: '1px solid color-mix(in srgb, var(--color-outline) 25%, transparent)',
            }}
          >
            <Clock className="w-4 h-4 text-[var(--color-outline)]" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
              版本快照
            </span>
            <div className="text-[10px] leading-tight" style={{ color: 'var(--text-tertiary)' }}>
              {snapshots.length} 个版本
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchSnapshots}
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            title="关闭"
          >
            <X className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Diff target hint */}
      <AnimatePresence>
        {diffTarget && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2 text-xs border-b border-[var(--border-default)]"
              style={{
                background: 'color-mix(in srgb, var(--color-outline) 8%, transparent)',
                color: 'var(--color-outline)',
              }}
            >
              <span className="font-medium">对比基准: v{diffTarget.version_number}</span>
              <span className="ml-1 opacity-70">- 点击另一版本进行对比</span>
              <button
                onClick={() => setDiffTarget(null)}
                className="ml-2 underline opacity-70 hover:opacity-100"
              >
                取消
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Snapshot list */}
      <div className="flex-1 overflow-y-auto scrollbar-ink">
        {loading && snapshots.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Clock className="w-8 h-8 text-[var(--text-tertiary)] opacity-40" />
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              暂无快照
            </span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              保存章节时自动创建
            </span>
          </div>
        ) : (
          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate="visible"
            className="py-1"
          >
            {snapshots.map((snapshot) => (
              <motion.div
                key={snapshot.id}
                variants={STAGGER_ITEM}
                className="group px-3 py-2 mx-1 my-0.5 rounded-lg cursor-pointer transition-colors hover:bg-[var(--color-surface-hover)]"
                style={{
                  background: diffTarget?.id === snapshot.id
                    ? 'color-mix(in srgb, var(--color-outline) 12%, transparent)'
                    : undefined,
                  border: diffTarget?.id === snapshot.id
                    ? '1px solid color-mix(in srgb, var(--color-outline) 30%, transparent)'
                    : '1px solid transparent',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: snapshot.is_marked
                          ? 'color-mix(in srgb, var(--color-vermillion) 15%, transparent)'
                          : 'var(--color-surface-raised)',
                        color: snapshot.is_marked
                          ? 'var(--color-vermillion)'
                          : 'var(--text-secondary)',
                        border: snapshot.is_marked
                          ? '1px solid color-mix(in srgb, var(--color-vermillion) 30%, transparent)'
                          : '1px solid var(--border-default)',
                      }}
                    >
                      v{snapshot.version_number}
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {formatTime(snapshot.created_at)}
                    </span>
                    {snapshot.word_count > 0 && (
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                        {snapshot.word_count}字
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleMark(snapshot)
                      }}
                      className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--color-vermillion)]"
                      title={snapshot.is_marked ? '取消标记' : '标记此版本'}
                    >
                      {snapshot.is_marked ? (
                        <BookmarkCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDiffBetweenSnapshots(snapshot)
                      }}
                      className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--color-outline)]"
                      title={diffTarget ? '对比这两个版本' : '选择为对比基准'}
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDiffWithCurrent(snapshot)
                      }}
                      className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--color-outline)]"
                      title="与当前内容对比"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRollback(snapshot)
                      }}
                      className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--color-ifline)]"
                      title="回退到此版本"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </div>

                {snapshot.label && (
                  <div
                    className="mt-1 text-[11px] truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {snapshot.label}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}

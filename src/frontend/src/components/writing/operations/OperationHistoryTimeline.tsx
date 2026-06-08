import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAIStore, useWritingStore } from '@/store'
import { getEditorInstance } from '@/store/editorRegistry'
import { showToast } from '@/components/ui/Toast'
import { motion, AnimatePresence } from 'framer-motion'
import { History, Undo2, Redo2, RotateCcw } from 'lucide-react'
import { DURATION } from '@/components/shared/AnimationConfig'

// ============================================
// Types
// ============================================

interface ContentSnapshot {
  jobId: string
  operation: string
  /** Content BEFORE the AI operation was applied */
  previousContent: string
  /** Content AFTER the AI operation was applied */
  appliedContent: string
  timestamp: number
}

// ============================================
// Helpers
// ============================================

function getOperationColor(op: string): string {
  const colors: Record<string, string> = {
    optimize: 'var(--accent-primary)',
    expand: 'var(--color-ifline)',
    condense: 'var(--color-character)',
    rewrite: 'var(--color-item)',
    continue: 'var(--color-location)',
    polish: 'var(--color-vermillion)',
  }
  return colors[op] || 'var(--accent-primary)'
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`
  return `${Math.floor(seconds / 86400)}天前`
}

const OPERATION_LABELS: Record<string, string> = {
  optimize: '优化',
  expand: '扩写',
  condense: '缩写',
  rewrite: '改写',
  continue: '续写',
  polish: '润色',
}

function getOperationLabel(op: string): string {
  return OPERATION_LABELS[op] || op
}

/** Apply content to the Tiptap editor */
function applyContentToEditor(content: string) {
  const editor = getEditorInstance()
  if (editor) {
    editor.commands.setContent(content, false)
  }
  useWritingStore.getState().updateContent(content)
}

// ============================================
// Component
// ============================================

export function OperationHistoryTimeline() {
  const { aiJobQueue } = useAIStore()
  const completedJobs = useMemo(
    () => aiJobQueue.filter((j) => j.status === 'completed').reverse(),
    [aiJobQueue]
  )

  // Undo/redo stacks: track content snapshots
  const [undoStack, setUndoStack] = useState<ContentSnapshot[]>([])
  const [redoStack, setRedoStack] = useState<ContentSnapshot[]>([])
  const [hoveredJobId, setHoveredJobId] = useState<string | null>(null)
  const [activeSnapshotIdx, setActiveSnapshotIdx] = useState<number | null>(null)

  // Track previously seen completed job IDs to detect new completions
  const prevJobIdsRef = useRef<Set<string>>(new Set())

  // When a new job completes, record a snapshot
  useEffect(() => {
    const currentIds = new Set(completedJobs.map((j) => j.id))

    for (const job of completedJobs) {
      if (!prevJobIdsRef.current.has(job.id) && job.result) {
        // New completed job detected
        const snapshot: ContentSnapshot = {
          jobId: job.id,
          operation: job.type,
          previousContent: job.content,
          appliedContent: job.result,
          timestamp: job.completedAt ?? Date.now(),
        }
        setUndoStack((prev) => [...prev, snapshot])
        // New operation clears the redo stack
        setRedoStack([])
        setActiveSnapshotIdx(null)
      }
    }

    prevJobIdsRef.current = currentIds
  }, [completedJobs])

  // Undo: revert to the "previousContent" of the last snapshot
  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) {
        showToast('没有可撤销的AI操作', 'warning')
        return prev
      }

      const last = prev[prev.length - 1]
      const newUndo = prev.slice(0, -1)

      // Push to redo stack
      setRedoStack((r) => [...r, last])

      // Apply the previous content to editor
      applyContentToEditor(last.previousContent)
      showToast(`已撤销「${getOperationLabel(last.operation)}」`, 'success')
      setActiveSnapshotIdx(null)

      return newUndo
    })
  }, [])

  // Redo: re-apply the "appliedContent" from the top of redo stack
  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) {
        showToast('没有可重做的AI操作', 'warning')
        return prev
      }

      const last = prev[prev.length - 1]
      const newRedo = prev.slice(0, -1)

      // Push back to undo stack
      setUndoStack((u) => [...u, last])

      // Re-apply the AI result
      applyContentToEditor(last.appliedContent)
      showToast(`已重做「${getOperationLabel(last.operation)}」`, 'success')
      setActiveSnapshotIdx(null)

      return newRedo
    })
  }, [])

  // Click a timeline entry to revert to that point in history
  const handleRevertToSnapshot = useCallback(
    (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= undoStack.length) return

      const target = undoStack[targetIdx]

      // All snapshots from targetIdx+1 to end go to redo
      const toRedo = undoStack.slice(targetIdx + 1)

      // Revert to the target snapshot's previousContent
      applyContentToEditor(target.previousContent)

      setUndoStack(undoStack.slice(0, targetIdx))
      setRedoStack((r) => [...r, ...toRedo.reverse()])
      setActiveSnapshotIdx(targetIdx)
      showToast(
        `已回退到「${getOperationLabel(target.operation)}」之前的状态`,
        'success'
      )
    },
    [undoStack]
  )

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey
      if (!isMod) return

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  if (completedJobs.length === 0) return null

  return (
    <div className="space-y-2">
      {/* Header with undo/redo buttons */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
          <span
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
          >
            操作历史
          </span>
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1 rounded transition-colors"
            style={{
              color:
                undoStack.length > 0
                  ? 'var(--text-secondary)'
                  : 'var(--text-tertiary)',
              opacity: undoStack.length > 0 ? 1 : 0.4,
            }}
            title="撤销AI操作 (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1 rounded transition-colors"
            style={{
              color:
                redoStack.length > 0
                  ? 'var(--text-secondary)'
                  : 'var(--text-tertiary)',
              opacity: redoStack.length > 0 ? 1 : 0.4,
            }}
            title="重做AI操作 (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Undo/redo stack indicator */}
      {(undoStack.length > 0 || redoStack.length > 0) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-2 text-[10px] px-1"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <span>可撤销: {undoStack.length}</span>
          <span style={{ color: 'var(--border-subtle)' }}>|</span>
          <span>可重做: {redoStack.length}</span>
          {activeSnapshotIdx !== null && (
            <>
              <span style={{ color: 'var(--border-subtle)' }}>|</span>
              <span className="flex items-center gap-0.5">
                <RotateCcw className="w-2.5 h-2.5" />
                已回退
              </span>
            </>
          )}
        </motion.div>
      )}

      {/* Timeline */}
      <div className="relative pl-3">
        {/* Timeline vertical line */}
        <div
          className="absolute left-[5px] top-1 bottom-1 w-px"
          style={{
            background:
              'linear-gradient(180deg, var(--accent-primary) 0%, var(--border-subtle) 100%)',
          }}
        />
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {completedJobs.map((job, index) => {
              const snapshotIdx = undoStack.findIndex(
                (s) => s.jobId === job.id
              )
              const isReverted =
                activeSnapshotIdx !== null && snapshotIdx >= activeSnapshotIdx
              const isInRedo = redoStack.some((s) => s.jobId === job.id)

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: index * 0.03, duration: DURATION.FAST }}
                  className="relative flex items-center gap-2.5"
                  onMouseEnter={() => setHoveredJobId(job.id)}
                  onMouseLeave={() => setHoveredJobId(null)}
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute left-[-7px] w-[11px] h-[11px] rounded-full border-2 flex-shrink-0"
                    style={{
                      borderColor: isReverted || isInRedo
                        ? 'var(--border-subtle)'
                        : 'var(--color-surface-raised)',
                      background:
                        isReverted || isInRedo
                          ? 'var(--border-subtle)'
                          : getOperationColor(job.type),
                      boxShadow:
                        isReverted || isInRedo
                          ? 'none'
                          : `0 0 6px color-mix(in srgb, ${getOperationColor(job.type)} 31%, transparent)`,
                    }}
                  />

                  <div className="flex-1 min-w-0 pl-3">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-medium"
                        style={{
                          color: isReverted || isInRedo
                            ? 'var(--text-tertiary)'
                            : 'var(--text-secondary)',
                          textDecoration:
                            isReverted || isInRedo ? 'line-through' : 'none',
                        }}
                      >
                        {getOperationLabel(job.type)}
                        {isInRedo && (
                          <span
                            className="ml-1 text-[9px]"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            (已撤销)
                          </span>
                        )}
                      </span>
                      <span
                        className="text-[10px] tabular-nums"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {job.completedAt
                          ? formatTimeAgo(job.completedAt)
                          : ''}
                      </span>
                    </div>

                    {/* Content preview */}
                    <div
                      className="text-[10px] truncate"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {job.content?.slice(0, 30)}...
                    </div>

                    {/* Revert button on hover */}
                    <AnimatePresence>
                      {hoveredJobId === job.id && snapshotIdx >= 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: DURATION.FAST }}
                          className="mt-1"
                        >
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleRevertToSnapshot(snapshotIdx)}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md transition-colors"
                            style={{
                              color: 'var(--accent-primary)',
                              background: 'var(--hover-bg)',
                            }}
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            回退到此处
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <div
        className="text-[9px] mt-2 px-1 flex items-center gap-3"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <span>
          <kbd
            className="px-1 py-0.5 rounded text-[8px]"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
            }}
          >
            Ctrl+Z
          </kbd>{' '}
          撤销
        </span>
        <span>
          <kbd
            className="px-1 py-0.5 rounded text-[8px]"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
            }}
          >
            Ctrl+Y
          </kbd>{' '}
          重做
        </span>
      </div>
    </div>
  )
}

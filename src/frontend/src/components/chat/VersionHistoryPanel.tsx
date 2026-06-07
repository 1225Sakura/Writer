/**
 * VersionHistoryPanel - Version snapshot list with diff view and rollback
 *
 * Features:
 * - Lists version snapshots for the current session
 * - Select two snapshots to compare (diff view)
 * - Rollback to a snapshot with double-confirm
 * - Mobile: fullscreen Dialog
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { useChatStore } from '@/store/chatStore'
import {
  listSnapshots,
  diffSnapshots,
  rollbackToSnapshot,
  type VersionSnapshot,
} from '@/services/versionService'
import { VersionDiffView } from './VersionDiffView'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  History,
  RotateCcw,
  ArrowLeftRight,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { showSuccess, showOperationError } from '@/utils/toastHelper'

interface VersionHistoryPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VersionHistoryPanel({ open, onOpenChange }: VersionHistoryPanelProps) {
  const { sessionId } = useChatStore()
  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<[string, string] | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null)
  const [rollbackConfirm, setRollbackConfirm] = useState(false)
  const [rolling, setRolling] = useState(false)

  const loadSnapshots = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const data = await listSnapshots(sessionId)
      setSnapshots(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (open) {
      loadSnapshots()
      setSelectedIds(null)
      setRollbackTarget(null)
      setRollbackConfirm(false)
    }
  }, [open, loadSnapshots])

  const handleSelect = (id: string) => {
    if (!selectedIds) {
      setSelectedIds([id, id])
    } else if (selectedIds[0] === id || selectedIds[1] === id) {
      // Deselect
      setSelectedIds(null)
    } else {
      // Replace second
      setSelectedIds([selectedIds[0], id])
    }
  }

  const handleRollback = async (snapshotId: string) => {
    if (!rollbackConfirm) {
      setRollbackTarget(snapshotId)
      setRollbackConfirm(true)
      return
    }

    if (!sessionId) return
    setRolling(true)
    try {
      const entities = await rollbackToSnapshot(sessionId, snapshotId)
      if (entities) {
        // Replace entities in store
        const store = useChatStore.getState()
        store.extractedEntities.length = 0
        store.extractedEntities.push(...entities)
        showSuccess('已回滚到选定版本')
        await loadSnapshots()
      }
    } catch (error) {
      showOperationError('版本回滚', error)
    } finally {
      setRolling(false)
      setRollbackTarget(null)
      setRollbackConfirm(false)
    }
  }

  const getDiffData = () => {
    if (!selectedIds) return null
    const [oldId, newId] = selectedIds
    const oldSnap = snapshots.find((s) => s.id === oldId)
    const newSnap = snapshots.find((s) => s.id === newId)
    if (!oldSnap || !newSnap) return null

    // Always diff from older to newer
    const [older, newer] = oldSnap.timestamp <= newSnap.timestamp
      ? [oldSnap, newSnap]
      : [newSnap, oldSnap]

    return {
      diff: diffSnapshots(older.entities, newer.entities),
      oldTimestamp: older.timestamp,
      newTimestamp: newer.timestamp,
    }
  }

  const diffData = getDiffData()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            版本历史
          </DialogTitle>
          <DialogDescription>
            查看会话版本快照，对比变更差异，支持回滚到历史版本。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-3 min-h-0">
          {/* Snapshot list */}
          <div className="md:w-[45%] flex flex-col min-h-0">
            <div className="text-xs text-secondary mb-2 px-1">
              {snapshots.length} 个快照 · 点击选择两个进行对比
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                </div>
              ) : snapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-secondary">
                  <Clock className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">暂无版本快照</p>
                  <p className="text-xs mt-1">确认实体或导出大纲时会自动创建</p>
                </div>
              ) : (
                [...snapshots].reverse().map((snap) => {
                  const isSelected = selectedIds?.includes(snap.id) ?? false
                  const isRollbackTarget = rollbackTarget === snap.id
                  const isLast = snap.id === snapshots[snapshots.length - 1]?.id

                  return (
                    <motion.div
                      key={snap.id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                      className={`group relative px-3 py-2.5 rounded-lg cursor-pointer text-xs transition-colors ${
                        isSelected
                          ? 'ring-1 ring-[var(--color-outline)] bg-[var(--color-surface-base)]'
                          : 'hover:bg-[var(--color-surface-base)]/50'
                      }`}
                      onClick={() => handleSelect(snap.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-primary">
                          {formatTime(snap.timestamp)}
                        </span>
                        <span className="text-[10px] text-secondary">
                          {snap.messageCount} 消息
                        </span>
                      </div>
                      <p className="mt-0.5 text-secondary truncate">{snap.summary}</p>

                      {/* Rollback button */}
                      {!isLast && (
                        <motion.button
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                            isRollbackTarget && rollbackConfirm
                              ? 'bg-[var(--color-faction)] text-white'
                              : 'opacity-0 group-hover:opacity-100 text-secondary hover:text-primary hover:bg-[var(--color-surface-base)]'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRollback(snap.id)
                          }}
                          onBlur={() => {
                            setRollbackTarget(null)
                            setRollbackConfirm(false)
                          }}
                          whileTap={{ scale: 0.9 }}
                          title={isRollbackTarget && rollbackConfirm ? '确认回滚' : '回滚到此版本'}
                        >
                          {rolling && rollbackTarget === snap.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                        </motion.button>
                      )}

                      {/* Selection indicator */}
                      {isSelected && (
                        <motion.div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                          style={{ background: 'var(--color-outline)' }}
                          layoutId="version-selection"
                        />
                      )}
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>

          {/* Diff view */}
          <div className="md:flex-1 flex flex-col min-h-0 border-t md:border-t-0 md:border-l border-default pt-3 md:pt-0 md:pl-3">
            {!selectedIds ? (
              <div className="flex-1 flex flex-col items-center justify-center text-secondary">
                <ArrowLeftRight className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm">选择两个快照查看差异</p>
              </div>
            ) : diffData ? (
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <VersionDiffView
                  diff={diffData.diff}
                  oldTimestamp={diffData.oldTimestamp}
                  newTimestamp={diffData.newTimestamp}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Rollback confirmation bar */}
        <AnimatePresence>
          {rollbackTarget && rollbackConfirm && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'var(--color-diff-removed-bg, rgba(239,68,68,0.1))' }}
            >
              <AlertTriangle className="w-4 h-4 text-[var(--color-diff-removed, #ef4444)]" />
              <span className="flex-1">回滚将覆盖当前实体数据，确定继续？</span>
              <button
                className="px-2.5 py-1 rounded text-xs text-secondary hover:text-primary"
                onClick={() => { setRollbackTarget(null); setRollbackConfirm(false) }}
              >
                取消
              </button>
              <button
                className="px-2.5 py-1 rounded text-xs font-medium text-white"
                style={{ background: 'var(--color-diff-removed, #ef4444)' }}
                onClick={() => handleRollback(rollbackTarget)}
              >
                确认回滚
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

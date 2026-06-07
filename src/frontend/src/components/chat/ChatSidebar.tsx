import { useState, useEffect, useRef } from 'react'
import { ExtractedEntity } from '@/store'
import { useChatStore } from '@/store/chatStore'
import { CollectedInfoPanel } from './CollectedInfoPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelRightClose, PanelRightOpen, MessageSquare, Trash2, Plus, Download, Upload, FileJson, FileText, AlertTriangle } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  exportToJSON,
  downloadJSON,
  exportToMarkdown,
  downloadMarkdown,
  importFromJSON,
  type ExportSessionData,
  type ImportValidationResult,
} from '@/services/exportService'
import { showSuccess } from '@/utils/toastHelper'

interface ChatSidebarProps {
  entities: ExtractedEntity[]
  sessionId?: number | null
  onConfirmEntity?: (id: string) => void
  onConfirmAll?: () => void
}

/**
 * ChatSidebar wraps CollectedInfoPanel with responsive layout.
 * Includes a session list at the top for switching/deleting sessions.
 * - Desktop: fixed-width sidebar on the right with GlassCard styling
 * - Mobile: collapsible drawer with overlay
 */
export function ChatSidebar({ entities, sessionId: _sessionId, onConfirmEntity, onConfirmAll }: ChatSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importResult, setImportResult] = useState<ImportValidationResult | null>(null)
  const [importConfirm, setImportConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { sessions, sessionId, messages, loadSessions, switchSession, deleteSession, createSession, extractedEntities } = useChatStore()

  const handleExportJSON = () => {
    if (!sessionId) return
    const json = exportToJSON(sessionId, messages, extractedEntities)
    downloadJSON(json, `writer-session-${sessionId}.json`)
    showSuccess('已导出 JSON 文件')
    setExportMenuOpen(false)
  }

  const handleExportMarkdown = () => {
    if (!sessionId) return
    const md = exportToMarkdown(extractedEntities, messages)
    downloadMarkdown(md, `writer-session-${sessionId}.md`)
    showSuccess('已导出 Markdown 文件')
    setExportMenuOpen(false)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await importFromJSON(file)
    setImportResult(result)
    setImportDialogOpen(true)
    setImportConfirm(false)
    // Reset input
    e.target.value = ''
  }

  const handleConfirmImport = () => {
    if (!importResult?.preview) return
    const data = importResult.preview as ExportSessionData
    // Import entities into current store
    const store = useChatStore.getState()
    store.extractedEntities.length = 0
    store.extractedEntities.push(...data.entities.map((e) => ({
      ...e,
      id: `imported-${e.id}`,
    })))
    showSuccess(`已导入 ${data.entities.length} 个实体`)
    setImportDialogOpen(false)
    setImportResult(null)
    setImportConfirm(false)
  }

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">
        <motion.div
          className="w-[var(--sidebar-left-width)] xl:w-[35%] xl:max-w-[var(--sidebar-ai-drawer-width-expanded)] xl:min-w-[var(--sidebar-left-width)] h-full shrink-0 overflow-hidden flex flex-col"
          style={{
            background: 'var(--color-surface-raised)',
            borderLeft: '1px solid var(--border-default)',
          }}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <SessionList
            sessions={sessions}
            activeSessionId={sessionId}
            onSwitch={switchSession}
            onDelete={deleteSession}
            onCreate={createSession}
            onExportJSON={handleExportJSON}
            onExportMarkdown={handleExportMarkdown}
            onImport={handleImportClick}
            exportMenuOpen={exportMenuOpen}
            setExportMenuOpen={setExportMenuOpen}
          />
          <CollectedInfoPanel entities={entities} sessionId={sessionId} onConfirmEntity={onConfirmEntity} onConfirmAll={onConfirmAll} />
        </motion.div>
      </div>

      {/* Mobile toggle button - enhanced with GlassCard */}
      <motion.button
        className="md:hidden fixed right-4 bottom-20 z-50 w-11 h-11 rounded-full
                   flex items-center justify-center text-secondary hover:text-primary"
        onClick={() => setMobileOpen(!mobileOpen)}
        whileTap={{ scale: 0.9 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <GlassCard
          intensity="strong"
          border="subtle"
          variant="elevated"
          rounded="full"
          padding="none"
          hover
          className="w-full h-full flex items-center justify-center"
        >
          {mobileOpen ? <PanelRightOpen className="w-5 h-5" /> : <PanelRightClose className="w-5 h-5" />}
        </GlassCard>
      </motion.button>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="md:hidden fixed right-0 top-0 bottom-0 z-40 w-[85%] max-w-[360px] flex flex-col"
              style={{
                background: 'var(--color-surface-raised)',
                boxShadow: '-8px 0 32px color-mix(in srgb, var(--ink-100) 20%, transparent)',
              }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <SessionList
                sessions={sessions}
                activeSessionId={sessionId}
                onSwitch={switchSession}
                onDelete={deleteSession}
                onCreate={createSession}
                onExportJSON={handleExportJSON}
                onExportMarkdown={handleExportMarkdown}
                onImport={handleImportClick}
                exportMenuOpen={exportMenuOpen}
                setExportMenuOpen={setExportMenuOpen}
              />
              <CollectedInfoPanel
                entities={entities}
                sessionId={sessionId}
                onConfirmEntity={onConfirmEntity}
                onConfirmAll={onConfirmAll}
                onClose={() => setMobileOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Import preview dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              导入会话数据
            </DialogTitle>
            <DialogDescription>
              请确认要导入的数据内容。
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-3">
              {importResult.valid && importResult.preview ? (
                <>
                  <div className="rounded-lg p-3 text-xs space-y-1.5"
                    style={{ background: 'var(--color-surface-base)' }}>
                    <div className="flex justify-between">
                      <span className="text-secondary">版本</span>
                      <span>{importResult.preview.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">导出时间</span>
                      <span>{new Date(importResult.preview.exportedAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">消息数量</span>
                      <span>{importResult.preview.metadata.messageCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">实体数量</span>
                      <span>{importResult.preview.metadata.entityCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">已确认实体</span>
                      <span>{importResult.preview.metadata.confirmedCount}</span>
                    </div>
                  </div>
                  {!importConfirm ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        className="px-3 py-1.5 rounded-lg text-xs text-secondary hover:text-primary hover:bg-surface-base"
                        onClick={() => { setImportDialogOpen(false); setImportResult(null) }}
                      >
                        取消
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                        style={{ background: 'var(--color-outline)' }}
                        onClick={() => setImportConfirm(true)}
                      >
                        确认导入
                      </button>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                      style={{ background: 'var(--color-diff-removed-bg, rgba(239,68,68,0.1))' }}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--color-diff-removed, #ef4444)' }} />
                      <span className="flex-1">导入将覆盖当前实体数据，确定继续？</span>
                      <button
                        className="px-2 py-1 rounded text-xs text-secondary hover:text-primary"
                        onClick={() => setImportConfirm(false)}
                      >
                        取消
                      </button>
                      <button
                        className="px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ background: 'var(--color-diff-removed, #ef4444)' }}
                        onClick={handleConfirmImport}
                      >
                        确定
                      </button>
                    </motion.div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg p-3 text-xs"
                    style={{ background: 'var(--color-diff-removed-bg, rgba(239,68,68,0.08))' }}>
                    <div className="flex items-center gap-1.5 font-medium mb-2" style={{ color: 'var(--color-diff-removed, #ef4444)' }}>
                      <AlertTriangle className="w-3.5 h-3.5" /> 导入验证失败
                    </div>
                    <ul className="space-y-1">
                      {importResult.errors.map((err, i) => (
                        <li key={i} className="text-secondary">- {err}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex justify-end">
                    <button
                      className="px-3 py-1.5 rounded-lg text-xs text-secondary hover:text-primary hover:bg-surface-base"
                      onClick={() => { setImportDialogOpen(false); setImportResult(null) }}
                    >
                      关闭
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================
// SessionList sub-component
// ============================================

interface SessionListProps {
  sessions: { id: number; created_at: string; updated_at: string }[]
  activeSessionId: number | null
  onSwitch: (id: number) => void
  onDelete: (id: number) => void
  onCreate: () => void
  onExportJSON: () => void
  onExportMarkdown: () => void
  onImport: () => void
  exportMenuOpen: boolean
  setExportMenuOpen: (open: boolean) => void
}

function SessionList({ sessions, activeSessionId, onSwitch, onDelete, onCreate, onExportJSON, onExportMarkdown, onImport, exportMenuOpen, setExportMenuOpen }: SessionListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const handleDelete = (id: number) => {
    if (confirmDeleteId === id) {
      onDelete(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
    }
  }

  return (
    <div className="border-b border-default">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-secondary" />
          <span className="text-xs font-medium text-secondary">会话列表</span>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Export dropdown */}
          <div className="relative">
            <motion.button
              className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-surface-base"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              whileTap={{ scale: 0.9 }}
              title="导出"
            >
              <Download className="w-3.5 h-3.5" />
            </motion.button>
            <AnimatePresence>
              {exportMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: DURATION.FAST }}
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg py-1 min-w-[120px]"
                  style={{
                    background: 'var(--color-surface-raised)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-base"
                    onClick={onExportJSON}
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    导出 JSON
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-base"
                    onClick={onExportMarkdown}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    导出 Markdown
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Import button */}
          <motion.button
            className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-surface-base"
            onClick={onImport}
            whileTap={{ scale: 0.9 }}
            title="导入"
          >
            <Upload className="w-3.5 h-3.5" />
          </motion.button>
          {/* New session */}
          <motion.button
            className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-surface-base"
            onClick={onCreate}
            whileTap={{ scale: 0.9 }}
            title="新建会话"
          >
            <Plus className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Session items */}
      {sessions.length > 0 && (
        <div className="max-h-[180px] overflow-y-auto scrollbar-thin px-2 pb-2">
          <AnimatePresence mode="popLayout">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId
              return (
                <motion.div
                  key={session.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                  className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs
                    ${isActive
                      ? 'bg-surface-base text-primary'
                      : 'text-secondary hover:bg-surface-base/50 hover:text-primary'
                    }`}
                  onClick={() => onSwitch(session.id)}
                >
                  <span className="flex-1 truncate">
                    {isActive ? '当前会话' : `会话 #${session.id}`}
                  </span>
                  <span className="text-[10px] opacity-50 shrink-0">
                    {formatSessionDate(session.updated_at)}
                  </span>
                  <motion.button
                    className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity
                      ${confirmDeleteId === session.id
                        ? 'text-[var(--color-faction)] opacity-100'
                        : 'text-secondary hover:text-primary'
                      }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(session.id)
                    }}
                    onBlur={() => setConfirmDeleteId(null)}
                    whileTap={{ scale: 0.85 }}
                    title={confirmDeleteId === session.id ? '确认删除' : '删除会话'}
                  >
                    <Trash2 className="w-3 h-3" />
                  </motion.button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function formatSessionDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}小时前`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}天前`
  } catch {
    return ''
  }
}

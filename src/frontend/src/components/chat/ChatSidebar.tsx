import { useState, useEffect, useRef } from 'react'
import { ExtractedEntity } from '@/store'
import { useChatStore } from '@/store/chatStore'
import { CollectedInfoPanel } from './CollectedInfoPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelRightClose, PanelRightOpen, MessageSquare, Trash2, Plus, Download, Upload, FileJson, FileText, AlertTriangle, Search, X, Pin, Archive, ArchiveRestore, MoreVertical, Pencil } from 'lucide-react'
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
  const { sessions, sessionId, messages, loadSessions, switchSession, deleteSession, createSession, extractedEntities, renameSession, archiveSession, unarchiveSession, pinSession, unpinSession } = useChatStore()

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
            onRename={renameSession}
            onArchive={archiveSession}
            onUnarchive={unarchiveSession}
            onPin={pinSession}
            onUnpin={unpinSession}
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
                onRename={renameSession}
                onArchive={archiveSession}
                onUnarchive={unarchiveSession}
                onPin={pinSession}
                onUnpin={unpinSession}
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
  sessions: { id: number; created_at: string; updated_at: string; title?: string; archived?: boolean; pinned?: boolean }[]
  activeSessionId: number | null
  onSwitch: (id: number) => void
  onDelete: (id: number) => void
  onCreate: () => void
  onRename: (id: number, title: string) => Promise<void>
  onArchive: (id: number) => Promise<void>
  onUnarchive: (id: number) => Promise<void>
  onPin: (id: number) => Promise<void>
  onUnpin: (id: number) => Promise<void>
  onExportJSON: () => void
  onExportMarkdown: () => void
  onImport: () => void
  exportMenuOpen: boolean
  setExportMenuOpen: (open: boolean) => void
}

function SessionList({ sessions, activeSessionId, onSwitch, onDelete, onCreate, onRename, onArchive, onUnarchive, onPin, onUnpin, onExportJSON, onExportMarkdown, onImport, exportMenuOpen, setExportMenuOpen }: SessionListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ id: number; x: number; y: number } | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const handleDelete = (id: number) => {
    if (confirmDeleteId === id) {
      onDelete(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
    }
  }

  // Start inline rename
  const startRename = (id: number, currentTitle?: string) => {
    setEditingId(id)
    setEditingTitle(currentTitle || `会话 #${id}`)
    setContextMenu(null)
    setTimeout(() => editInputRef.current?.select(), 0)
  }

  // Save rename
  const saveRename = async () => {
    if (editingId !== null && editingTitle.trim()) {
      await onRename(editingId, editingTitle.trim())
    }
    setEditingId(null)
    setEditingTitle('')
  }

  // Cancel rename
  const cancelRename = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent, sessionId: number) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ id: sessionId, x: e.clientX, y: e.clientY })
  }

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  // Partition sessions: non-archived for main list, archived for collapsed section
  const activeSessions = sessions.filter((s) => !s.archived)
  const archivedSessions = sessions.filter((s) => s.archived)

  // Filter sessions by search query
  const filteredActiveSessions = searchQuery.trim()
    ? activeSessions.filter((session) => {
        const query = searchQuery.toLowerCase()
        const label = session.title || (session.id === activeSessionId ? '当前会话' : `会话 #${session.id}`)
        const date = formatSessionDate(session.updated_at)
        return label.toLowerCase().includes(query) || date.toLowerCase().includes(query)
      })
    : activeSessions

  const filteredArchivedSessions = searchQuery.trim()
    ? archivedSessions.filter((session) => {
        const query = searchQuery.toLowerCase()
        const label = session.title || `会话 #${session.id}`
        const date = formatSessionDate(session.updated_at)
        return label.toLowerCase().includes(query) || date.toLowerCase().includes(query)
      })
    : archivedSessions

  const renderSessionItem = (session: { id: number; created_at: string; updated_at: string; title?: string; archived?: boolean; pinned?: boolean }) => {
    const isActive = session.id === activeSessionId
    const label = session.title || (isActive ? '当前会话' : `会话 #${session.id}`)
    const isEditing = editingId === session.id

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
        onClick={() => !isEditing && onSwitch(session.id)}
        onContextMenu={(e) => handleContextMenu(e, session.id)}
      >
        {session.pinned && !isEditing && (
          <Pin className="w-3 h-3 shrink-0 text-[var(--accent-primary)]" />
        )}
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename()
              if (e.key === 'Escape') cancelRename()
            }}
            onBlur={saveRename}
            className="flex-1 min-w-0 bg-transparent border-b border-[var(--accent-primary)] text-xs text-[var(--text-primary)] focus:outline-none px-0.5"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate">
            <HighlightedText text={label} query={searchQuery} />
          </span>
        )}
        <span className="text-[10px] opacity-50 shrink-0">
          {formatSessionDate(session.updated_at)}
        </span>
        {/* Context menu trigger */}
        <motion.button
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-secondary hover:text-primary"
          onClick={(e) => {
            e.stopPropagation()
            handleContextMenu(e, session.id)
          }}
          whileTap={{ scale: 0.85 }}
          title="更多操作"
        >
          <MoreVertical className="w-3 h-3" />
        </motion.button>
      </motion.div>
    )
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

      {/* Search box */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索会话..."
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg
                       bg-[var(--color-surface-base)] border border-[var(--border-default)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]
                       focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20
                       transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Session items */}
      {filteredActiveSessions.length > 0 && (
        <div className="max-h-[180px] overflow-y-auto scrollbar-thin px-2 pb-2">
          <AnimatePresence mode="popLayout">
            {filteredActiveSessions.map(renderSessionItem)}
          </AnimatePresence>
        </div>
      )}

      {/* Archived sessions toggle */}
      {archivedSessions.length > 0 && (
        <div className="px-2 pb-2">
          <button
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg text-xs text-secondary hover:text-primary hover:bg-surface-base/50 transition-colors"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="w-3 h-3" />
            <span>已归档 ({archivedSessions.length})</span>
            <span className="ml-auto text-[10px]">{showArchived ? '收起' : '展开'}</span>
          </button>
          <AnimatePresence>
            {showArchived && filteredArchivedSessions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {filteredArchivedSessions.map(renderSessionItem)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Context menu portal */}
      {contextMenu && (
        <div
          className="fixed z-[100] rounded-lg shadow-lg py-1 min-w-[140px]"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--border-default)',
          }}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-base"
            onClick={(e) => {
              e.stopPropagation()
              const session = sessions.find((s) => s.id === contextMenu.id)
              startRename(contextMenu.id, session?.title)
            }}
          >
            <Pencil className="w-3.5 h-3.5" />
            重命名
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-base"
            onClick={(e) => {
              e.stopPropagation()
              const session = sessions.find((s) => s.id === contextMenu.id)
              if (session?.pinned) {
                onUnpin(contextMenu.id)
              } else {
                onPin(contextMenu.id)
              }
              setContextMenu(null)
            }}
          >
            <Pin className="w-3.5 h-3.5" />
            {sessions.find((s) => s.id === contextMenu.id)?.pinned ? '取消置顶' : '置顶'}
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-base"
            onClick={(e) => {
              e.stopPropagation()
              const session = sessions.find((s) => s.id === contextMenu.id)
              if (session?.archived) {
                onUnarchive(contextMenu.id)
              } else {
                onArchive(contextMenu.id)
              }
              setContextMenu(null)
            }}
          >
            {sessions.find((s) => s.id === contextMenu.id)?.archived ? (
              <>
                <ArchiveRestore className="w-3.5 h-3.5" />
                取消归档
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                归档
              </>
            )}
          </button>
          <div className="border-t border-default my-1" />
          <button
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-surface-base
              ${confirmDeleteId === contextMenu.id
                ? 'text-[var(--color-faction)]'
                : 'text-secondary hover:text-primary'
              }`}
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(contextMenu.id)
              if (confirmDeleteId === contextMenu.id) {
                setContextMenu(null)
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmDeleteId === contextMenu.id ? '确认删除' : '删除'}
          </button>
        </div>
      )}
    </div>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <span className="bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded px-0.5">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
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

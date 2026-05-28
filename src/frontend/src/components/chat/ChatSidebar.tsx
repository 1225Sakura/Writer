import { useState, useEffect } from 'react'
import { ExtractedEntity } from '@/store'
import { useChatStore } from '@/store/chatStore'
import { CollectedInfoPanel } from './CollectedInfoPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelRightClose, PanelRightOpen, MessageSquare, Trash2, Plus } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

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
  const { sessions, sessionId, loadSessions, switchSession, deleteSession, createSession } = useChatStore()

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">
        <motion.div
          className="w-[var(--sidebar-left-width)] xl:w-[35%] xl:max-w-[var(--sidebar-ai-drawer-width-expanded)] xl:min-w-[var(--sidebar-left-width)] h-full shrink-0 overflow-hidden"
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
              className="md:hidden fixed right-0 top-0 bottom-0 z-40 w-[85%] max-w-[360px]"
              style={{
                background: 'var(--color-surface-raised)',
                boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
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
}

function SessionList({ sessions, activeSessionId, onSwitch, onDelete, onCreate }: SessionListProps) {
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
        <motion.button
          className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-surface-base"
          onClick={onCreate}
          whileTap={{ scale: 0.9 }}
          title="新建会话"
        >
          <Plus className="w-3.5 h-3.5" />
        </motion.button>
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

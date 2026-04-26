import { useEffect, useState } from 'react'
import { useChatStore, type ExtractedEntity } from '@/store'
import { ChatHeader } from './ChatHeader'
import { ChatArea } from './ChatArea'
import { ChatSidebar } from './ChatSidebar'
import { ChatFooter } from './ChatFooter'
import { UserInputPanel } from './UserInputPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { X, CheckCircle, Circle } from 'lucide-react'

/* ============================================================
   AMBIENT BACKGROUND GLOW
   ============================================================ */

function AmbientBackground() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Primary ambient glow - top left */}
      <motion.div
        className="absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
          opacity: 'var(--ambient-glow-primary, 0.12)',
          filter: 'blur(40px)',
        }}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.15, 1],
          opacity: ['var(--ambient-glow-primary, 0.08)', 'var(--ambient-glow-primary, 0.14)', 'var(--ambient-glow-primary, 0.08)'],
          x: [0, 15, 0],
          y: [0, -10, 0],
        }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Secondary glow - bottom right */}
      <motion.div
        className="absolute -bottom-24 right-20 w-[24rem] h-[24rem] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--color-character) 0%, transparent 70%)',
          opacity: 'var(--ambient-glow-secondary, 0.1)',
          filter: 'blur(35px)',
        }}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.2, 1],
          opacity: ['var(--ambient-glow-secondary, 0.06)', 'var(--ambient-glow-secondary, 0.12)', 'var(--ambient-glow-secondary, 0.06)'],
          x: [0, -12, 0],
          y: [0, 8, 0],
        }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      {/* Tertiary accent glow - center */}
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
          opacity: 'var(--ambient-glow-tertiary, 0.05)',
          filter: 'blur(50px)',
        }}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.3, 1],
          opacity: ['var(--ambient-glow-tertiary, 0.03)', 'var(--ambient-glow-tertiary, 0.07)', 'var(--ambient-glow-tertiary, 0.03)'],
        }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
    </div>
  )
}

/* ============================================================
   MOBILE SIDEBAR CONTENT - Reuses ChatSidebar internals
   ============================================================ */

function ChatSidebarMobile({ entities, onConfirmEntity }: {
  entities: ExtractedEntity[]
  onConfirmEntity?: (id: string) => void
}) {
  const groupedEntities = entities.reduce(
    (acc, entity) => {
      const key = entity.type
      if (!acc[key]) acc[key] = []
      acc[key].push(entity)
      return acc
    },
    {} as Record<string, ExtractedEntity[]>
  )

  const confirmedCount = entities.filter((e) => e.confirmed).length
  const progressPercent = entities.length > 0 ? (confirmedCount / entities.length) * 100 : 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-3">
        <div className="text-xs text-secondary mb-1">
          {confirmedCount}/{entities.length} 项已确认
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-base">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: progressPercent === 100
                ? 'linear-gradient(90deg, var(--color-ifline), var(--color-ifline))'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {entities.length === 0 ? (
          <div className="text-center py-8 text-secondary text-sm">
            开始对话后，这里将显示收集到的设定信息
          </div>
        ) : (
          <div>
            {Object.entries(groupedEntities).map(([type, typeEntities]) => (
              <div key={type} className="mb-3">
                <div className="text-xs font-medium text-secondary mb-1.5 px-1">
                  {type === 'world' ? '世界观' :
                   type === 'character' ? '角色' :
                   type === 'item' ? '物品' :
                   type === 'location' ? '地点' :
                   type === 'faction' ? '势力' :
                   type === 'rule' ? '规则' :
                   type === 'ifline' ? 'IF线' : type}
                  {' '}
                  <span className="text-tertiary">({typeEntities.length})</span>
                </div>
                <div className="space-y-1">
                  {typeEntities.map((entity) => (
                    <div
                      key={entity.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-base/50"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: typeColors[entity.type] || 'var(--color-character)'
                        }}
                      />
                      <span className="text-sm text-primary flex-1 truncate">{entity.name}</span>
                      {entity.confirmed ? (
                        <CheckCircle className="w-4 h-4 text-[var(--color-ifline)]" />
                      ) : (
                        <button
                          onClick={() => onConfirmEntity?.(entity.id)}
                          className="text-secondary hover:text-primary"
                        >
                          <Circle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { typeColors } from '@/lib/entityColors'

/* ============================================================
   CHAT INIT PAGE - Composed from sub-components
   ============================================================ */

export function ChatInitPage() {
  const { extractedEntities, sessionId, createSession, loadExtractedEntities, loadMessages, confirmEntity } = useChatStore()
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false)

  // Initialize session on mount
  useEffect(() => {
    if (!sessionId) {
      createSession()
    }
  }, [sessionId, createSession])

  // Load extracted entities when session changes
  useEffect(() => {
    if (sessionId) {
      loadExtractedEntities()
      loadMessages()
    }
  }, [sessionId, loadExtractedEntities, loadMessages])

  return (
    <motion.div
      className="flex flex-col h-full relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Ambient background glow */}
      <AmbientBackground />

      {/* Top navigation bar */}
      <ChatHeader onMobileMenuClick={() => setMobileInfoOpen(true)} />

      {/* Main Content Area - Left/Right Split Layout */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Left: AI chat area */}
        <ChatArea />

        {/* Right: Collected info sidebar - desktop only */}
        <ChatSidebar
          entities={extractedEntities}
          onConfirmEntity={confirmEntity}
        />
      </div>

      {/* Mobile: Collected info bottom sheet */}
      <AnimatePresence>
        {mobileInfoOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mobile-drawer-overlay mobile-drawer-overlay--open md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="已收集信息"
              onClick={() => setMobileInfoOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="mobile-bottom-sheet mobile-bottom-sheet--open md:hidden"
              style={{
                borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
                maxHeight: '85vh',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.35), 0 -2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                <div className="flex items-center gap-2">
                  <div className="mobile-sheet-handle" aria-hidden="true" />
                  <span className="font-medium text-sm text-[var(--text-primary)]">已收集信息</span>
                </div>
                <button
                  onClick={() => setMobileInfoOpen(false)}
                  className="mobile-menu-btn btn-active-scale"
                  aria-label="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <ChatSidebarMobile
                  entities={extractedEntities}
                  onConfirmEntity={confirmEntity}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* User input panel */}
      <UserInputPanel />

      {/* Bottom action bar */}
      <ChatFooter />
    </motion.div>
  )
}

import { useEffect, useState } from 'react'
import { useChatStore } from '@/store/chatStore'
import { ChatArea } from './ChatArea'
import { ChatSidebar } from './ChatSidebar'
import { ChatFooter } from './ChatFooter'
import { UserInputPanel } from './UserInputPanel'
import { LeftSidebar } from '@/components/shared/LeftSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { X } from 'lucide-react'
import { EASE, DURATION, SPRING } from '@/components/shared/AnimationConfig'
import { WelcomePanel } from './WelcomePanel'
import { PreviewPanel } from './PreviewPanel'

/* ============================================================
   CHAT INIT PAGE - Composed from sub-components
   ============================================================ */

export function ChatInitPage() {
  const { extractedEntities, sessionId, createSession, loadExtractedEntities, loadMessages, confirmEntity } = useChatStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

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
      transition={{ duration: DURATION.SLOW, ease: EASE.OUT }}
    >
      {/* === Content Layer - Left/Right Split === */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Left sidebar: entity overview + navigation */}
        <LeftSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          width="var(--sidebar-left-width)"
        >
          <WelcomePanel entities={extractedEntities} />
        </LeftSidebar>

        {/* Center: AI chat area */}
        <ChatArea />

        {/* Right: Collected info sidebar - desktop only */}
        <ChatSidebar
          entities={extractedEntities}
          onConfirmEntity={confirmEntity}
        />
      </div>

      {/* === Input Layer === */}
      <UserInputPanel />

      {/* === Footer Layer === */}
      <ChatFooter />

      {/* Mobile: Collected info bottom sheet */}
      <AnimatePresence>
        {mobileInfoOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="已收集信息"
              onClick={() => setMobileInfoOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={prefersReducedMotion
                ? { duration: DURATION.FAST }
                : SPRING.SNAPPY
              }
              className="fixed right-0 left-0 bottom-0 z-50 md:hidden"
              style={{
                borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                maxHeight: '85vh',
                background: 'var(--color-surface-raised)',
                boxShadow: `0 -12px 48px color-mix(in srgb, var(--ink-100) 35%, transparent), 0 -4px 16px color-mix(in srgb, var(--ink-100) 15%, transparent)`,
              }}
            >
              {/* Drag handle - enhanced */}
              <div className="flex items-center justify-center pt-3 pb-1">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--border-strong)' }}
                />
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-b"
                style={{ borderColor: 'var(--border-default)' }}
              >
                <span className="font-medium text-sm text-primary">已收集信息</span>
                <motion.button
                  onClick={() => setMobileInfoOpen(false)}
                  className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-base transition-colors"
                  whileTap={{ scale: 0.9 }}
                  aria-label="关闭"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
              <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(85vh - 120px)' }}>
                <PreviewPanel
                  entities={extractedEntities}
                  onConfirmEntity={confirmEntity}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

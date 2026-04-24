import { useState } from 'react'
import { ExtractedEntity } from '@/store'
import { CollectedInfoPanel } from './CollectedInfoPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'

interface ChatSidebarProps {
  entities: ExtractedEntity[]
  onConfirmEntity?: (id: string) => void
}

/**
 * ChatSidebar wraps CollectedInfoPanel with responsive layout.
 * - Desktop: fixed-width sidebar on the right
 * - Mobile: collapsible drawer with overlay
 */
export function ChatSidebar({ entities, onConfirmEntity }: ChatSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">
        <motion.div
          className="w-[280px] xl:w-[40%] xl:max-w-[480px] xl:min-w-[280px] h-full shrink-0 bg-surface-raised border-l border-default overflow-hidden"
          style={{
            boxShadow: 'inset 4px 0 20px color-mix(in srgb, var(--ink-100) 5%, transparent)',
          }}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <CollectedInfoPanel entities={entities} onConfirmEntity={onConfirmEntity} />
        </motion.div>
      </div>

      {/* Mobile toggle button */}
      <motion.button
        className="md:hidden fixed right-4 bottom-20 z-50 w-10 h-10 rounded-full
                   bg-surface-raised border border-default shadow-lg
                   flex items-center justify-center text-secondary hover:text-primary"
        onClick={() => setMobileOpen(!mobileOpen)}
        whileTap={{ scale: 0.9 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {mobileOpen ? <PanelRightOpen className="w-5 h-5" /> : <PanelRightClose className="w-5 h-5" />}
      </motion.button>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="md:hidden fixed right-0 top-0 bottom-0 z-40 w-[85%] max-w-[360px]
                         bg-surface-raised shadow-2xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <CollectedInfoPanel
                entities={entities}
                onConfirmEntity={onConfirmEntity}
                onClose={() => setMobileOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

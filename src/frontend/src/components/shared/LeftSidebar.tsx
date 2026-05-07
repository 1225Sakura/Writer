import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { EASE, DURATION, SPRING } from '@/components/shared/AnimationConfig'
import type { ReactNode } from 'react'

/* ============================================================
   LeftSidebar — Shared collapsible left sidebar component
   Provides consistent layout, animation, and styling across
   ChatInitPage, SettingEditorPage, and WritingEditorPage.
   ============================================================ */

export interface LeftSidebarProps {
  /** Whether the sidebar is currently expanded */
  isOpen: boolean
  /** Toggle the sidebar open/closed */
  onToggle: () => void
  /** Sidebar content rendered inside the scrollable area */
  children: ReactNode
  /** Optional header rendered above the content */
  header?: ReactNode
  /** Optional footer rendered below the content */
  footer?: ReactNode
  /** Custom width override (default: var(--layout-sidebar-width, 240px)) */
  width?: string | number
  /** Whether to show on mobile (default: false — hide on < md breakpoint) */
  showOnMobile?: boolean
  /** Mobile overlay open state (for mobile drawer mode) */
  mobileOpen?: boolean
  /** Callback to close mobile drawer */
  onMobileClose?: () => void
  /** Additional className for the sidebar container */
  className?: string
  /** Whether the sidebar is visible at all (default: true) */
  visible?: boolean
}

export function LeftSidebar({
  isOpen,
  onToggle,
  children,
  header,
  footer,
  width = 'var(--layout-sidebar-width, 240px)',
  showOnMobile = false,
  mobileOpen = false,
  onMobileClose,
  className = '',
  visible = true,
}: LeftSidebarProps) {
  if (!visible) return null

  return (
    <>
      {/* Desktop sidebar */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="left-sidebar"
            className={`
              hidden md:flex flex-col flex-shrink-0 h-full overflow-hidden relative
              bg-[var(--color-surface-raised)] border-r border-[var(--border-subtle)]
              ${className}
            `}
            style={{ zIndex: 1 }}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{
              width: { type: 'spring', stiffness: 280, damping: 28, restSpeed: 0.5 },
              opacity: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
            }}
          >
            {/* Header area */}
            {header && (
              <div className="flex-shrink-0 border-b border-[var(--border-subtle)]">
                {header}
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>

            {/* Footer area */}
            {footer && (
              <div className="flex-shrink-0 border-t border-[var(--border-subtle)]">
                {footer}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button — positioned at the sidebar edge */}
      <motion.button
        onClick={onToggle}
        className="
          hidden md:flex items-center justify-center flex-shrink-0
          w-5 h-full relative z-10
          text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]
          hover:bg-[var(--color-surface-hover)] transition-colors duration-150
          border-r border-[var(--border-subtle)]
          btn-active-scale
        "
        title={isOpen ? '收起侧边栏' : '展开侧边栏'}
        whileHover={{ backgroundColor: 'var(--color-surface-hover)' }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          initial={false}
          animate={{ rotate: isOpen ? 0 : 180 }}
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        >
          <ChevronLeft className="w-3 h-3" />
        </motion.div>
      </motion.button>

      {/* Mobile drawer (only when showOnMobile is true) */}
      {showOnMobile && (
        <AnimatePresence>
          {mobileOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/50 md:hidden"
                onClick={onMobileClose}
              />
              {/* Drawer */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={SPRING.DRAWER}
                className={`
                  fixed top-0 left-0 bottom-0 z-50 md:hidden
                  w-[280px] max-w-[80vw]
                  bg-[var(--color-surface-raised)] border-r border-[var(--border-default)]
                  flex flex-col overflow-hidden
                  ${className}
                `}
                style={{ boxShadow: 'var(--shadow-drawer)' }}
              >
                {/* Mobile header */}
                {header && (
                  <div className="flex-shrink-0 border-b border-[var(--border-subtle)]">
                    {header}
                  </div>
                )}

                {/* Mobile content */}
                <div className="flex-1 overflow-y-auto">
                  {children}
                </div>

                {/* Mobile footer */}
                {footer && (
                  <div className="flex-shrink-0 border-t border-[var(--border-subtle)]">
                    {footer}
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </>
  )
}

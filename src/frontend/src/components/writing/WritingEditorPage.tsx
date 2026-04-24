import { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore, useWritingStore } from '@/store'
import { WritingToolbar } from './WritingToolbar'
import { WritingCanvas } from './WritingCanvas'
import { AIOperationDrawer } from './AIOperationDrawer'
import { CollaborationPanel } from './CollaborationPanel'
import { OutlineSidebar } from './OutlineSidebar'
import { ChapterNotesPanel } from './ChapterNotesPanel'
import { WritingSprintTimer } from './WritingSprintTimer'
import { Button } from '@/components/ui/Button'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { WritingSkeleton } from '@/components/shared/SmartSkeleton'
import { SectionLoadingOverlay } from '@/components/shared/LoadingOverlay'
import { Sparkles } from 'lucide-react'

const IMMERSIVE_HIDE_DELAY = 3000 // 3 seconds

// Spring animation config for immersive transitions
const IMMERSIVE_SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 }
const IMMERSIVE_EASE = [0.16, 1, 0.3, 1] as const

export function WritingEditorPage() {
  const {
    aiDrawerOpen,
    collaborationDrawerOpen,
    outlineDrawerOpen,
    toggleAIDrawer,
    toggleCollaborationDrawer,
    immersiveMode,
    setImmersiveMode
  } = useUIStore()
  const { init, loading } = useWritingStore()

  const [chromeVisible, setChromeVisible] = useState(true)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingRef = useRef<number>(Date.now())
  const isTypingRef = useRef(false)

  useEffect(() => {
    init()
  }, [init])

  // Reset chrome visibility when immersive mode is toggled off
  useEffect(() => {
    if (!immersiveMode) {
      setChromeVisible(true)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
    }
  }, [immersiveMode])

  const scheduleHideChrome = useCallback(() => {
    if (!immersiveMode) return

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    // Only hide if not typing recently (more than 1 second since last keystroke)
    const timeSinceLastTyping = Date.now() - lastTypingRef.current
    if (timeSinceLastTyping > 1000) {
      hideTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current || timeSinceLastTyping < 1000) return
        setChromeVisible(false)
      }, IMMERSIVE_HIDE_DELAY)
    }
  }, [immersiveMode])

  const showChrome = useCallback(() => {
    setChromeVisible(true)
    lastTypingRef.current = Date.now()
    isTypingRef.current = false
    scheduleHideChrome()
  }, [scheduleHideChrome])

  // Track typing in the writing canvas
  useEffect(() => {
    const handleTypingStart = () => {
      isTypingRef.current = true
      lastTypingRef.current = Date.now()
    }

    const handleTypingStop = () => {
      isTypingRef.current = false
      lastTypingRef.current = Date.now()
      scheduleHideChrome()
    }

    // Listen for typing events from the writing canvas
    document.addEventListener('immersive-typing-start', handleTypingStart)
    document.addEventListener('immersive-typing-stop', handleTypingStop)

    return () => {
      document.removeEventListener('immersive-typing-start', handleTypingStart)
      document.removeEventListener('immersive-typing-stop', handleTypingStop)
    }
  }, [scheduleHideChrome])

  // Mouse move handler to show chrome
  useEffect(() => {
    if (!immersiveMode) return

    let moveTimeout: NodeJS.Timeout | null = null

    const handleMouseMove = (_e: MouseEvent) => {
      // Only show chrome if it's hidden
      if (!chromeVisible) {
        // Show chrome on mouse move, then schedule hide again
        showChrome()
      }

      // Reset typing state on any mouse movement
      lastTypingRef.current = Date.now()
      isTypingRef.current = false
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!immersiveMode) return

      // Show chrome on Escape
      if (e.key === 'Escape') {
        showChrome()
        if (immersiveMode) {
          setImmersiveMode(false)
        }
      }

      // Reset typing state on any key press
      lastTypingRef.current = Date.now()
      isTypingRef.current = false
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('keydown', handleKeyDown)

    // Start the initial hide timer when entering immersive mode
    if (immersiveMode && chromeVisible) {
      scheduleHideChrome()
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('keydown', handleKeyDown)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
      if (moveTimeout) {
        clearTimeout(moveTimeout)
      }
    }
  }, [immersiveMode, chromeVisible, showChrome, scheduleHideChrome, setImmersiveMode])

  return (
    <div className={`h-full flex flex-col bg-[var(--ink-black)] ${immersiveMode ? 'immersive-mode' : ''}`}>
      {/* Layered vignette overlay - subtle multi-layer gradient for natural edge darkening */}
      <AnimatePresence>
        {immersiveMode && (
          <motion.div
            key="vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: IMMERSIVE_EASE }}
            className="fixed inset-0 pointer-events-none z-30 immersive-vignette"
            style={{
              background: `
                radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, color-mix(in srgb, var(--ink-100) 40%, transparent) 75%, color-mix(in srgb, var(--ink-100) 70%, transparent) 100%),
                radial-gradient(ellipse 70% 60% at 50% 50%, transparent 50%, color-mix(in srgb, var(--ink-90) 30%, transparent) 85%, color-mix(in srgb, var(--ink-90) 50%, transparent) 100%)
              `,
            }}
          />
        )}
      </AnimatePresence>

      {/* Subtle ambient glow orbs - adds depth to immersive mode */}
      <AnimatePresence>
        {immersiveMode && (
          <motion.div
            key="ambient-glow"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 1.2, ease: IMMERSIVE_EASE }}
            className="fixed inset-0 pointer-events-none z-25"
          >
            {/* Top-right warm glow */}
            <div
              className="absolute w-96 h-96 rounded-full blur-3xl"
              style={{
                top: '-10%',
                right: '-5%',
                background: 'radial-gradient(circle, color-mix(in srgb, var(--color-character) 6%, transparent) 0%, transparent 70%)',
                animation: 'pulse-glow 8s ease-in-out infinite',
              }}
            />
            {/* Bottom-left cool glow */}
            <div
              className="absolute w-80 h-80 rounded-full blur-3xl"
              style={{
                bottom: '-8%',
                left: '-3%',
                background: 'radial-gradient(circle, color-mix(in srgb, var(--color-outline) 5%, transparent) 0%, transparent 70%)',
                animation: 'pulse-glow 10s ease-in-out infinite reverse',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refined immersive mode indicator - glass pill design */}
      <AnimatePresence>
        {immersiveMode && chromeVisible && (
          <motion.div
            key="immersive-indicator"
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.9 }}
            transition={{ ...IMMERSIVE_SPRING, delay: 0.15 }}
            className="fixed top-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full immersive-indicator"
            style={{
              background: 'color-mix(in srgb, var(--ink-90) 60%, transparent)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid color-mix(in srgb, var(--color-character) 20%, transparent)',
              boxShadow: '0 2px 12px color-mix(in srgb, var(--ink-100) 20%, transparent), inset 0 1px 0 var(--border-subtle)',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-3 h-3" style={{ color: 'color-mix(in srgb, var(--color-character) 80%, transparent)' }} />
            </motion.div>
            <span className="text-[11px] font-medium tracking-wide" style={{ color: 'color-mix(in srgb, var(--color-character) 90%, transparent)' }}>沉浸模式</span>
            <div
              className="w-1 h-1 rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--color-character) 60%, transparent)',
                boxShadow: '0 0 4px color-mix(in srgb, var(--color-character) 40%, transparent)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 工具栏 - refined show/hide with smoother spring animation */}
      <AnimatePresence initial={false}>
        {(!immersiveMode || chromeVisible) && (
          <motion.div
            key="toolbar"
            initial={immersiveMode ? { opacity: 0, y: -16 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: IMMERSIVE_EASE }}
            className="relative z-20"
          >
            <WritingToolbar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主内容区 - z-index for immersive mode stacking */}
      <div className={`flex-1 flex overflow-hidden relative ${immersiveMode ? 'z-10' : ''}`}>
        {/* 写作区域 */}
        <div className="flex-1 overflow-hidden relative">
          <SectionLoadingOverlay
            visible={loading.chapters || loading.outlines}
            message="加载章节数据..."
          />
          {(loading.chapters || loading.outlines) ? (
            <div className="h-full bg-[var(--writing-bg)] overflow-y-auto">
              <WritingSkeleton />
            </div>
          ) : (
            <WritingCanvas />
          )}
        </div>

        {/* Floating components */}
        <ChapterNotesPanel />
        <WritingSprintTimer />

        {/* 大纲侧边栏 (可收起) */}
        <AnimatePresence initial={false}>
          {outlineDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="outline-sidebar"
              initial={{ width: 0, opacity: 0, x: -20 }}
              animate={{ width: 280, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: IMMERSIVE_EASE }}
              className="border-r border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20"
              style={{
                boxShadow: '4px 0 24px color-mix(in srgb, var(--color-outline) 8%, transparent)',
              }}
            >
              {/* Glow indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 right-0 w-px h-full"
                style={{
                  background: 'linear-gradient(180deg, var(--glow-primary) 0%, transparent 100%)',
                }}
              />
              <OutlineSidebar />
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI操作抽屉 - Enhanced spring animation with smooth expansion */}
        <AnimatePresence initial={false}>
          {aiDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="ai-drawer"
              initial={{ width: 0, opacity: 0, x: 40 }}
              animate={{ width: 320, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 40 }}
              transition={{
                width: { type: 'spring', stiffness: 260, damping: 26, restSpeed: 0.5 },
                opacity: { duration: 0.25, ease: IMMERSIVE_EASE },
                x: { type: 'spring', stiffness: 260, damping: 26, restSpeed: 0.5 }
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         w-[280px] md:w-[320px] lg:w-[360px]"
              style={{
                boxShadow: '-4px 0 32px color-mix(in srgb, var(--accent-primary) 20%, transparent), -2px 0 12px color-mix(in srgb, var(--accent-primary) 10%, transparent)',
                maxWidth: '100vw',
              }}
            >
              {/* Animated glow indicator */}
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.4, ease: IMMERSIVE_EASE }}
                className="absolute top-0 left-0 w-px h-full origin-top"
                style={{
                  background: 'linear-gradient(180deg, var(--accent-primary) 0%, color-mix(in srgb, var(--accent-primary) 50%, transparent) 50%, transparent 100%)',
                }}
              />
              <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between min-w-0 w-full">
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.3, ease: IMMERSIVE_EASE }}
                  className="font-medium text-sm text-[var(--text-primary)]"
                >
                  写作操作
                </motion.span>
                <motion.button
                  onClick={toggleAIDrawer}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                  whileHover={{ scale: 1.08, backgroundColor: 'color-mix(in srgb, var(--color-vermillion) 12%, transparent)' }}
                  whileTap={{ scale: 0.95 }}
                  style={{ background: 'transparent' }}
                >
                  <motion.div
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <X className="w-4 h-4 text-[var(--text-secondary)]" />
                  </motion.div>
                </motion.button>
              </div>
              <AIOperationDrawer />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 协作面板 - Enhanced spring animation with matching style */}
        <AnimatePresence initial={false}>
          {collaborationDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="collab-drawer"
              initial={{ width: 0, opacity: 0, x: 30 }}
              animate={{ width: 300, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 30 }}
              transition={{
                width: { type: 'spring', stiffness: 260, damping: 26, restSpeed: 0.5 },
                opacity: { duration: 0.25, ease: IMMERSIVE_EASE },
                x: { type: 'spring', stiffness: 260, damping: 26, restSpeed: 0.5 }
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20"
              style={{
                boxShadow: '-4px 0 32px color-mix(in srgb, var(--color-ifline) 18%, transparent), -2px 0 12px color-mix(in srgb, var(--color-ifline) 10%, transparent)',
              }}
            >
              {/* Animated glow indicator */}
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.4, ease: IMMERSIVE_EASE }}
                className="absolute top-0 left-0 w-px h-full origin-top"
                style={{
                  background: 'linear-gradient(180deg, var(--color-ifline) 0%, color-mix(in srgb, var(--color-ifline) 50%, transparent) 50%, transparent 100%)',
                }}
              />
              <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between min-w-0 w-full">
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.3, ease: IMMERSIVE_EASE }}
                  className="font-medium text-sm text-[var(--text-primary)]"
                >
                  协作面板
                </motion.span>
                <motion.button
                  onClick={toggleCollaborationDrawer}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                  whileHover={{ scale: 1.08, backgroundColor: 'color-mix(in srgb, var(--color-ifline) 12%, transparent)' }}
                  whileTap={{ scale: 0.95 }}
                  style={{ background: 'transparent' }}
                >
                  <motion.div
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <X className="w-4 h-4 text-[var(--text-secondary)]" />
                  </motion.div>
                </motion.button>
              </div>
              <CollaborationPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

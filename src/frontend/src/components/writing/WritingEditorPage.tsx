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

        {/* AI操作抽屉 - Framer Motion with glow effect */}
        <AnimatePresence initial={false}>
          {aiDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="ai-drawer"
              initial={{ width: 0, opacity: 0, x: 20 }}
              animate={{ width: 320, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 20 }}
              transition={{ duration: 0.35, ease: IMMERSIVE_EASE }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         w-full sm:w-[280px] md:w-[320px]"
              style={{
                boxShadow: '-4px 0 24px color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                maxWidth: '100vw',
              }}
            >
              {/* Glow indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 left-0 w-px h-full"
                style={{
                  background: 'linear-gradient(180deg, var(--glow-primary) 0%, transparent 100%)',
                }}
              />
              <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between min-w-0 w-full">
                <span className="font-medium text-sm text-[var(--text-primary)]">写作操作</span>
                <Button
                  onClick={toggleAIDrawer}
                  variant="ghost"
                  size="icon"
                >
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </Button>
              </div>
              <AIOperationDrawer />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 协作面板 - Framer Motion with glow effect */}
        <AnimatePresence initial={false}>
          {collaborationDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="collab-drawer"
              initial={{ width: 0, opacity: 0, x: 20 }}
              animate={{ width: 280, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 20 }}
              transition={{ duration: 0.35, ease: IMMERSIVE_EASE }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20"
              style={{
                boxShadow: '-4px 0 24px color-mix(in srgb, var(--color-ifline) 15%, transparent)',
              }}
            >
              {/* Glow indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 left-0 w-px h-full"
                style={{
                  background: 'linear-gradient(180deg, var(--color-ifline) 0%, transparent 100%)',
                }}
              />
              <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between min-w-0 w-full">
                <span className="font-medium text-sm text-[var(--text-primary)]">协作面板</span>
                <Button
                  onClick={toggleCollaborationDrawer}
                  variant="ghost"
                  size="icon"
                >
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </Button>
              </div>
              <CollaborationPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

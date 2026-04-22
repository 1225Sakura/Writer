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
import { Aperture } from 'lucide-react'

const IMMERSIVE_HIDE_DELAY = 3000 // 3 seconds

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
      {/* Immersive mode vignette overlay */}
      <AnimatePresence>
        {immersiveMode && chromeVisible && (
          <motion.div
            key="vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 pointer-events-none z-30"
            style={{
              background: 'radial-gradient(ellipse 70% 60% at 50% 40%, transparent 30%, var(--ink-black) 100%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Immersive mode indicator */}
      <AnimatePresence>
        {immersiveMode && chromeVisible && (
          <motion.div
            key="immersive-indicator"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="fixed top-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: 'var(--accent-purple)',
              border: '1px solid var(--accent-purple)',
            }}
          >
            <Aperture className="w-3.5 h-3.5 text-[var(--accent-purple)]" />
            <span className="text-[11px] font-medium text-[var(--accent-purple)]">沉浸模式</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 工具栏 - Framer Motion AnimatePresence for smooth show/hide */}
      <AnimatePresence initial={false}>
        {(!immersiveMode || chromeVisible) && (
          <motion.div
            key="toolbar"
            initial={immersiveMode ? { opacity: 0, y: -12 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <WritingToolbar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
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

        {/* 大纲侧边栏 (280px, 可收起) */}
        <AnimatePresence initial={false}>
          {outlineDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="outline-sidebar"
              initial={{ width: 0, opacity: 0, x: -20 }}
              animate={{ width: 280, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="border-r border-[var(--color-border)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative"
              style={{
                boxShadow: '4px 0 24px rgba(91, 142, 232, 0.08)',
              }}
            >
              {/* Glow indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 right-0 w-px h-full"
                style={{
                  background: 'linear-gradient(180deg, var(--accent-purple) 0%, var(--accent-purple) 50%, transparent 100%)',
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
              animate={{ width: '100%', opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="drawer-responsive drawer-right border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative"
              style={{
                boxShadow: '-4px 0 24px var(--accent-purple)',
                maxWidth: '360px',
              }}
            >
              {/* Glow indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 left-0 w-px h-full"
                style={{
                  background: 'linear-gradient(180deg, var(--accent-purple) 0%, var(--accent-purple) 50%, transparent 100%)',
                }}
              />
              <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between min-w-0 w-full">
                <span className="font-medium text-sm text-[var(--color-text)]">写作操作</span>
                <Button
                  onClick={toggleAIDrawer}
                  variant="ghost"
                  size="icon"
                >
                  <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
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
              animate={{ width: 260, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="drawer-responsive drawer-right border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative"
              style={{
                boxShadow: '-4px 0 24px var(--color-ifline)',
              }}
            >
              {/* Glow indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 left-0 w-px h-full"
                style={{
                  background: 'linear-gradient(180deg, var(--color-ifline) 0%, var(--color-ifline) 50%, transparent 100%)',
                }}
              />
              <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between min-w-0 w-full">
                <span className="font-medium text-sm text-[var(--color-text)]">协作面板</span>
                <Button
                  onClick={toggleCollaborationDrawer}
                  variant="ghost"
                  size="icon"
                >
                  <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
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

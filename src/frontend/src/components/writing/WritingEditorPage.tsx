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
    <div className={`h-full flex flex-col bg-[#08090a] ${immersiveMode ? 'immersive-mode' : ''}`}>
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
              background: 'radial-gradient(ellipse 70% 60% at 50% 40%, transparent 30%, rgba(8, 9, 10, 0.4) 100%)',
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
              background: 'rgba(94, 106, 210, 0.15)',
              border: '1px solid rgba(94, 106, 210, 0.3)',
            }}
          >
            <Aperture className="w-3.5 h-3.5 text-[#5e6ad2]" />
            <span className="text-[11px] font-medium text-[#5e6ad2]">沉浸模式</span>
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
            <div className="h-full bg-[var(--color-writing-dark)] overflow-y-auto">
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
              className="border-r border-[rgba(255,255,255,0.08)] bg-[#191a1b] flex flex-col overflow-hidden relative"
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
                  background: 'linear-gradient(180deg, rgba(91, 142, 232, 0.5) 0%, rgba(91, 142, 232, 0.1) 50%, transparent 100%)',
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
              animate={{ width: 360, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="drawer-responsive drawer-right border-l border-[rgba(255,255,255,0.08)] bg-[#191a1b] flex flex-col overflow-hidden relative"
              style={{
                boxShadow: '-4px 0 24px rgba(94, 106, 210, 0.08)',
              }}
            >
              {/* Glow indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 left-0 w-px h-full"
                style={{
                  background: 'linear-gradient(180deg, rgba(94, 106, 210, 0.5) 0%, rgba(94, 106, 210, 0.1) 50%, transparent 100%)',
                }}
              />
              <div className="p-3 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between min-w-[360px] tablet:min-w-[320px] desktop:min-w-[360px]">
                <span className="font-medium text-sm text-[#f7f8f8]">写作操作</span>
                <Button
                  onClick={toggleAIDrawer}
                  variant="ghost"
                  size="icon"
                >
                  <X className="w-4 h-4 text-[#d0d6e0]" />
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
              className="drawer-responsive drawer-right border-l border-[rgba(255,255,255,0.08)] bg-[#191a1b] flex flex-col overflow-hidden relative"
              style={{
                boxShadow: '-4px 0 24px rgba(126, 184, 74, 0.08)',
              }}
            >
              {/* Glow indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 left-0 w-px h-full"
                style={{
                  background: 'linear-gradient(180deg, rgba(126, 184, 74, 0.5) 0%, rgba(126, 184, 74, 0.1) 50%, transparent 100%)',
                }}
              />
              <div className="p-3 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between min-w-[240px] tablet:min-w-[260px] desktop:min-w-[280px]">
                <span className="font-medium text-sm text-[#f7f8f8]">协作面板</span>
                <Button
                  onClick={toggleCollaborationDrawer}
                  variant="ghost"
                  size="icon"
                >
                  <X className="w-4 h-4 text-[#d0d6e0]" />
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

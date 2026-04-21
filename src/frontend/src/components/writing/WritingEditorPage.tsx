import { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore, useWritingStore } from '@/store'
import { WritingToolbar } from './WritingToolbar'
import { WritingCanvas } from './WritingCanvas'
import { AIOperationDrawer } from './AIOperationDrawer'
import { CollaborationPanel } from './CollaborationPanel'
import { Button } from '@/components/ui/Button'
import { X } from 'lucide-react'

const IMMERSIVE_HIDE_DELAY = 3000 // 3 seconds

export function WritingEditorPage() {
  const {
    aiDrawerOpen,
    collaborationDrawerOpen,
    toggleAIDrawer,
    toggleCollaborationDrawer,
    immersiveMode,
    setImmersiveMode
  } = useUIStore()
  const { init } = useWritingStore()

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

    const handleMouseMove = (e: MouseEvent) => {
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

  // Transition classes for smooth animations
  const toolbarTransition = immersiveMode
    ? 'transition-all duration-300 ease-out'
    : ''
  const toolbarOpacity = immersiveMode
    ? (chromeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none')
    : ''

  return (
    <div className="h-full flex flex-col bg-[#08090a]">
      {/* 工具栏 - hides in immersive mode */}
      <div className={`${toolbarTransition} ${toolbarOpacity}`}>
        <WritingToolbar />
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 写作区域 */}
        <div className="flex-1 overflow-hidden relative">
          <WritingCanvas />
        </div>

        {/* AI操作抽屉 - 右侧 280px - slides in immersive mode */}
        {aiDrawerOpen && (
          <div
            className={`border-l border-[rgba(255,255,255,0.08)] bg-[#191a1b] flex flex-col transition-all duration-300 ${
              immersiveMode
                ? chromeVisible
                  ? 'w-[280px] opacity-100'
                  : 'w-0 opacity-0 overflow-hidden'
                : 'w-[280px]'
            }`}
          >
            <div className="p-3 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between min-w-[280px]">
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
          </div>
        )}

        {/* 协作面板 - 右侧 260px - slides in immersive mode */}
        {collaborationDrawerOpen && (
          <div
            className={`border-l border-[rgba(255,255,255,0.08)] bg-[#191a1b] flex flex-col transition-all duration-300 ${
              immersiveMode
                ? chromeVisible
                  ? 'w-[260px] opacity-100'
                  : 'w-0 opacity-0 overflow-hidden'
                : 'w-[260px]'
            }`}
          >
            <div className="p-3 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between min-w-[260px]">
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
          </div>
        )}
      </div>
    </div>
  )
}

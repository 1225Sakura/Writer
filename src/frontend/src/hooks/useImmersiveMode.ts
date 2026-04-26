import { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore } from '@/store'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

const IMMERSIVE_HIDE_DELAY = 4000

export interface UseImmersiveModeOptions {
  hideDelay?: number
}

export function useImmersiveMode(options: UseImmersiveModeOptions = {}) {
  const { hideDelay = IMMERSIVE_HIDE_DELAY } = options
  const prefersReducedMotion = usePrefersReducedMotion()

  const {
    immersiveMode,
    setImmersiveMode,
    aiDrawerOpen,
    collaborationDrawerOpen,
    outlineDrawerOpen,
    toggleAIDrawer,
    toggleCollaborationDrawer,
    toggleOutlineDrawer,
  } = useUIStore()

  const [chromeVisible, setChromeVisible] = useState(true)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingRef = useRef<number>(Date.now())
  const isTypingRef = useRef(false)

  const scheduleHideChrome = useCallback(() => {
    if (!immersiveMode) return

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    const timeSinceLastTyping = Date.now() - lastTypingRef.current
    if (timeSinceLastTyping > 1000) {
      hideTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current || timeSinceLastTyping < 1000) return
        setChromeVisible(false)
      }, hideDelay)
    }
  }, [immersiveMode, hideDelay])

  const showChrome = useCallback(() => {
    setChromeVisible(true)
    lastTypingRef.current = Date.now()
    isTypingRef.current = false
    scheduleHideChrome()
  }, [scheduleHideChrome])

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

  // Track typing events
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

    document.addEventListener('immersive-typing-start', handleTypingStart)
    document.addEventListener('immersive-typing-stop', handleTypingStop)

    return () => {
      document.removeEventListener('immersive-typing-start', handleTypingStart)
      document.removeEventListener('immersive-typing-stop', handleTypingStop)
    }
  }, [scheduleHideChrome])

  // Mouse move and keyboard handlers
  useEffect(() => {
    if (!immersiveMode) return

    const handleMouseMove = () => {
      if (!chromeVisible) {
        showChrome()
      }
      lastTypingRef.current = Date.now()
      isTypingRef.current = false
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!immersiveMode) return

      if (e.key === 'Escape') {
        showChrome()
        if (immersiveMode) {
          setImmersiveMode(false)
        }
      }

      lastTypingRef.current = Date.now()
      isTypingRef.current = false
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('keydown', handleKeyDown)

    if (immersiveMode && chromeVisible) {
      scheduleHideChrome()
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('keydown', handleKeyDown)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [immersiveMode, chromeVisible, showChrome, scheduleHideChrome, setImmersiveMode])

  return {
    immersiveMode,
    chromeVisible,
    showChrome,
    prefersReducedMotion,
  }
}

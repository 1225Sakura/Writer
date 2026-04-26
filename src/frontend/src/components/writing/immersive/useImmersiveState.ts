import { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore } from '@/store'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const IMMERSIVE_HIDE_DELAY = 4000
const TYPING_THRESHOLD_MS = 1000

export interface UseImmersiveStateReturn {
  immersiveMode: boolean
  chromeVisible: boolean
  showChrome: () => void
  setImmersiveMode: (value: boolean) => void
  toggleImmersiveMode: () => void
  prefersReducedMotion: boolean
  lastTriggerElementRef: React.MutableRefObject<HTMLElement | null>
}

export function useImmersiveState(): UseImmersiveStateReturn {
  const prefersReducedMotion = usePrefersReducedMotion()

  const {
    immersiveMode,
    setImmersiveMode,
  } = useUIStore()

  const [chromeVisible, setChromeVisible] = useState(true)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingRef = useRef<number>(Date.now())
  const isTypingRef = useRef(false)

  // Track the element that triggered immersive mode for focus restoration
  const lastTriggerElementRef = useRef<HTMLElement | null>(null)

  const scheduleHideChrome = useCallback(() => {
    if (!immersiveMode) return

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    const timeSinceLastTyping = Date.now() - lastTypingRef.current
    if (timeSinceLastTyping > TYPING_THRESHOLD_MS) {
      hideTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current || timeSinceLastTyping < TYPING_THRESHOLD_MS) return
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

  // Mouse move and keyboard handlers with keyboard trap fix
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
        // Restore focus to the trigger element before exiting immersive mode
        if (lastTriggerElementRef.current && typeof lastTriggerElementRef.current.focus === 'function') {
          // Use setTimeout to ensure focus happens after the escape key is fully processed
          setTimeout(() => {
            lastTriggerElementRef.current?.focus()
            lastTriggerElementRef.current = null
          }, 0)
        }
        showChrome()
        setImmersiveMode(false)
        return
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

  const toggleImmersiveMode = useCallback(() => {
    // Store current focused element as trigger
    if (!immersiveMode) {
      lastTriggerElementRef.current = document.activeElement as HTMLElement
    }
    setImmersiveMode(!immersiveMode)
  }, [immersiveMode, setImmersiveMode])

  return {
    immersiveMode,
    chromeVisible,
    showChrome,
    setImmersiveMode,
    toggleImmersiveMode,
    prefersReducedMotion,
    lastTriggerElementRef,
  }
}

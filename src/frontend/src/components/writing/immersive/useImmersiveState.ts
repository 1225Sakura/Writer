import { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore } from '@/store'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const IMMERSIVE_HIDE_DELAY = 4000
const TYPING_THRESHOLD_MS = 1000

export type WritingMode = 'writing' | 'collaboration'

export interface UseImmersiveStateReturn {
  immersiveMode: boolean
  chromeVisible: boolean
  showChrome: () => void
  setImmersiveMode: (value: boolean) => void
  toggleImmersiveMode: () => void
  prefersReducedMotion: boolean
  lastTriggerElementRef: React.MutableRefObject<HTMLElement | null>
  writingMode: WritingMode
  toggleWritingMode: () => void
  isDistractionFree: boolean
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

  // Writing mode: 'writing' (distraction-free) or 'collaboration' (full UI)
  const [writingMode, setWritingMode] = useState<WritingMode>('collaboration')

  const isDistractionFree = writingMode === 'writing' || immersiveMode

  const toggleWritingMode = useCallback(() => {
    setWritingMode(prev => prev === 'writing' ? 'collaboration' : 'writing')
  }, [])

  const scheduleHideChrome = useCallback(() => {
    if (!immersiveMode || writingMode === 'writing') return

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
  }, [immersiveMode, writingMode])

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
      // In writing mode, never show chrome on mouse move
      if (writingMode === 'writing') return
      if (!chromeVisible) {
        showChrome()
      }
      lastTypingRef.current = Date.now()
      isTypingRef.current = false
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!immersiveMode) return

      if (e.key === 'Escape') {
        // In writing mode: first Escape switches to collaboration mode
        if (writingMode === 'writing') {
          setWritingMode('collaboration')
          showChrome()
          return
        }
        // In collaboration mode + immersive: exit immersive
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
  }, [immersiveMode, chromeVisible, showChrome, scheduleHideChrome, setImmersiveMode, writingMode])

  // Ctrl+. global handler for toggleWritingMode
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault()
        toggleWritingMode()
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [toggleWritingMode])

  // When writingMode === 'writing': force chromeVisible = false
  useEffect(() => {
    if (writingMode === 'writing') {
      setChromeVisible(false)
    }
  }, [writingMode])

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
    writingMode,
    toggleWritingMode,
    isDistractionFree,
  }
}

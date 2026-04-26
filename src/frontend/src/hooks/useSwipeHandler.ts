import { useEffect, useRef, useState } from 'react'

const SWIPE_THRESHOLD = 50

export interface UseSwipeHandlerOptions {
  enabled?: boolean
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
}

export function useSwipeHandler(options: UseSwipeHandlerOptions = {}) {
  const {
    enabled = true,
    onSwipeLeft,
    onSwipeRight,
    threshold = SWIPE_THRESHOLD,
  } = options

  const touchStartX = useRef<number>(0)
  const touchEndX = useRef<number>(0)
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  const [swipeHintDismissed, setSwipeHintDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('writer-swipe-hint-dismissed') === '1'
    }
    return false
  })

  const dismissSwipeHint = () => {
    setShowSwipeHint(false)
    setSwipeHintDismissed(true)
    localStorage.setItem('writer-swipe-hint-dismissed', '1')
  }

  // Show swipe hint on mobile after a delay
  useEffect(() => {
    if (swipeHintDismissed || window.innerWidth > 768 || !enabled) return
    const timer = setTimeout(() => setShowSwipeHint(true), 2000)
    return () => clearTimeout(timer)
  }, [swipeHintDismissed, enabled])

  // Mobile swipe gesture handler
  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.changedTouches[0].screenX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX.current = e.changedTouches[0].screenX
      const diff = touchEndX.current - touchStartX.current
      const absDiff = Math.abs(diff)

      if (window.innerWidth > 768) return
      if (absDiff < threshold) return

      if (diff > 0 && onSwipeRight) {
        onSwipeRight()
      } else if (diff < 0 && onSwipeLeft) {
        onSwipeLeft()
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, threshold, onSwipeLeft, onSwipeRight])

  return {
    showSwipeHint,
    swipeHintDismissed,
    dismissSwipeHint,
  }
}

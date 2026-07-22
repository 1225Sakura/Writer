/**
 * useContainerSize — observe an element's dimensions via ResizeObserver.
 *
 * Returns `{width, height}` (zero until first measurement). Handles a
 * synchronous initial seed so the first render is not 0×0.
 *
 * v0.5 Phase 3 Track E.5: extracted from CorkboardView to keep the
 * main component under the 300-line per-file budget (AC-1).
 */
import { useEffect, useRef, useState } from 'react'

export interface ContainerSize {
  width: number
  height: number
}

export function useContainerSize<T extends HTMLElement>(): {
  ref: React.MutableRefObject<T | null>
  size: ContainerSize
} {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof ResizeObserver === 'undefined') {
      // jsdom + environments without ResizeObserver: best-effort sync seed.
      const rect = el.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
      return
    }
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(el)
    // Sync seed so first paint has correct dimensions.
    const rect = el.getBoundingClientRect()
    setSize({ width: rect.width, height: rect.height })
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}

/**
 * useChatAutoAdvance — US-004 / Phase 0 commit 4 hook.
 *
 * Listens to `chatStore.turnCount` and auto-advances the UI from the chat
 * interface to the settings editor once the user has sent enough messages
 * (default: 3 turns).
 *
 * Design notes
 *   - The store only mutates `turnCount`; this hook owns the side effect of
 *     flipping `currentInterface`. Splitting the two keeps `chatStore.ts`
 *     a pure state container (easier to test) and makes the threshold
 *     swappable from a single call site.
 *   - The hook fires at most **once per threshold-crossing session**. A ref
 *     guard (`hasAdvancedRef`) ensures we do not replay `setCurrentInterface`
 *     on every subsequent sendMessage after the threshold was crossed. The
 *     guard resets only when `turnCount` returns to 0 (e.g. a new session
 *     via `createSession`).
 *   - Manual navigation away from chat (e.g. Ctrl+Alt+2 → settings) does not
 *     retrigger — once `hasAdvancedRef.current` is true, the hook stays
 *     silent until turnCount resets.
 *
 * @param threshold - number of turns before auto-advance. Defaults to 3 per
 *   plan AC-P0-4.1. Tests override it to exercise edge conditions cheaply.
 */

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useUIStore } from '@/store/uiStore'

export const AUTO_ADVANCE_THRESHOLD = 3

export function useChatAutoAdvance(threshold: number = AUTO_ADVANCE_THRESHOLD) {
  const turnCount = useChatStore((s) => s.turnCount)
  const setCurrentInterface = useUIStore((s) => s.setCurrentInterface)
  // Guard against re-firing on subsequent sendMessage calls after the
  // threshold was already crossed. Without this, sendMessage #4 would call
  // setCurrentInterface('settings') a second time even though we are
  // already there.
  const hasAdvancedRef = useRef(false)

  useEffect(() => {
    // A fresh session resets the counter (chatStore.ts:269 createSession
    // wipes messages / extractedEntities; turnCount is reset together).
    // Mirror that behavior so a new chat session can auto-advance again.
    if (turnCount === 0) {
      hasAdvancedRef.current = false
      return
    }

    if (turnCount >= threshold && !hasAdvancedRef.current) {
      hasAdvancedRef.current = true
      setCurrentInterface('settings')
    }
  }, [turnCount, threshold, setCurrentInterface])
}

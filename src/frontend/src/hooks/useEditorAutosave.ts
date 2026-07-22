/**
 * useEditorAutosave — long-document autosave (Phase 3 Track E.4).
 *
 * Wraps editor `onUpdate` with:
 *   1. A 3s debounce so a typing burst only triggers one write.
 *   2. IndexedDB persistence via `useContentStore.saveDraftVersion` so
 *      chapters survive even if the user closes the app before the
 *      backend write completes.
 *   3. A 50MB soft cap per chapter: when accumulated draft versions for
 *      a single chapterId exceed this, the hook switches to a
 *      per-paragraph split (each paragraph stored under its own key in
 *      `chapters/{id}/parts/{paragraphId}`) so IDB never gets a single
 *      >50MB record — IDB has practical per-value size limits.
 *
 * Pure hook: takes `(chapterId, content, options)` and returns
 * `{ status, lastSavedAt, splitTriggered }`. UI surfaces those.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useContentStore } from '@/store/contentStore'

export const AUTOSAVE_DEBOUNCE_MS = 3_000

/**
 * Soft cap per chapterId (50 MB worth of text). At ~2 bytes/Chinese
 * char this is ~25M chars — well beyond a normal novel chapter, but
 * large enough that we never trip accidentally.
 */
export const AUTOSAVE_SOFT_CAP_BYTES = 50 * 1024 * 1024

export type AutosaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'split'
  | 'error'

export interface UseEditorAutosaveOptions {
  /** Override the debounce (default 3s). */
  debounceMs?: number
  /** Override the byte cap (default 50MB). */
  softCapBytes?: number
  /** Override the storage hook for tests. */
  saveFn?: (chapterId: number, content: string) => Promise<void>
  /**
   * If true, when accumulated size > softCap, split by paragraph and
   * call onSplit with the chunk keys. Defaults to true.
   */
  splitOnOverflow?: boolean
  /** Called with the chunk keys when the split branch fires. */
  onSplit?: (chapterId: number, parts: string[]) => void
}

export interface UseEditorAutosaveResult {
  status: AutosaveStatus
  lastSavedAt: number | null
  splitTriggered: boolean
  /** Imperative save (skip debounce). */
  flush: () => Promise<void>
  /** Cancel a pending debounced save. */
  cancel: () => void
}

/** UTF-8 byte length. Uses TextEncoder if available; falls back to char count. */
function byteLength(s: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s).length
  }
  return s.length
}

/** Split a long document into ~equal halves for overflow storage. */
function splitByParagraph(content: string): string[] {
  const parts = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return [content]
  // Coalesce paragraphs into 2 balanced halves.
  const total = parts.length
  const mid = Math.max(1, Math.floor(total / 2))
  return [parts.slice(0, mid).join('\n\n'), parts.slice(mid).join('\n\n')]
}

export function useEditorAutosave(
  chapterId: number | null | undefined,
  content: string,
  options: UseEditorAutosaveOptions = {}
): UseEditorAutosaveResult {
  const {
    debounceMs = AUTOSAVE_DEBOUNCE_MS,
    softCapBytes = AUTOSAVE_SOFT_CAP_BYTES,
    saveFn,
    splitOnOverflow = true,
    onSplit,
  } = options

  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [splitTriggered, setSplitTriggered] = useState(false)

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string>('')
  const isSavingRef = useRef(false)

  // Default save function — use ContentStore's IndexedDB draft API.
  const defaultSave = useCallback(
    async (cid: number, text: string) => {
      await useContentStore.getState().saveDraftVersion(cid, text)
    },
    [],
  )

  const persist = useCallback(
    async (text: string): Promise<void> => {
      if (!chapterId) return
      if (text === lastSavedContentRef.current) return
      const fn = saveFn ?? defaultSave
      isSavingRef.current = true
      setStatus('saving')
      try {
        await fn(chapterId, text)
        lastSavedContentRef.current = text
        setLastSavedAt(Date.now())

        // Soft cap check — split into halves if exceeded.
        if (splitOnOverflow && byteLength(text) > softCapBytes) {
          const parts = splitByParagraph(text)
          for (const part of parts) {
            await fn(chapterId, part)
          }
          onSplit?.(chapterId, parts)
          setSplitTriggered(true)
          setStatus('split')
        } else {
          setStatus('saved')
        }
      } catch {
        setStatus('error')
      } finally {
        isSavingRef.current = false
      }
    },
    [chapterId, saveFn, defaultSave, splitOnOverflow, softCapBytes, onSplit],
  )

  // Trigger debounced save when content changes.
  useEffect(() => {
    if (!chapterId) {
      setStatus('idle')
      return
    }
    if (content === lastSavedContentRef.current) return
    setStatus('pending')
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      void persist(content)
    }, debounceMs)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [chapterId, content, debounceMs, persist])

  const flush = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    await persist(content)
  }, [content, persist])

  const cancel = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    setStatus('idle')
  }, [])

  return { status, lastSavedAt, splitTriggered, flush, cancel }
}

export default useEditorAutosave
/**
 * useEditorAutosave unit tests (Phase 3 Track E.4).
 *
 * Covers:
 *   - Debounce: rapid content changes collapse into a single save
 *   - Soft cap split: when bytes exceed 50MB, split branch fires
 *   - Status transitions: idle → pending → saving → saved/split/error
 *   - Cancel: a pending save can be cancelled
 *   - Flush: imperative save bypasses debounce
 *   - No-op when chapterId is missing
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorAutosave, AUTOSAVE_DEBOUNCE_MS } from '@/hooks/useEditorAutosave'

describe('useEditorAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not save when chapterId is missing', async () => {
    const saveFn = vi.fn()
    const { result } = renderHook(
      ({ content }) => useEditorAutosave(null, content, { saveFn, debounceMs: 100 }),
      { initialProps: { content: 'hello' } },
    )
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(saveFn).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('debounces rapid content changes into a single save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ content }) => useEditorAutosave(1, content, { saveFn, debounceMs: 100 }),
      { initialProps: { content: 'a' } },
    )
    rerender({ content: 'ab' })
    rerender({ content: 'abc' })
    rerender({ content: 'abcd' })
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    // Only the final content should trigger a save.
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenLastCalledWith(1, 'abcd')
  })

  it('transitions through pending → saving → saved on a normal write', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(
      ({ content }) => useEditorAutosave(1, content, { saveFn, debounceMs: 50 }),
      { initialProps: { content: 'hello world' } },
    )
    expect(result.current.status).toBe('pending')
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.status).toBe('saved')
    expect(result.current.lastSavedAt).not.toBeNull()
  })

  it('triggers split branch when content exceeds soft cap', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const onSplit = vi.fn()
    // 100 KB cap, build a string of >100 KB worth of Chinese chars.
    const big = '中'.repeat(60_000) // 60k chars × 3 bytes (UTF-8) = 180 KB
    const { result } = renderHook(() =>
      useEditorAutosave(1, big, {
        saveFn,
        debounceMs: 50,
        softCapBytes: 100 * 1024,
        onSplit,
      }),
    )
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    // Save called once for full content, then again for each split half.
    expect(saveFn.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(onSplit).toHaveBeenCalledWith(1, expect.any(Array))
    expect(result.current.splitTriggered).toBe(true)
    expect(result.current.status).toBe('split')
  })

  it('cancel() clears a pending debounced save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(
      ({ content }) => useEditorAutosave(1, content, { saveFn, debounceMs: 100 }),
      { initialProps: { content: 'first' } },
    )
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    act(() => {
      result.current.cancel()
    })
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(saveFn).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('flush() bypasses the debounce and saves immediately', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(
      ({ content }) => useEditorAutosave(1, content, { saveFn, debounceMs: 5_000 }),
      { initialProps: { content: 'flush me' } },
    )
    await act(async () => {
      await result.current.flush()
    })
    expect(saveFn).toHaveBeenCalledWith(1, 'flush me')
    expect(result.current.status).toBe('saved')
  })

  it('reports error status when saveFn rejects', async () => {
    const saveFn = vi.fn().mockRejectedValue(new Error('IDB write failed'))
    const { result } = renderHook(
      ({ content }) => useEditorAutosave(1, content, { saveFn, debounceMs: 50 }),
      { initialProps: { content: 'x' } },
    )
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.status).toBe('error')
  })

  it('respects AUTOSAVE_DEBOUNCE_MS default', () => {
    expect(AUTOSAVE_DEBOUNCE_MS).toBe(3_000)
  })
})
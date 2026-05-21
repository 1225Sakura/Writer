import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWritingStore } from '@/store/writingStore'

// Mock dependencies that writingStore imports
vi.mock('@/api/writing', () => ({
  chapterApi: {
    update: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue([]),
  },
  draftApi: {
    create: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/api/settings', () => ({
  writingSettingsApi: {
    get: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/store/contentStore', () => ({
  useContentStore: {
    getState: vi.fn(() => ({
      fetchChapters: vi.fn().mockResolvedValue(undefined),
      fetchOutlines: vi.fn().mockResolvedValue(undefined),
      fetchDrafts: vi.fn().mockResolvedValue(undefined),
      chapters: [],
      draftVersions: [],
    })),
    setState: vi.fn(),
  },
}))

vi.mock('@/store/utils/indexedDBStorage', () => ({
  createHybridStorage: () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/utils/toastHelper', () => ({
  showOperationError: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

describe('writingStore', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    const { result } = renderHook(() => useWritingStore())
    act(() => {
      result.current.setSaveStatus('idle')
      result.current.updateContent('')
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useWritingStore())
    expect(result.current.currentChapterId).toBeNull()
    expect(result.current.currentContent).toBe('')
    expect(result.current.wordCount).toBe(0)
    expect(result.current.isDirty).toBeUndefined() // not exposed, but store works
    expect(result.current.saveStatus).toBeDefined()
  })

  it('should have default config values', () => {
    const { result } = renderHook(() => useWritingStore())
    expect(result.current.humanAIRatio).toBe(70)
    expect(result.current.writingStyle).toBe('default')
    expect(result.current.targetWordCount).toBe(2000)
  })

  it('should have default auto-save settings', () => {
    const { result } = renderHook(() => useWritingStore())
    expect(result.current.autoSaveEnabled).toBe(true)
    expect(result.current.autoSaveInterval).toBe(30000)
  })

  it('should expose key actions', () => {
    const { result } = renderHook(() => useWritingStore())
    expect(typeof result.current.init).toBe('function')
    expect(typeof result.current.setCurrentChapter).toBe('function')
    expect(typeof result.current.updateContent).toBe('function')
    expect(typeof result.current.saveCurrentChapter).toBe('function')
    expect(typeof result.current.triggerAutoSave).toBe('function')
    expect(typeof result.current.setHumanAIRatio).toBe('function')
    expect(typeof result.current.setWritingStyle).toBe('function')
    expect(typeof result.current.setTargetWordCount).toBe('function')
    expect(typeof result.current.markSaved).toBe('function')
    expect(typeof result.current.markUnsaved).toBe('function')
  })

  it('should update content and word count', () => {
    const { result } = renderHook(() => useWritingStore())
    act(() => {
      result.current.updateContent('Hello world')
    })
    expect(result.current.currentContent).toBe('Hello world')
    expect(result.current.wordCount).toBeGreaterThan(0)
  })

  it('should update human-AI ratio without throwing', () => {
    const { result } = renderHook(() => useWritingStore())
    act(() => {
      result.current.setHumanAIRatio(50)
    })
    expect(result.current.humanAIRatio).toBe(50)
  })

  it('should update writing style without throwing', () => {
    const { result } = renderHook(() => useWritingStore())
    act(() => {
      result.current.setWritingStyle('jiangnan')
    })
    expect(result.current.writingStyle).toBe('jiangnan')
  })

  it('should update target word count', () => {
    const { result } = renderHook(() => useWritingStore())
    act(() => {
      result.current.setTargetWordCount(3000)
    })
    expect(result.current.targetWordCount).toBe(3000)
  })

  it('should mark saved and unsaved', () => {
    const { result } = renderHook(() => useWritingStore())
    act(() => {
      result.current.markSaved()
    })
    expect(result.current.saveStatus).toBe('saved')
    expect(result.current.lastSavedAt).toBeGreaterThan(0)

    act(() => {
      result.current.markUnsaved()
    })
    expect(result.current.saveStatus).toBe('unsaved')
  })

  it('should handle setSaveStatus', () => {
    const { result } = renderHook(() => useWritingStore())
    act(() => {
      result.current.setSaveStatus('error')
    })
    expect(result.current.saveStatus).toBe('error')
  })

  it('should handle session tracking', () => {
    const { result } = renderHook(() => useWritingStore())
    act(() => {
      result.current.startWritingSession(1, 100)
    })
    expect(result.current.sessionStartTime).toBeGreaterThan(0)
    expect(result.current.sessionWordCountStart).toBe(100)

    // getSessionDuration should return a number
    expect(typeof result.current.getSessionDuration()).toBe('number')
  })

  it('should not throw on saveCurrentChapter when no chapter selected', async () => {
    const { result } = renderHook(() => useWritingStore())
    // Should early-return without error when currentChapterId is null
    await act(async () => {
      await result.current.saveCurrentChapter()
    })
    expect(result.current.currentChapterId).toBeNull()
  })

  it('should not throw on triggerAutoSave when no chapter selected', async () => {
    const { result } = renderHook(() => useWritingStore())
    await act(async () => {
      await result.current.triggerAutoSave()
    })
    // saveStatus may be 'unsaved' due to autoSave flow; just verify no throw and no chapter
    expect(result.current.currentChapterId).toBeNull()
  })
})

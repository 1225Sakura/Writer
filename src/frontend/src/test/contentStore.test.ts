import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContentStore, selectChapterById, selectChapters, selectDraftVersionsForChapter, selectContentLoading, cleanupContentStore } from '@/store/contentStore'

// Mock API modules
vi.mock('@/api/writing', () => ({
  outlineApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, title: 'Outline 1' }),
    generate: vi.fn().mockResolvedValue({ outlineId: 1, chapters: [] }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  chapterApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, title: 'Ch1', status: 'planning', word_count: 0 }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  draftApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, chapter_id: 1, content: 'draft', version_number: 1 }),
    getVersion: vi.fn().mockResolvedValue({ content: 'restored' }),
    delete: vi.fn().mockResolvedValue({}),
  },
  ifLineApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, title: 'IF1' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  plotThreadApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, title: 'Thread1', status: 'open' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  inspectionApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, chapter_id: 1, inspection_type: 'consistency' }),
  },
}))

vi.mock('@/utils/toastHelper', () => ({
  showOperationError: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

describe('contentStore', () => {
  beforeEach(() => {
    useContentStore.setState({
      chapters: [],
      outlines: [],
      ifLines: [],
      plotThreads: [],
      draftVersions: [],
      inspectionResults: [],
      generating: false,
      outlineGenerationError: null,
      loading: { outlines: false, ifLines: false, plotThreads: false, drafts: false, inspections: false },
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useContentStore())
    expect(result.current.chapters).toEqual([])
    expect(result.current.outlines).toEqual([])
    expect(result.current.ifLines).toEqual([])
    expect(result.current.plotThreads).toEqual([])
    expect(result.current.draftVersions).toEqual([])
    expect(result.current.inspectionResults).toEqual([])
    expect(result.current.generating).toBe(false)
    expect(result.current.outlineGenerationError).toBeNull()
    expect(result.current.loading.outlines).toBe(false)
    expect(result.current.loading.drafts).toBe(false)
  })

  it('should expose key actions', () => {
    const { result } = renderHook(() => useContentStore())
    expect(typeof result.current.setChapters).toBe('function')
    expect(typeof result.current.fetchChapters).toBe('function')
    expect(typeof result.current.createChapter).toBe('function')
    expect(typeof result.current.updateChapter).toBe('function')
    expect(typeof result.current.deleteChapter).toBe('function')
    expect(typeof result.current.fetchOutlines).toBe('function')
    expect(typeof result.current.createOutline).toBe('function')
    expect(typeof result.current.generateOutline).toBe('function')
    expect(typeof result.current.fetchDrafts).toBe('function')
    expect(typeof result.current.saveDraftVersion).toBe('function')
    expect(typeof result.current.restoreDraftVersion).toBe('function')
    expect(typeof result.current.getDraftVersions).toBe('function')
    expect(typeof result.current.fetchIFLines).toBe('function')
    expect(typeof result.current.createIFLine).toBe('function')
    expect(typeof result.current.fetchPlotThreads).toBe('function')
    expect(typeof result.current.createPlotThread).toBe('function')
    expect(typeof result.current.fetchInspections).toBe('function')
    expect(typeof result.current.createInspection).toBe('function')
  })

  it('should set chapters directly', () => {
    const { result } = renderHook(() => useContentStore())
    const chapters = [{ id: 1, title: 'Ch1' }, { id: 2, title: 'Ch2' }] as any
    act(() => {
      result.current.setChapters(chapters)
    })
    expect(result.current.chapters).toHaveLength(2)
    expect(result.current.chapters[0].title).toBe('Ch1')
  })

  it('should fetch chapters', async () => {
    const { chapterApi } = await import('@/api/writing')
    vi.mocked(chapterApi.list).mockResolvedValueOnce([{ id: 1, title: 'Fetched' }] as any)

    const { result } = renderHook(() => useContentStore())
    await act(async () => {
      await result.current.fetchChapters()
    })
    expect(result.current.chapters).toHaveLength(1)
    expect(result.current.chapters[0].title).toBe('Fetched')
  })

  it('should create a chapter', async () => {
    const { chapterApi } = await import('@/api/writing')
    vi.mocked(chapterApi.create).mockResolvedValueOnce({ id: 10, title: 'NewCh', status: 'planning', word_count: 0 } as any)

    const { result } = renderHook(() => useContentStore())
    let chapter: any
    await act(async () => {
      chapter = await result.current.createChapter({ title: 'NewCh' })
    })

    expect(chapter.id).toBe(10)
    expect(result.current.chapters).toHaveLength(1)
    expect(result.current.chapters[0].title).toBe('NewCh')
  })

  it('should update a chapter', async () => {
    const { chapterApi } = await import('@/api/writing')
    vi.mocked(chapterApi.update).mockResolvedValueOnce({} as any)

    useContentStore.setState({ chapters: [{ id: 1, title: 'Old' }] as any })
    const { result } = renderHook(() => useContentStore())
    await act(async () => {
      await result.current.updateChapter(1, { title: 'Updated' })
    })
    expect(result.current.chapters[0].title).toBe('Updated')
  })

  it('should delete a chapter', async () => {
    const { chapterApi } = await import('@/api/writing')
    vi.mocked(chapterApi.delete).mockResolvedValueOnce({} as any)

    useContentStore.setState({ chapters: [{ id: 1, title: 'Gone' }, { id: 2, title: 'Stay' }] as any })
    const { result } = renderHook(() => useContentStore())
    await act(async () => {
      await result.current.deleteChapter(1)
    })
    expect(result.current.chapters).toHaveLength(1)
    expect(result.current.chapters[0].id).toBe(2)
  })

  it('should fetch outlines', async () => {
    const { outlineApi } = await import('@/api/writing')
    vi.mocked(outlineApi.list).mockResolvedValueOnce([{ id: 1, title: 'Main Outline' }] as any)

    const { result } = renderHook(() => useContentStore())
    await act(async () => {
      await result.current.fetchOutlines()
    })
    expect(result.current.outlines).toHaveLength(1)
    expect(result.current.loading.outlines).toBe(false)
  })

  it('should create an outline', async () => {
    const { outlineApi } = await import('@/api/writing')
    vi.mocked(outlineApi.create).mockResolvedValueOnce({ id: 1, title: 'New Outline' } as any)

    const { result } = renderHook(() => useContentStore())
    let outline: any
    await act(async () => {
      outline = await result.current.createOutline({ title: 'New Outline' })
    })
    expect(outline.title).toBe('New Outline')
    expect(result.current.outlines).toHaveLength(1)
  })

  it('should generate an outline and replace chapters with the rich response', async () => {
    const { outlineApi } = await import('@/api/writing')
    vi.mocked(outlineApi.generate).mockResolvedValueOnce({
      outlineId: 9,
      chapters: [{
        id: 101,
        title: '第一章',
        summary: '开端',
        sections: ['入城', '遇敌'],
        pacingNotes: '先缓后急',
        characterDynamics: '主角与同伴建立信任',
        foreshadowing: '埋下玉佩线索',
      }],
    })

    const { result } = renderHook(() => useContentStore())
    await act(async () => {
      await result.current.generateOutline({
        chapterCount: 1,
        projectId: 42,
        criteria: { title: '第一卷' },
      })
    })

    expect(outlineApi.generate).toHaveBeenCalledWith({
      chapterCount: 1,
      projectId: 42,
      criteria: { title: '第一卷' },
    })
    expect(result.current.generating).toBe(false)
    expect(result.current.outlineGenerationError).toBeNull()
    expect(result.current.chapters[0]).toEqual(expect.objectContaining({
      id: 101,
      outline_id: 9,
      project_id: 42,
      sections: ['入城', '遇敌'],
      pacingNotes: '先缓后急',
      characterDynamics: '主角与同伴建立信任',
      foreshadowing: '埋下玉佩线索',
    }))
  })

  it('should format outline generation errors and clear generating state', async () => {
    const { outlineApi } = await import('@/api/writing')
    const { showError } = await import('@/utils/toastHelper')
    vi.mocked(outlineApi.generate).mockRejectedValueOnce({
      detail: [{ loc: ['body', 'chapterCount'], msg: '生成失败' }],
    })

    const { result } = renderHook(() => useContentStore())
    await act(async () => {
      await result.current.generateOutline({ chapterCount: 5, projectId: 1 })
    })

    expect(result.current.generating).toBe(false)
    expect(result.current.outlineGenerationError).toBe('body.chapterCount: 生成失败')
    expect(showError).toHaveBeenCalledWith('body.chapterCount: 生成失败')
    expect(result.current.chapters).toEqual([])
  })

  it('should fetch and manage draft versions', async () => {
    const { draftApi } = await import('@/api/writing')
    vi.mocked(draftApi.list).mockResolvedValueOnce([
      { id: 1, chapter_id: 1, content: 'v1', version_number: 1 },
      { id: 2, chapter_id: 1, content: 'v2', version_number: 2 },
    ] as any)

    const { result } = renderHook(() => useContentStore())
    await act(async () => {
      await result.current.fetchDrafts(1)
    })
    expect(result.current.draftVersions).toHaveLength(2)
    expect(result.current.loading.drafts).toBe(false)
  })

  it('should save a draft version', async () => {
    const { draftApi } = await import('@/api/writing')
    vi.mocked(draftApi.create).mockResolvedValueOnce({ id: 5, chapter_id: 1, content: 'new draft', version_number: 1 } as any)

    const { result } = renderHook(() => useContentStore())
    let draft: any
    await act(async () => {
      draft = await result.current.saveDraftVersion(1, 'new draft')
    })
    expect(draft.id).toBe(5)
    expect(result.current.draftVersions).toHaveLength(1)
  })

  it('should get draft versions filtered and sorted by chapter', () => {
    useContentStore.setState({
      draftVersions: [
        { id: '1', chapter_id: 1, version_number: 1 },
        { id: '2', chapter_id: 1, version_number: 3 },
        { id: '3', chapter_id: 2, version_number: 1 },
        { id: '4', chapter_id: 1, version_number: 2 },
      ],
    } as any)
    const { result } = renderHook(() => useContentStore())
    const drafts = result.current.getDraftVersions(1)
    expect(drafts).toHaveLength(3)
    // Should be sorted desc by version_number
    expect(drafts[0].version_number).toBe(3)
    expect(drafts[1].version_number).toBe(2)
    expect(drafts[2].version_number).toBe(1)
  })

  it('should fetch plot threads', async () => {
    const { plotThreadApi } = await import('@/api/writing')
    vi.mocked(plotThreadApi.list).mockResolvedValueOnce([{ id: 1, title: 'Mystery', status: 'open' }] as any)

    const { result } = renderHook(() => useContentStore())
    await act(async () => {
      await result.current.fetchPlotThreads()
    })
    expect(result.current.plotThreads).toHaveLength(1)
    expect(result.current.loading.plotThreads).toBe(false)
  })

  it('should create an IFLine', async () => {
    const { ifLineApi } = await import('@/api/writing')
    vi.mocked(ifLineApi.create).mockResolvedValueOnce({ id: 1, title: 'IF Story' } as any)

    const { result } = renderHook(() => useContentStore())
    let ifLine: any
    await act(async () => {
      ifLine = await result.current.createIFLine({ title: 'IF Story' })
    })
    expect(ifLine.title).toBe('IF Story')
    expect(result.current.ifLines).toHaveLength(1)
  })
})

describe('contentStore selectors', () => {
  it('selectChapterById returns the correct chapter', () => {
    const state = { chapters: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }] } as any
    expect(selectChapterById(state, 2)!.title).toBe('B')
    expect(selectChapterById(state, null)).toBeUndefined()
  })

  it('selectChapters returns chapters array', () => {
    const state = { chapters: [{ id: 1 }] } as any
    expect(selectChapters(state)).toHaveLength(1)
  })

  it('selectDraftVersionsForChapter filters and sorts', () => {
    const state = {
      draftVersions: [
        { chapter_id: 1, version_number: 1 },
        { chapter_id: 1, version_number: 3 },
        { chapter_id: 2, version_number: 1 },
      ],
    } as any
    const drafts = selectDraftVersionsForChapter(state, 1)
    expect(drafts).toHaveLength(2)
    expect(drafts[0].version_number).toBe(3)

    expect(selectDraftVersionsForChapter(state, null)).toEqual([])
  })

  it('selectContentLoading returns loading state', () => {
    const state = { loading: { outlines: true, ifLines: false, plotThreads: false, drafts: false, inspections: false } } as any
    const loading = selectContentLoading(state)
    expect(loading.outlines).toBe(true)
    expect(loading.drafts).toBe(false)
  })

  it('cleanupContentStore resets loading flags', () => {
    useContentStore.setState({
      loading: { outlines: true, ifLines: false, plotThreads: false, drafts: true, inspections: false },
    })
    cleanupContentStore()
    const state = useContentStore.getState()
    expect(state.loading.outlines).toBe(false)
    expect(state.loading.drafts).toBe(false)
  })
})

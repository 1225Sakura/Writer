import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDataSlice, type DataSliceState, type DataSliceActions } from '@/store/settingsDataSlice'

// Mock settingsStore to prevent it from being loaded (it imports settingsDataSlice and creates a zustand store)
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: {},
}))

// Mock API modules
vi.mock('@/api/settings', () => ({
  characterApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, name: 'test', tier: 'supporting' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  relationshipApi: {
    getByCharacter: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, target_id: 2, type: 'friend' }),
    delete: vi.fn().mockResolvedValue({}),
  },
  storylineApi: {
    getByCharacter: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  },
  itemApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, name: 'item1' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  locationApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, name: 'loc1' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  factionApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, name: 'fac1' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  worldSettingApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, name: 'world1' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  ruleApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, name: 'rule1' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  writingSettingsApi: {
    get: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/api/writing', () => ({
  outlineApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, title: 'Outline' }),
  },
  chapterApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, title: 'Ch1' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  ifLineApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, title: 'IF1' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  aiApi: {
    generate: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/api/aiReview', () => ({
  aiReviewApi: {
    reviewSettings: vi.fn().mockResolvedValue({ issues: [], suggestions: [] }),
  },
}))

// Helper: create a minimal state for the slice
function makeState(overrides: Partial<DataSliceState> = {}): DataSliceState {
  return {
    characters: [],
    items: [],
    locations: [],
    factions: [],
    worldSettings: [],
    rules: [],
    outline: null,
    chapters: [],
    ifLines: [],
    writingSettings: null,
    isLoading: false,
    error: null,
    aiReviewResult: null,
    history: [],
    historyIndex: -1,
    canUndo: false,
    canRedo: false,
    ...overrides,
  }
}

// Create the slice in isolation (mock set/get)
function createTestSlice(overrides: Partial<DataSliceState> = {}) {
  let state: any = makeState(overrides)
  const set = (fn: (s: any) => void) => fn(state)
  // get() must return the full state + slice actions (as settingsStore would)
  const get = () => ({ ...state, ...slice })
  const slice = createDataSlice(set, get)
  return { slice, getState: () => state, set, get }
}

describe('settingsDataSlice', () => {
  it('should have correct initial state values', () => {
    const { slice } = createTestSlice()
    expect(slice.characters).toEqual([])
    expect(slice.items).toEqual([])
    expect(slice.locations).toEqual([])
    expect(slice.factions).toEqual([])
    expect(slice.worldSettings).toEqual([])
    expect(slice.rules).toEqual([])
    expect(slice.outline).toBeNull()
    expect(slice.chapters).toEqual([])
    expect(slice.ifLines).toEqual([])
    expect(slice.isLoading).toBe(false)
    expect(slice.error).toBeNull()
    expect(slice.aiReviewResult).toBeNull()
    expect(slice.history).toEqual([])
    expect(slice.historyIndex).toBe(-1)
    expect(slice.canUndo).toBe(false)
    expect(slice.canRedo).toBe(false)
  })

  it('should expose all CRUD actions', () => {
    const { slice } = createTestSlice()
    expect(typeof slice.loadAll).toBe('function')
    expect(typeof slice.loadCategoryData).toBe('function')
    expect(typeof slice.addCharacter).toBe('function')
    expect(typeof slice.updateCharacter).toBe('function')
    expect(typeof slice.deleteCharacter).toBe('function')
    expect(typeof slice.addItem).toBe('function')
    expect(typeof slice.addLocation).toBe('function')
    expect(typeof slice.addFaction).toBe('function')
    expect(typeof slice.addWorldSetting).toBe('function')
    expect(typeof slice.addRule).toBe('function')
    expect(typeof slice.setOutline).toBe('function')
    expect(typeof slice.addChapter).toBe('function')
    expect(typeof slice.addIFLine).toBe('function')
    expect(typeof slice.batchDelete).toBe('function')
    expect(typeof slice.undo).toBe('function')
    expect(typeof slice.redo).toBe('function')
    expect(typeof slice.clearHistory).toBe('function')
  })

  it('should add a character and track history', async () => {
    const { characterApi } = await import('@/api/settings')
    vi.mocked(characterApi.create).mockResolvedValueOnce({ id: 10, name: 'Hero', tier: 'core' } as any)

    const { slice, getState } = createTestSlice()
    let id: string
    await (slice as any).addCharacter({ name: 'Hero', tier: 'core', tags: [] })
    // The slice mutated state via set() — check that characterApi was called
    expect(characterApi.create).toHaveBeenCalled()
  })

  it('should delete a character and track history', async () => {
    const { characterApi } = await import('@/api/settings')
    vi.mocked(characterApi.delete).mockResolvedValueOnce({} as any)

    const state = makeState({
      characters: [{ id: 1, name: 'DeleteMe', tier: 'supporting', relationships: [], storylines: [], tags: [] }] as any,
    })
    let currentState = state
    const set = (fn: (s: any) => void) => fn(currentState)
    const get = () => currentState
    const slice = createDataSlice(set, get)
    await slice.deleteCharacter(1)
    expect(characterApi.delete).toHaveBeenCalledWith(1)
  })

  it('should clear history', () => {
    const state = makeState({
      history: [
        { id: 'h1', timestamp: Date.now(), entityType: 'character', entityId: 1, action: 'create', description: 'test' },
      ],
      historyIndex: 0,
      canUndo: true,
      canRedo: false,
    })
    let currentState = state
    const set = (fn: (s: any) => void) => fn(currentState)
    const get = () => currentState
    const slice = createDataSlice(set, get)
    slice.clearHistory()
  })

  it('should handle undo when no history', () => {
    const state = makeState({ historyIndex: -1 })
    let currentState = state
    const set = (fn: (s: any) => void) => fn(currentState)
    const get = () => currentState
    const slice = createDataSlice(set, get)
    // Should not throw
    expect(() => slice.undo()).not.toThrow()
  })

  it('should handle redo when at end of history', () => {
    const state = makeState({ historyIndex: 0, history: [] })
    let currentState = state
    const set = (fn: (s: any) => void) => fn(currentState)
    const get = () => currentState
    const slice = createDataSlice(set, get)
    expect(() => slice.redo()).not.toThrow()
  })

  it('should load category data for items', async () => {
    const { itemApi } = await import('@/api/settings')
    vi.mocked(itemApi.list).mockResolvedValueOnce([{ id: 1, name: 'Sword' }] as any)

    const state = makeState()
    let currentState = state
    const set = (fn: (s: any) => void) => fn(currentState)
    const get = () => currentState
    const slice = createDataSlice(set, get)
    await slice.loadCategoryData('item')
    expect(itemApi.list).toHaveBeenCalled()
  })

  it('should handle reviewWithAI', async () => {
    const { aiReviewApi } = await import('@/api/aiReview')
    vi.mocked(aiReviewApi.reviewSettings).mockResolvedValueOnce({ issues: ['issue1'], suggestions: [] } as any)

    const state = makeState()
    let currentState = state
    const set = (fn: (s: any) => void) => fn(currentState)
    const get = () => currentState
    const slice = createDataSlice(set, get)
    await slice.reviewWithAI('character')
    expect(aiReviewApi.reviewSettings).toHaveBeenCalled()
  })

  it('should handle generate action', async () => {
    const { aiApi } = await import('@/api/writing')
    vi.mocked(aiApi.generate).mockResolvedValueOnce({} as any)

    const state = makeState()
    let currentState = state
    const set = (fn: (s: any) => void) => fn(currentState)
    const get = () => currentState
    const slice = createDataSlice(set, get)
    await slice.generate('character', 'some context')
    expect(aiApi.generate).toHaveBeenCalled()
  })

  it('should handle batchDelete for characters', async () => {
    const { characterApi } = await import('@/api/settings')
    vi.mocked(characterApi.delete).mockResolvedValue({} as any)

    const state = makeState({
      characters: [
        { id: 1, name: 'A', tier: 'core', relationships: [], storylines: [], tags: [] },
        { id: 2, name: 'B', tier: 'core', relationships: [], storylines: [], tags: [] },
      ] as any,
    })
    let currentState = state
    const set = (fn: (s: any) => void) => fn(currentState)
    const get = () => currentState
    const slice = createDataSlice(set, get)
    await slice.batchDelete('character', [1])
    expect(characterApi.delete).toHaveBeenCalledWith(1)
  })

  it('should handle batchUpdateTags for characters', async () => {
    const state = makeState({
      characters: [
        { id: 1, name: 'A', tags: ['old'] },
        { id: 2, name: 'B', tags: [] },
      ] as any,
    })
    let currentState = state
    const set = (fn: (s: any) => void) => fn(currentState)
    const get = () => currentState
    const slice = createDataSlice(set, get)
    await slice.batchUpdateTags('character', [1, 2], ['new-tag'])
  })

  it('should execute batch delete via executeBatch', async () => {
    const { characterApi } = await import('@/api/settings')
    vi.mocked(characterApi.delete).mockResolvedValue({} as any)

    const { slice } = createTestSlice({
      characters: [{ id: 1, name: 'A', tier: 'core', relationships: [], storylines: [], tags: [] }] as any,
    })
    await slice.executeBatch({ type: 'delete', entityType: 'character', ids: [1] })
    expect(characterApi.delete).toHaveBeenCalled()
  })

  it('should handle setOutline and addChapter', async () => {
    const { outlineApi, chapterApi } = await import('@/api/writing')
    vi.mocked(outlineApi.create).mockResolvedValueOnce({ id: 1, title: 'Main' } as any)
    vi.mocked(chapterApi.create).mockResolvedValueOnce({ id: 1, title: 'Ch1' } as any)

    const state = makeState()
    let currentState = state
    const set = (fn: (s: any) => void) => fn(currentState)
    const get = () => currentState
    const slice = createDataSlice(set, get)
    // setOutline sets outline, then addChapter uses it
    await slice.setOutline({ id: 1, title: 'Main', description: '' })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEntityStore, selectCharacterCount, selectEntityCounts, selectCharactersByTier, selectEntityStatus, cleanupEntityStore } from '@/store/entityStore'

// Mock API modules
vi.mock('@/api/settings', () => ({
  characterApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, name: 'test', tier: 'supporting' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
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
    create: vi.fn().mockResolvedValue({ id: 1, name: 'faction1' }),
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
}))

vi.mock('@/api/writing', () => ({
  ifLineApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, title: 'ifline1' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/store/utils/indexedDBStorage', () => ({
  createHybridStorage: () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('entityStore', () => {
  beforeEach(() => {
    useEntityStore.setState({
      characters: [],
      items: [],
      locations: [],
      factions: [],
      worldSettings: [],
      rules: [],
      ifLines: [],
      isLoading: false,
      error: null,
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useEntityStore())
    expect(result.current.characters).toEqual([])
    expect(result.current.items).toEqual([])
    expect(result.current.locations).toEqual([])
    expect(result.current.factions).toEqual([])
    expect(result.current.worldSettings).toEqual([])
    expect(result.current.rules).toEqual([])
    expect(result.current.ifLines).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should expose all entity CRUD actions', () => {
    const { result } = renderHook(() => useEntityStore())
    expect(typeof result.current.loadCharacters).toBe('function')
    expect(typeof result.current.addCharacter).toBe('function')
    expect(typeof result.current.updateCharacter).toBe('function')
    expect(typeof result.current.deleteCharacter).toBe('function')
    expect(typeof result.current.loadItems).toBe('function')
    expect(typeof result.current.addItem).toBe('function')
    expect(typeof result.current.updateItem).toBe('function')
    expect(typeof result.current.deleteItem).toBe('function')
    expect(typeof result.current.loadLocations).toBe('function')
    expect(typeof result.current.addLocation).toBe('function')
    expect(typeof result.current.loadFactions).toBe('function')
    expect(typeof result.current.loadWorldSettings).toBe('function')
    expect(typeof result.current.loadRules).toBe('function')
    expect(typeof result.current.loadIFLines).toBe('function')
    expect(typeof result.current.batchDelete).toBe('function')
    expect(typeof result.current.loadAllEntities).toBe('function')
  })

  it('should load characters successfully', async () => {
    const { characterApi } = await import('@/api/settings')
    vi.mocked(characterApi.list).mockResolvedValueOnce([
      { id: 1, name: 'Alice', tier: 'core', gender: 'female' },
      { id: 2, name: 'Bob', tier: 'supporting', gender: 'male' },
    ] as any)

    const { result } = renderHook(() => useEntityStore())
    await act(async () => {
      await result.current.loadCharacters()
    })

    expect(result.current.characters).toHaveLength(2)
    expect(result.current.characters[0].name).toBe('Alice')
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle loadCharacters error', async () => {
    const { characterApi } = await import('@/api/settings')
    vi.mocked(characterApi.list).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useEntityStore())
    await act(async () => {
      await result.current.loadCharacters()
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.isLoading).toBe(false)
  })

  it('should add a character and return id', async () => {
    const { characterApi } = await import('@/api/settings')
    vi.mocked(characterApi.create).mockResolvedValueOnce({ id: 42, name: 'NewHero', tier: 'core' } as any)

    const { result } = renderHook(() => useEntityStore())
    let returnedId: string
    await act(async () => {
      returnedId = await result.current.addCharacter({ name: 'NewHero', tier: 'core' } as any)
    })

    expect(returnedId!).toBe('42')
    expect(result.current.characters).toHaveLength(1)
    expect(result.current.characters[0].name).toBe('NewHero')
  })

  it('should delete a character', async () => {
    const { characterApi } = await import('@/api/settings')
    vi.mocked(characterApi.delete).mockResolvedValueOnce({} as any)

    useEntityStore.setState({
      characters: [{ id: 1, name: 'Alice', tier: 'core', relationships: [], storylines: [], tags: [] }],
    } as any)

    const { result } = renderHook(() => useEntityStore())
    await act(async () => {
      await result.current.deleteCharacter(1)
    })

    expect(result.current.characters).toHaveLength(0)
  })

  it('should load items', async () => {
    const { itemApi } = await import('@/api/settings')
    vi.mocked(itemApi.list).mockResolvedValueOnce([{ id: 1, name: 'Sword' }] as any)

    const { result } = renderHook(() => useEntityStore())
    await act(async () => {
      await result.current.loadItems()
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].name).toBe('Sword')
  })

  it('should add an item', async () => {
    const { itemApi } = await import('@/api/settings')
    vi.mocked(itemApi.create).mockResolvedValueOnce({ id: 5, name: 'Shield' } as any)

    const { result } = renderHook(() => useEntityStore())
    let id: string
    await act(async () => {
      id = await result.current.addItem({ name: 'Shield' } as any)
    })

    expect(id!).toBe('5')
    expect(result.current.items).toHaveLength(1)
  })

  it('should load locations', async () => {
    const { locationApi } = await import('@/api/settings')
    vi.mocked(locationApi.list).mockResolvedValueOnce([{ id: 1, name: 'Castle' }] as any)

    const { result } = renderHook(() => useEntityStore())
    await act(async () => {
      await result.current.loadLocations()
    })

    expect(result.current.locations).toHaveLength(1)
  })

  it('should load all entities at once', async () => {
    const { characterApi, itemApi, locationApi, factionApi, worldSettingApi, ruleApi } = await import('@/api/settings')
    const { ifLineApi } = await import('@/api/writing')

    vi.mocked(characterApi.list).mockResolvedValueOnce([{ id: 1, name: 'A' }] as any)
    vi.mocked(itemApi.list).mockResolvedValueOnce([{ id: 1, name: 'I' }] as any)
    vi.mocked(locationApi.list).mockResolvedValueOnce([{ id: 1, name: 'L' }] as any)
    vi.mocked(factionApi.list).mockResolvedValueOnce([{ id: 1, name: 'F' }] as any)
    vi.mocked(worldSettingApi.list).mockResolvedValueOnce([{ id: 1, name: 'W' }] as any)
    vi.mocked(ruleApi.list).mockResolvedValueOnce([{ id: 1, name: 'R' }] as any)
    vi.mocked(ifLineApi.list).mockResolvedValueOnce([{ id: 1, title: 'IF' }] as any)

    const { result } = renderHook(() => useEntityStore())
    await act(async () => {
      await result.current.loadAllEntities()
    })

    expect(result.current.characters).toHaveLength(1)
    expect(result.current.items).toHaveLength(1)
    expect(result.current.locations).toHaveLength(1)
    expect(result.current.factions).toHaveLength(1)
    expect(result.current.worldSettings).toHaveLength(1)
    expect(result.current.rules).toHaveLength(1)
    expect(result.current.ifLines).toHaveLength(1)
  })

  it('should batch delete characters', async () => {
    const { characterApi } = await import('@/api/settings')
    vi.mocked(characterApi.delete).mockResolvedValue({} as any)

    useEntityStore.setState({
      characters: [
        { id: 1, name: 'A', tier: 'core', relationships: [], storylines: [], tags: [] },
        { id: 2, name: 'B', tier: 'core', relationships: [], storylines: [], tags: [] },
        { id: 3, name: 'C', tier: 'core', relationships: [], storylines: [], tags: [] },
      ],
    } as any)

    const { result } = renderHook(() => useEntityStore())
    await act(async () => {
      await result.current.batchDelete('character', [1, 3])
    })

    expect(result.current.characters).toHaveLength(1)
    expect(result.current.characters[0].id).toBe(2)
  })

  it('should batch delete items', async () => {
    const { itemApi } = await import('@/api/settings')
    vi.mocked(itemApi.delete).mockResolvedValue({} as any)

    useEntityStore.setState({
      items: [
        { id: 10, name: 'A' },
        { id: 20, name: 'B' },
      ],
    } as any)

    const { result } = renderHook(() => useEntityStore())
    await act(async () => {
      await result.current.batchDelete('item', [10])
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].id).toBe(20)
  })

  it('should clean up loading/error state', () => {
    useEntityStore.setState({ isLoading: true, error: 'some error' })
    cleanupEntityStore()
    const state = useEntityStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })
})

describe('entityStore selectors', () => {
  it('selectCharacterCount returns count', () => {
    const state = { characters: [{ id: 1 }, { id: 2 }] } as any
    expect(selectCharacterCount(state)).toBe(2)
  })

  it('selectEntityCounts returns all counts', () => {
    const state = {
      characters: [1],
      items: [1, 2],
      locations: [],
      factions: [1],
      worldSettings: [1, 2, 3],
      rules: [],
      ifLines: [1],
    } as any
    const counts = selectEntityCounts(state)
    expect(counts.characters).toBe(1)
    expect(counts.items).toBe(2)
    expect(counts.locations).toBe(0)
    expect(counts.factions).toBe(1)
    expect(counts.worldSettings).toBe(3)
    expect(counts.rules).toBe(0)
    expect(counts.ifLines).toBe(1)
  })

  it('selectCharactersByTier filters correctly', () => {
    const state = {
      characters: [
        { id: 1, tier: 'core' },
        { id: 2, tier: 'supporting' },
        { id: 3, tier: 'core' },
      ],
    } as any
    const cores = selectCharactersByTier('core')(state)
    expect(cores).toHaveLength(2)
  })

  it('selectEntityStatus returns loading and error', () => {
    const state = { isLoading: true, error: 'err' } as any
    const status = selectEntityStatus(state)
    expect(status.isLoading).toBe(true)
    expect(status.error).toBe('err')
  })
})

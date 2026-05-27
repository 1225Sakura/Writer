import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRelationStore, selectRelationCount } from '@/store/relationStore'

// Mock API modules
vi.mock('@/api/settings', () => ({
  relationshipApi: {
    getByCharacter: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1, target_id: 2, type: 'friend', description: 'test' }),
    delete: vi.fn().mockResolvedValue({}),
  },
  storylineApi: {
    getByCharacter: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  },
}))

describe('relationStore', () => {
  beforeEach(() => {
    useRelationStore.setState({
      isLoading: false,
      error: null,
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useRelationStore())
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should expose key actions', () => {
    const { result } = renderHook(() => useRelationStore())
    expect(typeof result.current.addRelationship).toBe('function')
    expect(typeof result.current.removeRelationship).toBe('function')
    expect(typeof result.current.loadRelationships).toBe('function')
    expect(typeof result.current.updateStorylineProgress).toBe('function')
    expect(typeof result.current.loadCharacterRelations).toBe('function')
  })

  it('should add a relationship', async () => {
    const { relationshipApi } = await import('@/api/settings')
    vi.mocked(relationshipApi.create).mockResolvedValueOnce({
      id: 10,
      target_id: 20,
      type: 'rival',
      description: 'Nemesis',
    } as any)

    const { result } = renderHook(() => useRelationStore())
    let rel: any
    await act(async () => {
      rel = await result.current.addRelationship(1, {
        targetId: 20,
        type: 'rival',
        description: 'Nemesis',
      })
    })
    expect(rel.id).toBe(10)
    expect(rel.targetId).toBe(20)
    expect(rel.type).toBe('rival')
    expect(result.current.error).toBeNull()
  })

  it('should handle addRelationship error', async () => {
    const { relationshipApi } = await import('@/api/settings')
    vi.mocked(relationshipApi.create).mockRejectedValueOnce(new Error('API error'))

    const { result } = renderHook(() => useRelationStore())
    await act(async () => {
      try {
        await result.current.addRelationship(1, { targetId: 2, type: 'friend' })
      } catch {
        // expected
      }
    })
    expect(result.current.error).toBe('API error')
  })

  it('should remove a relationship', async () => {
    const { relationshipApi } = await import('@/api/settings')
    vi.mocked(relationshipApi.delete).mockResolvedValueOnce({} as any)

    const { result } = renderHook(() => useRelationStore())
    await act(async () => {
      await result.current.removeRelationship(1, 5)
    })
    expect(relationshipApi.delete).toHaveBeenCalledWith(1, 5)
    expect(result.current.error).toBeNull()
  })

  it('should handle removeRelationship error', async () => {
    const { relationshipApi } = await import('@/api/settings')
    vi.mocked(relationshipApi.delete).mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useRelationStore())
    await act(async () => {
      try {
        await result.current.removeRelationship(1, 99)
      } catch {
        // expected
      }
    })
    expect(result.current.error).toBe('Not found')
  })

  it('should load relationships for a character', async () => {
    const { relationshipApi } = await import('@/api/settings')
    vi.mocked(relationshipApi.getByCharacter).mockResolvedValueOnce([
      { id: 1, target_id: 2, type: 'friend', description: 'Buddy' },
      { id: 2, target_id: 3, type: 'enemy', description: 'Foe' },
    ] as any)

    const { result } = renderHook(() => useRelationStore())
    let rels: any[]
    await act(async () => {
      rels = await result.current.loadRelationships(1)
    })
    expect(rels!).toHaveLength(2)
    expect(rels![0].targetId).toBe(2)
    expect(rels![0].type).toBe('friend')
    expect(rels![1].type).toBe('enemy')
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle loadRelationships error', async () => {
    const { relationshipApi } = await import('@/api/settings')
    vi.mocked(relationshipApi.getByCharacter).mockRejectedValueOnce(new Error('Timeout'))

    const { result } = renderHook(() => useRelationStore())
    let rels: any[]
    await act(async () => {
      rels = await result.current.loadRelationships(1)
    })
    expect(rels!).toEqual([])
    expect(result.current.error).toBe('Timeout')
    expect(result.current.isLoading).toBe(false)
  })

  it('should update storyline progress', async () => {
    const { storylineApi } = await import('@/api/settings')
    vi.mocked(storylineApi.update).mockResolvedValueOnce({} as any)

    const { result } = renderHook(() => useRelationStore())
    await act(async () => {
      await result.current.updateStorylineProgress(1, 5, 75)
    })
    expect(storylineApi.update).toHaveBeenCalledWith(1, 5, { progress: 75 })
    expect(result.current.error).toBeNull()
  })

  it('should handle updateStorylineProgress error', async () => {
    const { storylineApi } = await import('@/api/settings')
    vi.mocked(storylineApi.update).mockRejectedValueOnce(new Error('Update failed'))

    const { result } = renderHook(() => useRelationStore())
    await act(async () => {
      try {
        await result.current.updateStorylineProgress(1, 5, 50)
      } catch {
        // expected
      }
    })
    expect(result.current.error).toBe('Update failed')
  })

  it('should load full character relations (relationships + storylines)', async () => {
    const { relationshipApi, storylineApi } = await import('@/api/settings')
    vi.mocked(relationshipApi.getByCharacter).mockResolvedValueOnce([
      { id: 1, target_id: 2, type: 'family', description: 'Sister' },
    ] as any)
    vi.mocked(storylineApi.getByCharacter).mockResolvedValueOnce([
      { id: 10, title: 'Hero Journey', arc: 'Rising', progress: 40 },
    ] as any)

    const { result } = renderHook(() => useRelationStore())
    const character = { id: 1, name: 'Alice', tier: 'core', relationships: [], storylines: [], tags: [] } as any
    let enriched: any
    await act(async () => {
      enriched = await result.current.loadCharacterRelations(character)
    })
    expect(enriched.relationships).toHaveLength(1)
    expect(enriched.relationships[0].type).toBe('family')
    expect(enriched.storylines).toHaveLength(1)
    expect(enriched.storylines[0].title).toBe('Hero Journey')
    expect(result.current.isLoading).toBe(false)
  })

  it('should return original character on loadCharacterRelations error', async () => {
    const { relationshipApi } = await import('@/api/settings')
    vi.mocked(relationshipApi.getByCharacter).mockRejectedValueOnce(new Error('Fail'))

    const { result } = renderHook(() => useRelationStore())
    const character = { id: 1, name: 'Alice', tier: 'core', relationships: [], storylines: [], tags: [] } as any
    let returned: any
    await act(async () => {
      returned = await result.current.loadCharacterRelations(character)
    })
    // Should return the original character unchanged
    expect(returned.name).toBe('Alice')
    expect(result.current.error).toBe('Fail')
    expect(result.current.isLoading).toBe(false)
  })
})

describe('relationStore selectors', () => {
  it('selectRelationCount returns 0', () => {
    // Relations are stored in character objects, so selector always returns 0
    expect(selectRelationCount({ isLoading: false } as any)).toBe(0)
    expect(selectRelationCount({ isLoading: true } as any)).toBe(0)
  })
})

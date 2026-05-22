// ============================================
// Settings UI Slice — Tags, Filters, Search
// ============================================

import type { WritableDraft } from 'immer'
import type { EntityType } from '../shared/types'
import type {
  CharacterLocal,
  Tag,
  FilterCriteria,
} from './settingsTypes'
import type { SettingsState } from './settingsTypes'

// ============================================
// UI Slice State
// ============================================

export interface UISliceState {
  tags: Tag[]
  activeFilter: FilterCriteria
}

// ============================================
// UI Slice Actions
// ============================================

export interface UISliceActions {
  addTag: (name: string, color?: string) => void
  removeTag: (tagId: string) => void
  addTagToEntity: (entityType: EntityType, entityId: number, tagName: string) => void
  removeTagFromEntity: (entityType: EntityType, entityId: number, tagName: string) => void
  setFilter: (filter: Partial<FilterCriteria>) => void
  clearFilter: () => void
  getFilteredCharacters: () => CharacterLocal[]
  getFilteredItems: () => Array<{ id: number; name: string; description?: string; tags?: string[] }>
  getFilteredLocations: () => Array<{ id: number; name: string; description?: string; tags?: string[] }>
  getFilteredFactions: () => Array<{ id: number; name: string; description?: string; tags?: string[] }>
  searchEntities: (query: string, type?: EntityType | 'all') => Array<{ type: EntityType; id: number; name: string; description?: string; matchScore: number }>
}

type UISlice = UISliceState & UISliceActions

// ============================================
// Helpers
// ============================================

type Taggable = { id: number; tags?: string[] }
type TaggableArray = Taggable[]

/** Resolve entity array from state by type. Characters have non-optional tags. */
function getEntityArray(state: SettingsState, entityType: EntityType): TaggableArray | null {
  switch (entityType) {
    case 'character': return state.characters
    case 'item': return state.items
    case 'location': return state.locations
    case 'faction': return state.factions
    case 'world': return state.worldSettings
    case 'rule': return state.rules
    case 'ifline': return state.ifLines
    default: return null
  }
}

interface SearchableEntity {
  id: number
  name: string
  description?: string
  tags?: string[]
}

function scoreEntity(entity: SearchableEntity, q: string): number {
  let score = 0
  const nameLower = entity.name.toLowerCase()
  const descLower = entity.description?.toLowerCase() || ''

  if (nameLower === q) score += 100
  else if (nameLower.startsWith(q)) score += 80
  else if (nameLower.includes(q)) score += 60
  if (descLower.includes(q)) score += 30
  entity.tags?.forEach((tag) => {
    const tagLower = tag.toLowerCase()
    if (tagLower === q) score += 50
    else if (tagLower.includes(q)) score += 25
  })
  return score
}

function filterByQuery<T extends { name: string; description?: string }>(
  items: T[],
  query: string,
): T[] {
  const q = query.toLowerCase()
  return items.filter(
    (item) => item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q),
  )
}

// ============================================
// Slice Creator
// ============================================

export const createUISlice = (
  rawSet: (fn: (state: WritableDraft<SettingsState>) => void) => void,
  get: () => SettingsState,
): UISlice => {
  const set = rawSet
  return {
  // ---- Initial State ----
  tags: [],
  activeFilter: {
    sortBy: 'name',
    sortOrder: 'asc',
  },

  // ---- Tag Actions ----

  addTag: (name, color) => {
    const newTag: Tag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      color,
    }
    set((state) => { state.tags.push(newTag) })
  },

  removeTag: (tagId) => {
    set((state) => {
      state.tags = state.tags.filter((t) => t.id !== tagId)
    })
  },

  addTagToEntity: (entityType, entityId, tagName) => {
    set((state) => {
      const arr = getEntityArray(state, entityType)
      if (!arr) return
      const entity = arr.find((e) => e.id === entityId)
      if (entity) {
        if (!entity.tags) entity.tags = []
        if (!entity.tags.includes(tagName)) entity.tags.push(tagName)
      }
    })
  },

  removeTagFromEntity: (entityType, entityId, tagName) => {
    set((state) => {
      const arr = getEntityArray(state, entityType)
      if (!arr) return
      const entity = arr.find((e) => e.id === entityId)
      if (entity?.tags) {
        entity.tags = entity.tags.filter((t) => t !== tagName)
      }
    })
  },

  // ---- Filter & Sort ----

  setFilter: (filter) => {
    set((state) => {
      Object.assign(state.activeFilter, filter)
    })
  },

  clearFilter: () => {
    set((state) => {
      state.activeFilter = { sortBy: 'name', sortOrder: 'asc' }
    })
  },

  getFilteredCharacters: () => {
    const { characters, activeFilter } = get()
    let result = [...characters]

    if (activeFilter.query) {
      const q = activeFilter.query.toLowerCase()
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      )
    }

    if (activeFilter.tags?.length) {
      result = result.filter((c) =>
        activeFilter.tags!.some((t) => c.tags.includes(t))
      )
    }

    if (activeFilter.tier?.length) {
      result = result.filter((c) => activeFilter.tier!.includes(c.tier))
    }

    result.sort((a, b) => {
      const dir = activeFilter.sortOrder === 'asc' ? 1 : -1
      switch (activeFilter.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name, 'zh-CN') * dir
        case 'createdAt':
          return (a.id - b.id) * dir
        default:
          return a.name.localeCompare(b.name, 'zh-CN') * dir
      }
    })

    return result
  },

  getFilteredItems: () => {
    const { items, activeFilter } = get()
    const result = activeFilter.query ? filterByQuery(items, activeFilter.query) : [...items]
    result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    return result
  },

  getFilteredLocations: () => {
    const { locations, activeFilter } = get()
    const result = activeFilter.query ? filterByQuery(locations, activeFilter.query) : [...locations]
    result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    return result
  },

  getFilteredFactions: () => {
    const { factions, activeFilter } = get()
    const result = activeFilter.query ? filterByQuery(factions, activeFilter.query) : [...factions]
    result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    return result
  },

  // ---- Search ----

  searchEntities: (query, type = 'all') => {
    const state = get()
    const results: Array<{
      type: EntityType
      id: number
      name: string
      description?: string
      matchScore: number
    }> = []
    const q = query.toLowerCase().trim()
    if (!q) return results

    const searchIn = (
      entities: SearchableEntity[],
      entityType: EntityType,
    ) => {
      entities.forEach((entity) => {
        const score = scoreEntity(entity, q)
        if (score > 0) {
          results.push({
            type: entityType,
            id: entity.id,
            name: entity.name,
            description: entity.description,
            matchScore: score,
          })
        }
      })
    }

    const searchIFLines = () => {
      state.ifLines.forEach((entity) => {
        const score = scoreEntity({ id: entity.id, name: entity.title, description: entity.description, tags: entity.tags }, q)
        if (score > 0) {
          results.push({
            type: 'ifline',
            id: entity.id,
            name: entity.title,
            description: entity.description,
            matchScore: score,
          })
        }
      })
    }

    if (type === 'all' || type === 'character') searchIn(state.characters, 'character')
    if (type === 'all' || type === 'item') searchIn(state.items, 'item')
    if (type === 'all' || type === 'location') searchIn(state.locations, 'location')
    if (type === 'all' || type === 'faction') searchIn(state.factions, 'faction')
    if (type === 'all' || type === 'world') searchIn(state.worldSettings, 'world')
    if (type === 'all' || type === 'rule') searchIn(state.rules, 'rule')
    if (type === 'all' || type === 'ifline') searchIFLines()

    return results.sort((a, b) => b.matchScore - a.matchScore)
  },
} as UISlice }

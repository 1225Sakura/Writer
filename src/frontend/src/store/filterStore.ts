import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { EntityType } from '../shared/types'

// Re-export
export type { EntityType }

// ============================================
// Types
// ============================================

export interface FilterCriteria {
  query?: string
  tags?: string[]
  tier?: ('core' | 'supporting' | 'minor')[]
  sortBy: 'name' | 'createdAt' | 'updatedAt'
  sortOrder: 'asc' | 'desc'
}

export interface Tag {
  id: string
  name: string
  color?: string
}

interface FilterState {
  activeFilter: FilterCriteria
  tags: Tag[]
}

interface FilterActions {
  setFilter: (filter: Partial<FilterCriteria>) => void
  clearFilter: () => void
  addTag: (name: string, color?: string) => void
  removeTag: (tagId: string) => void
  addTagToEntity: (entityType: EntityType, entity: { tags?: string[] }, tagName: string) => void
  removeTagFromEntity: (entityType: EntityType, entity: { tags?: string[] }, tagName: string) => void

  // Filter getters - these take the data and filter it
  getFilteredCharacters: (characters: Array<{ name: string; description?: string; tags: string[]; tier: 'core' | 'supporting' | 'minor'; id: number }>) => typeof characters
  getFilteredItems: (items: Array<{ name: string; description?: string; tags?: string[] }>) => typeof items
  getFilteredLocations: (locations: Array<{ name: string; description?: string; tags?: string[] }>) => typeof locations
  getFilteredFactions: (factions: Array<{ name: string; description?: string; tags?: string[] }>) => typeof factions

  // Search
  searchEntities: <T extends { name: string; description?: string; tags?: string[] }>(
    items: T[],
    query: string
  ) => Array<{ item: T; matchScore: number }>
}

// ============================================
// Store
// ============================================

export const useFilterStore = create<FilterState & FilterActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          activeFilter: {
            sortBy: 'name',
            sortOrder: 'asc',
          },
          tags: [],

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

          addTagToEntity: (_entityType, entity, tagName) => {
            const tags = entity.tags || []
            if (!tags.includes(tagName)) {
              tags.push(tagName)
            }
          },

          removeTagFromEntity: (_entityType, entity, tagName) => {
            const tags = entity.tags || []
            const idx = tags.indexOf(tagName)
            if (idx >= 0) {
              tags.splice(idx, 1)
            }
          },

          getFilteredCharacters: (characters) => {
            const { activeFilter } = get()
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

          getFilteredItems: (items) => {
            const { activeFilter } = get()
            let result = [...items]
            if (activeFilter.query) {
              const q = activeFilter.query.toLowerCase()
              result = result.filter((i) =>
                i.name.toLowerCase().includes(q) ||
                i.description?.toLowerCase().includes(q)
              )
            }
            result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
            return result
          },

          getFilteredLocations: (locations) => {
            const { activeFilter } = get()
            let result = [...locations]
            if (activeFilter.query) {
              const q = activeFilter.query.toLowerCase()
              result = result.filter((l) =>
                l.name.toLowerCase().includes(q) ||
                l.description?.toLowerCase().includes(q)
              )
            }
            result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
            return result
          },

          getFilteredFactions: (factions) => {
            const { activeFilter } = get()
            let result = [...factions]
            if (activeFilter.query) {
              const q = activeFilter.query.toLowerCase()
              result = result.filter((f) =>
                f.name.toLowerCase().includes(q) ||
                f.description?.toLowerCase().includes(q)
              )
            }
            result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
            return result
          },

          searchEntities: <T extends { name: string; description?: string; tags?: string[] }>(
            items: T[],
            query: string
          ) => {
            const results: Array<{ item: T; matchScore: number }> = []
            const q = query.toLowerCase().trim()
            if (!q) return results

            items.forEach((entity) => {
              let score = 0
              const nameLower = entity.name.toLowerCase()
              const descLower = entity.description?.toLowerCase() || ''
              const tagsLower = entity.tags?.map((t) => t.toLowerCase()) || []

              if (nameLower === q) score += 100
              else if (nameLower.startsWith(q)) score += 80
              else if (nameLower.includes(q)) score += 60
              if (descLower.includes(q)) score += 30
              tagsLower.forEach((tag) => {
                if (tag === q) score += 50
                else if (tag.includes(q)) score += 25
              })

              if (score > 0) {
                results.push({ item: entity, matchScore: score })
              }
            })

            return results.sort((a, b) => b.matchScore - a.matchScore)
          },
        }),
        {
          name: 'writer-filter-store',
          partialize: (state) => ({
            tags: state.tags,
            activeFilter: state.activeFilter,
          }),
          version: 1,
        }
      )
    )
  )
)

// ============================================
// Selectors
// ============================================

export const selectActiveFilter = (state: FilterState) => state.activeFilter
export const selectTags = (state: FilterState) => state.tags
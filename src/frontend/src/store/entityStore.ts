import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  characterApi,
  itemApi,
  locationApi,
  factionApi,
  worldSettingApi,
  ruleApi,
} from '../api/settings'
import { ifLineApi } from '../api/writing'
import type {
  Character,
  Item,
  Location,
  Faction,
  WorldSetting,
  Rule,
  IFLine,
  EntityType,
} from '../shared/types'

// Re-export types
export type { EntityType }

// ============================================
// Types
// ============================================

export interface CharacterLocal {
  id: number
  name: string
  gender?: string
  personality?: string
  desires?: string
  flaws?: string
  description?: string
  tier: 'core' | 'supporting' | 'minor'
  cultivationRealm?: string
  relationships: Relationship[]
  storylines: CharacterStorylineLocal[]
  tags: string[]
}

export interface Relationship {
  id: number
  targetId: number
  type: 'family' | 'friend' | 'enemy' | 'master' | 'disciple' | 'rival' | 'romantic' | 'other'
  description?: string
}

export interface CharacterStorylineLocal {
  id: number
  title: string
  arc: string
  progress: number
}

interface EntityState {
  characters: CharacterLocal[]
  items: Item[]
  locations: Location[]
  factions: Faction[]
  worldSettings: WorldSetting[]
  rules: Rule[]
  ifLines: IFLine[]
  isLoading: boolean
  error: string | null
}

interface EntityActions {
  // Character CRUD
  addCharacter: (character: Omit<CharacterLocal, 'id' | 'relationships' | 'storylines'>) => Promise<string>
  updateCharacter: (id: number, updates: Partial<CharacterLocal>) => Promise<void>
  deleteCharacter: (id: number) => Promise<void>
  loadCharacters: () => Promise<void>

  // Item CRUD
  addItem: (item: Omit<Item, 'id'>) => Promise<string>
  updateItem: (id: number, updates: Partial<Item>) => Promise<void>
  deleteItem: (id: number) => Promise<void>
  loadItems: () => Promise<void>

  // Location CRUD
  addLocation: (location: Omit<Location, 'id'>) => Promise<string>
  updateLocation: (id: number, updates: Partial<Location>) => Promise<void>
  deleteLocation: (id: number) => Promise<void>
  loadLocations: () => Promise<void>

  // Faction CRUD
  addFaction: (faction: Omit<Faction, 'id'>) => Promise<string>
  updateFaction: (id: number, updates: Partial<Faction>) => Promise<void>
  deleteFaction: (id: number) => Promise<void>
  loadFactions: () => Promise<void>

  // WorldSetting CRUD
  addWorldSetting: (setting: Omit<WorldSetting, 'id'>) => Promise<void>
  updateWorldSetting: (id: number, updates: Partial<WorldSetting>) => Promise<void>
  deleteWorldSetting: (id: number) => Promise<void>
  loadWorldSettings: () => Promise<void>

  // Rule CRUD
  addRule: (rule: Omit<Rule, 'id'>) => Promise<void>
  updateRule: (id: number, updates: Partial<Rule>) => Promise<void>
  deleteRule: (id: number) => Promise<void>
  loadRules: () => Promise<void>

  // IFLine CRUD
  addIFLine: (ifLine: Omit<IFLine, 'id'>) => Promise<void>
  updateIFLine: (id: number, updates: Partial<IFLine>) => Promise<void>
  deleteIFLine: (id: number) => Promise<void>
  loadIFLines: () => Promise<void>

  // Batch
  batchDelete: (entityType: EntityType, ids: number[]) => Promise<void>
  loadAllEntities: () => Promise<void>
}

// ============================================
// Helpers
// ============================================

const toLocalCharacter = (apiChar: Character): CharacterLocal => ({
  id: apiChar.id,
  name: apiChar.name,
  gender: apiChar.gender,
  personality: apiChar.personality,
  desires: apiChar.desires,
  flaws: apiChar.flaws,
  description: apiChar.description,
  tier: (apiChar.tier as 'core' | 'supporting' | 'minor') || 'supporting',
  cultivationRealm: apiChar.cultivation_realm,
  relationships: [],
  storylines: [],
  tags: [],
})

// ============================================
// Store
// ============================================

export const useEntityStore = create<EntityState & EntityActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set) => ({
          characters: [],
          items: [],
          locations: [],
          factions: [],
          worldSettings: [],
          rules: [],
          ifLines: [],
          isLoading: false,
          error: null,

          // Character CRUD
          loadCharacters: async () => {
            set((state) => { state.isLoading = true })
            try {
              const characters = await characterApi.list()
              set((state) => {
                state.characters = characters.map(toLocalCharacter)
                state.isLoading = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },

          addCharacter: async (character) => {
            const apiChar = await characterApi.create({
              name: character.name,
              gender: character.gender,
              personality: character.personality,
              desires: character.desires,
              flaws: character.flaws,
              description: character.description,
              tier: character.tier,
              cultivation_realm: character.cultivationRealm,
            })
            const newCharacter = { ...toLocalCharacter(apiChar), relationships: [], storylines: [] }
            set((state) => { state.characters.push(newCharacter) })
            return String(apiChar.id)
          },

          updateCharacter: async (id, updates) => {
            await characterApi.update(id, {
              name: updates.name,
              gender: updates.gender,
              personality: updates.personality,
              desires: updates.desires,
              flaws: updates.flaws,
              description: updates.description,
              tier: updates.tier,
              cultivation_realm: updates.cultivationRealm,
            })
            set((state) => {
              const char = state.characters.find((c) => c.id === id)
              if (char) Object.assign(char, updates)
            })
          },

          deleteCharacter: async (id) => {
            await characterApi.delete(id)
            set((state) => {
              state.characters = state.characters.filter((c) => c.id !== id)
            })
          },

          // Item CRUD
          loadItems: async () => {
            set((state) => { state.isLoading = true })
            try {
              const items = await itemApi.list()
              set((state) => { state.items = items, state.isLoading = false })
            } catch (error) {
              set((state) => { state.error = (error as Error).message, state.isLoading = false })
            }
          },

          addItem: async (item) => {
            const apiItem = await itemApi.create(item)
            set((state) => { state.items.push(apiItem) })
            return String(apiItem.id)
          },

          updateItem: async (id, updates) => {
            await itemApi.update(id, updates)
            set((state) => {
              const item = state.items.find((i) => i.id === id)
              if (item) Object.assign(item, updates)
            })
          },

          deleteItem: async (id) => {
            await itemApi.delete(id)
            set((state) => { state.items = state.items.filter((i) => i.id !== id) })
          },

          // Location CRUD
          loadLocations: async () => {
            set((state) => { state.isLoading = true })
            try {
              const locations = await locationApi.list()
              set((state) => { state.locations = locations, state.isLoading = false })
            } catch (error) {
              set((state) => { state.error = (error as Error).message, state.isLoading = false })
            }
          },

          addLocation: async (location) => {
            const apiLoc = await locationApi.create(location)
            set((state) => { state.locations.push(apiLoc) })
            return String(apiLoc.id)
          },

          updateLocation: async (id, updates) => {
            await locationApi.update(id, updates)
            set((state) => {
              const loc = state.locations.find((l) => l.id === id)
              if (loc) Object.assign(loc, updates)
            })
          },

          deleteLocation: async (id) => {
            await locationApi.delete(id)
            set((state) => { state.locations = state.locations.filter((l) => l.id !== id) })
          },

          // Faction CRUD
          loadFactions: async () => {
            set((state) => { state.isLoading = true })
            try {
              const factions = await factionApi.list()
              set((state) => { state.factions = factions, state.isLoading = false })
            } catch (error) {
              set((state) => { state.error = (error as Error).message, state.isLoading = false })
            }
          },

          addFaction: async (faction) => {
            const apiFac = await factionApi.create(faction)
            set((state) => { state.factions.push(apiFac) })
            return String(apiFac.id)
          },

          updateFaction: async (id, updates) => {
            await factionApi.update(id, updates)
            set((state) => {
              const fac = state.factions.find((f) => f.id === id)
              if (fac) Object.assign(fac, updates)
            })
          },

          deleteFaction: async (id) => {
            await factionApi.delete(id)
            set((state) => { state.factions = state.factions.filter((f) => f.id !== id) })
          },

          // WorldSetting CRUD
          loadWorldSettings: async () => {
            set((state) => { state.isLoading = true })
            try {
              const worldSettings = await worldSettingApi.list()
              set((state) => { state.worldSettings = worldSettings, state.isLoading = false })
            } catch (error) {
              set((state) => { state.error = (error as Error).message, state.isLoading = false })
            }
          },

          addWorldSetting: async (setting) => {
            const apiWS = await worldSettingApi.create(setting)
            set((state) => { state.worldSettings.push(apiWS) })
          },

          updateWorldSetting: async (id, updates) => {
            await worldSettingApi.update(id, updates)
            set((state) => {
              const ws = state.worldSettings.find((w) => w.id === id)
              if (ws) Object.assign(ws, updates)
            })
          },

          deleteWorldSetting: async (id) => {
            await worldSettingApi.delete(id)
            set((state) => { state.worldSettings = state.worldSettings.filter((w) => w.id !== id) })
          },

          // Rule CRUD
          loadRules: async () => {
            set((state) => { state.isLoading = true })
            try {
              const rules = await ruleApi.list()
              set((state) => { state.rules = rules, state.isLoading = false })
            } catch (error) {
              set((state) => { state.error = (error as Error).message, state.isLoading = false })
            }
          },

          addRule: async (rule) => {
            const apiRule = await ruleApi.create(rule)
            set((state) => { state.rules.push(apiRule) })
          },

          updateRule: async (id, updates) => {
            await ruleApi.update(id, updates)
            set((state) => {
              const r = state.rules.find((x) => x.id === id)
              if (r) Object.assign(r, updates)
            })
          },

          deleteRule: async (id) => {
            await ruleApi.delete(id)
            set((state) => { state.rules = state.rules.filter((r) => r.id !== id) })
          },

          // IFLine CRUD
          loadIFLines: async () => {
            set((state) => { state.isLoading = true })
            try {
              const ifLines = await ifLineApi.list()
              set((state) => { state.ifLines = ifLines, state.isLoading = false })
            } catch (error) {
              set((state) => { state.error = (error as Error).message, state.isLoading = false })
            }
          },

          addIFLine: async (ifLine) => {
            const apiIF = await ifLineApi.create(ifLine)
            set((state) => { state.ifLines.push(apiIF) })
          },

          updateIFLine: async (id, updates) => {
            await ifLineApi.update(id, updates)
            set((state) => {
              const line = state.ifLines.find((i) => i.id === id)
              if (line) Object.assign(line, updates)
            })
          },

          deleteIFLine: async (id) => {
            await ifLineApi.delete(id)
            set((state) => { state.ifLines = state.ifLines.filter((i) => i.id !== id) })
          },

          // Batch operations
          batchDelete: async (entityType, ids) => {
            set((state) => { state.isLoading = true })
            try {
              switch (entityType) {
                case 'character':
                  await Promise.all(ids.map((id) => characterApi.delete(id)))
                  set((state) => { state.characters = state.characters.filter((c) => !ids.includes(c.id)) })
                  break
                case 'item':
                  await Promise.all(ids.map((id) => itemApi.delete(id)))
                  set((state) => { state.items = state.items.filter((i) => !ids.includes(i.id)) })
                  break
                case 'location':
                  await Promise.all(ids.map((id) => locationApi.delete(id)))
                  set((state) => { state.locations = state.locations.filter((l) => !ids.includes(l.id)) })
                  break
                case 'faction':
                  await Promise.all(ids.map((id) => factionApi.delete(id)))
                  set((state) => { state.factions = state.factions.filter((f) => !ids.includes(f.id)) })
                  break
                case 'world':
                  await Promise.all(ids.map((id) => worldSettingApi.delete(id)))
                  set((state) => { state.worldSettings = state.worldSettings.filter((w) => !ids.includes(w.id)) })
                  break
                case 'rule':
                  await Promise.all(ids.map((id) => ruleApi.delete(id)))
                  set((state) => { state.rules = state.rules.filter((r) => !ids.includes(r.id)) })
                  break
                case 'ifline':
                  await Promise.all(ids.map((id) => ifLineApi.delete(id)))
                  set((state) => { state.ifLines = state.ifLines.filter((i) => !ids.includes(i.id)) })
                  break
              }
            } catch (error) {
              set((state) => { state.error = (error as Error).message })
            } finally {
              set((state) => { state.isLoading = false })
            }
          },

          loadAllEntities: async () => {
            set((state) => { state.isLoading = true, state.error = null })
            try {
              const [characters, items, locations, factions, worldSettings, rules, ifLines] =
                await Promise.all([
                  characterApi.list(),
                  itemApi.list(),
                  locationApi.list(),
                  factionApi.list(),
                  worldSettingApi.list(),
                  ruleApi.list(),
                  ifLineApi.list(),
                ])
              set((state) => {
                state.characters = characters.map(toLocalCharacter)
                state.items = items
                state.locations = locations
                state.factions = factions
                state.worldSettings = worldSettings
                state.rules = rules
                state.ifLines = ifLines
                state.isLoading = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },
        }),
        {
          name: 'writer-entity-store',
          partialize: () => ({}),
          version: 1,
        }
      )
    )
  )
)

// ============================================
// Selectors
// ============================================

export const selectCharacterCount = (state: EntityState) => state.characters.length

export const selectEntityCounts = (state: EntityState) => ({
  characters: state.characters.length,
  items: state.items.length,
  locations: state.locations.length,
  factions: state.factions.length,
  worldSettings: state.worldSettings.length,
  rules: state.rules.length,
  ifLines: state.ifLines.length,
})

export const selectCharactersByTier = (tier: CharacterLocal['tier']) => (state: EntityState) =>
  state.characters.filter((c) => c.tier === tier)
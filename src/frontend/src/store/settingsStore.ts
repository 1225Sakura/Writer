import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  characterApi,
  relationshipApi,
  storylineApi,
  itemApi,
  locationApi,
  factionApi,
  worldSettingApi,
  ruleApi,
  writingSettingsApi,
} from '../api/settings'
import {
  outlineApi,
  chapterApi,
  ifLineApi,
  aiApi as aiGenerateApi,
} from '../api/writing'
import { aiReviewApi } from '../api/aiReview'
import type { AIReviewResult } from '../api/types'
import type {
  Character,
  CharacterTier,
  Item,
  Location,
  Faction,
  WorldSetting,
  Rule,
  Outline,
  Chapter,
  IFLine,
  EntityType,
  WritingSettings,
  CharacterRelationship,
  CharacterStoryline,
} from '../shared/types'
import { createHybridStorage } from './utils/indexedDBStorage'

// Re-export EntityType for external usage
export type { EntityType }

// ============================================
// Local Types
// ============================================

export interface Relationship {
  id: number
  targetId: number
  type: 'family' | 'friend' | 'enemy' | 'master' | 'disciple' | 'rival' | 'romantic' | 'other'
  description?: string
}

export interface CharacterLocal {
  id: number
  name: string
  gender?: string
  personality?: string
  desires?: string
  flaws?: string
  description?: string
  tier: CharacterTier
  cultivationRealm?: string
  relationships: Relationship[]
  storylines: CharacterStorylineLocal[]
  tags: string[]
}

export interface CharacterStorylineLocal {
  id: number
  title: string
  arc: string
  progress: number
}

export interface Tag {
  id: string
  name: string
  color?: string
}

/** 筛选条件 */
export interface FilterCriteria {
  query?: string
  tags?: string[]
  tier?: CharacterTier[]
  sortBy: 'name' | 'createdAt' | 'updatedAt'
  sortOrder: 'asc' | 'desc'
}

/** 历史记录条目 */
export interface HistoryEntry {
  id: string
  timestamp: number
  entityType: EntityType
  entityId: number
  action: 'create' | 'update' | 'delete' | 'batch'
  description: string
  /** 操作前的快照，用于撤销 */
  snapshot?: unknown
}

/** 批量操作类型 */
export type BatchOperation =
  | { type: 'delete'; entityType: EntityType; ids: number[] }
  | { type: 'updateTags'; entityType: EntityType; ids: number[]; tags: string[] }
  | { type: 'updateTier'; ids: number[]; tier: CharacterTier }

// ============================================
// Helpers
// ============================================

const DEFAULT_TIER: CharacterTier = 'supporting'

const toLocalCharacter = (apiChar: Character): CharacterLocal => ({
  id: apiChar.id,
  name: apiChar.name,
  gender: apiChar.gender,
  personality: apiChar.personality,
  desires: apiChar.desires,
  flaws: apiChar.flaws,
  description: apiChar.description,
  tier: apiChar.tier ?? DEFAULT_TIER,
  cultivationRealm: apiChar.cultivation_realm,
  relationships: [],
  storylines: [],
  tags: [],
})

const mapApiRelationships = (relationships: CharacterRelationship[]): Relationship[] =>
  relationships.map((r) => ({
    id: r.id,
    targetId: r.target_id,
    type: isValidRelationshipType(r.type) ? r.type : 'other',
    description: r.description,
  }))

const mapApiStorylines = (storylines: CharacterStoryline[]): CharacterStorylineLocal[] =>
  storylines.map((s) => ({
    id: s.id,
    title: s.title,
    arc: s.arc ?? '',
    progress: s.progress,
  }))

function isValidRelationshipType(type: string): type is Relationship['type'] {
  const validTypes: Relationship['type'][] = ['family', 'friend', 'enemy', 'master', 'disciple', 'rival', 'romantic', 'other']
  return validTypes.includes(type as Relationship['type'])
}

const genHistoryId = (): string => `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const MAX_HISTORY = 50

// ============================================
// State & Actions
// ============================================

interface SettingsState {
  // Data
  characters: CharacterLocal[]
  items: Item[]
  locations: Location[]
  factions: Faction[]
  worldSettings: WorldSetting[]
  rules: Rule[]
  outline: Outline | null
  chapters: Chapter[]
  ifLines: IFLine[]
  writingSettings: WritingSettings | null

  // Loading & Error
  isLoading: boolean
  error: string | null

  // AI Review
  aiReviewResult: AIReviewResult | null

  // Tags
  tags: Tag[]

  // Filter & Sort
  activeFilter: FilterCriteria

  // History (undo/redo)
  history: HistoryEntry[]
  historyIndex: number
  canUndo: boolean
  canRedo: boolean
}

interface SettingsActions {
  // Data loading
  loadAll: () => Promise<void>
  loadCategoryData: (category: EntityType) => Promise<void>

  // AI
  generate: (type: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule', context?: string) => Promise<void>
  generateRelations: () => Promise<void>
  reviewWithAI: (category: EntityType) => Promise<void>

  // Character CRUD
  addCharacter: (character: Omit<CharacterLocal, 'id' | 'relationships' | 'storylines'>) => Promise<string>
  updateCharacter: (id: number, updates: Partial<CharacterLocal>) => Promise<void>
  deleteCharacter: (id: number) => Promise<void>
  addRelationship: (characterId: number, relationship: Omit<Relationship, 'id'>) => Promise<void>
  removeRelationship: (characterId: number, relationshipId: number) => Promise<void>
  updateStorylineProgress: (characterId: number, storylineId: number, progress: number) => Promise<void>

  // Item CRUD
  addItem: (item: Omit<Item, 'id'>) => Promise<string>
  updateItem: (id: number, updates: Partial<Item>) => Promise<void>
  deleteItem: (id: number) => Promise<void>

  // Location CRUD
  addLocation: (location: Omit<Location, 'id'>) => Promise<string>
  updateLocation: (id: number, updates: Partial<Location>) => Promise<void>
  deleteLocation: (id: number) => Promise<void>

  // Faction CRUD
  addFaction: (faction: Omit<Faction, 'id'>) => Promise<string>
  updateFaction: (id: number, updates: Partial<Faction>) => Promise<void>
  deleteFaction: (id: number) => Promise<void>

  // WorldSetting CRUD
  addWorldSetting: (setting: Omit<WorldSetting, 'id'>) => Promise<string>
  updateWorldSetting: (id: number, updates: Partial<WorldSetting>) => Promise<void>
  deleteWorldSetting: (id: number) => Promise<void>

  // Rule CRUD
  addRule: (rule: Omit<Rule, 'id'>) => Promise<string>
  updateRule: (id: number, updates: Partial<Rule>) => Promise<void>
  deleteRule: (id: number) => Promise<void>

  // Outline
  setOutline: (outline: Outline) => Promise<void>
  addChapter: (chapter: Omit<Chapter, 'id'>) => Promise<void>
  updateChapter: (id: number, updates: Partial<Chapter>) => Promise<void>
  deleteChapter: (id: number) => Promise<void>

  // IFLine
  addIFLine: (ifLine: Omit<IFLine, 'id'>) => Promise<void>
  updateIFLine: (id: number, updates: Partial<IFLine>) => Promise<void>
  deleteIFLine: (id: number) => Promise<void>

  // Batch operations
  importFromChat: (entities: Array<{ type: EntityType; name: string; description?: string }>) => Promise<void>
  batchDelete: (entityType: EntityType, ids: number[]) => Promise<void>
  batchUpdateTags: (entityType: EntityType, ids: number[], tags: string[]) => Promise<void>
  executeBatch: (operation: BatchOperation) => Promise<void>

  // Tags
  addTag: (name: string, color?: string) => void
  removeTag: (tagId: string) => void
  addTagToEntity: (entityType: EntityType, entityId: number, tagName: string) => void
  removeTagFromEntity: (entityType: EntityType, entityId: number, tagName: string) => void

  // Filter & Sort
  setFilter: (filter: Partial<FilterCriteria>) => void
  clearFilter: () => void
  getFilteredCharacters: () => CharacterLocal[]
  getFilteredItems: () => Item[]
  getFilteredLocations: () => Location[]
  getFilteredFactions: () => Faction[]

  // Search
  searchEntities: (query: string, type?: EntityType | 'all') => Array<{ type: EntityType; id: number; name: string; description?: string; matchScore: number }>

  // Undo/Redo
  undo: () => void
  redo: () => void
  clearHistory: () => void
}

// ============================================
// Store
// ============================================

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
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
          tags: [],
          activeFilter: {
            sortBy: 'name',
            sortOrder: 'asc',
          },
          history: [],
          historyIndex: -1,
          canUndo: false,
          canRedo: false,

          // ----------------------------------------
          // Data Loading
          // ----------------------------------------

          loadAll: async () => {
            set((state) => {
              state.isLoading = true
              state.error = null
            })
            try {
              const [characters, items, locations, factions, worldSettings, rules, outlines, ifLines, writingSettings] =
                await Promise.all([
                  characterApi.list(),
                  itemApi.list(),
                  locationApi.list(),
                  factionApi.list(),
                  worldSettingApi.list(),
                  ruleApi.list(),
                  outlineApi.list(),
                  ifLineApi.list(),
                  writingSettingsApi.get(),
                ])

              const charactersWithRelations = await Promise.all(
                characters.map(async (apiChar) => {
                  const localChar = toLocalCharacter(apiChar)
                  try {
                    const [relationships, storylines] = await Promise.all([
                      relationshipApi.getByCharacter(apiChar.id),
                      storylineApi.getByCharacter(apiChar.id),
                    ])
                    localChar.relationships = mapApiRelationships(relationships)
                    localChar.storylines = mapApiStorylines(storylines)
                  } catch {
                    // Ignore relation fetch errors
                  }
                  return localChar
                })
              )

              let outline: Outline | null = null
              let chapters: Chapter[] = []
              if (outlines.length > 0) {
                outline = outlines[0]
                chapters = await chapterApi.list({ outline_id: outline.id })
              }

              set((state) => {
                state.characters = charactersWithRelations
                state.items = items
                state.locations = locations
                state.factions = factions
                state.worldSettings = worldSettings
                state.rules = rules
                state.outline = outline
                state.chapters = chapters
                state.ifLines = ifLines
                state.writingSettings = writingSettings
                state.isLoading = false
              })
            } catch (error) {
              set((state) => {
                state.error = error instanceof Error ? error.message : String(error)
                state.isLoading = false
              })
            }
          },

          loadCategoryData: async (category) => {
            set((state) => { state.isLoading = true })
            try {
              switch (category) {
                case 'character': {
                  const characters = await characterApi.list()
                  const withRelations = await Promise.all(
                    characters.map(async (apiChar) => {
                      const localChar = toLocalCharacter(apiChar)
                      try {
                        const [relationships, storylines] = await Promise.all([
                          relationshipApi.getByCharacter(apiChar.id),
                          storylineApi.getByCharacter(apiChar.id),
                        ])
                        localChar.relationships = mapApiRelationships(relationships)
                        localChar.storylines = mapApiStorylines(storylines)
                      } catch { /* ignore */ }
                      return localChar
                    })
                  )
                  set((state) => { state.characters = withRelations })
                  break
                }
                case 'item': {
                  const items = await itemApi.list()
                  set((state) => { state.items = items })
                  break
                }
                case 'location': {
                  const locations = await locationApi.list()
                  set((state) => { state.locations = locations })
                  break
                }
                case 'faction': {
                  const factions = await factionApi.list()
                  set((state) => { state.factions = factions })
                  break
                }
                case 'world': {
                  const worldSettings = await worldSettingApi.list()
                  set((state) => { state.worldSettings = worldSettings })
                  break
                }
                case 'rule': {
                  const rules = await ruleApi.list()
                  set((state) => { state.rules = rules })
                  break
                }
                case 'outline': {
                  const outlines = await outlineApi.list()
                  let outline: Outline | null = null
                  let chapters: Chapter[] = []
                  if (outlines.length > 0) {
                    outline = outlines[0]
                    chapters = await chapterApi.list({ outline_id: outline.id })
                  }
                  set((state) => {
                    state.outline = outline
                    state.chapters = chapters
                  })
                  break
                }
                case 'ifline': {
                  const ifLines = await ifLineApi.list()
                  set((state) => { state.ifLines = ifLines })
                  break
                }
              }
              set((state) => { state.isLoading = false })
            } catch (error) {
              set((state) => {
                state.error = error instanceof Error ? error.message : String(error)
                state.isLoading = false
              })
            }
          },

          // ----------------------------------------
          // AI
          // ----------------------------------------

          reviewWithAI: async (category) => {
            try {
              const result = await aiReviewApi.reviewSettings({ settings_data: { category } })
              set((state) => { state.aiReviewResult = result })
            } catch (error) {
              set((state) => { state.error = error instanceof Error ? error.message : String(error) })
            }
          },

          generate: async (type, context) => {
            try {
              await aiGenerateApi.generate({
                prompt: context || `生成${type}设定`,
                operation: 'continue',
              })
            } catch (error) {
              set((state) => { state.error = error instanceof Error ? error.message : String(error) })
            }
          },

          generateRelations: async () => {
            const { characters } = get()
            if (characters.length < 2) {
              set((state) => { state.error = '需要至少2个角色才能生成关系' })
              return
            }
            try {
              const withRelations = await Promise.all(
                characters.map(async (localChar) => {
                  const relationships = await relationshipApi.getByCharacter(localChar.id)
                  return {
                    ...localChar,
                    relationships: mapApiRelationships(relationships),
                  }
                })
              )
              set((state) => { state.characters = withRelations })
            } catch (error) {
              set((state) => { state.error = error instanceof Error ? error.message : String(error) })
            }
          },

          // ----------------------------------------
          // Character CRUD
          // ----------------------------------------

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
            set((state) => {
              state.characters.push(newCharacter)
              state.history.push({
                id: genHistoryId(),
                timestamp: Date.now(),
                entityType: 'character',
                entityId: apiChar.id,
                action: 'create',
                description: `创建角色: ${character.name}`,
              })
              state.historyIndex = state.history.length - 1
              state.canUndo = true
              state.canRedo = false
              if (state.history.length > MAX_HISTORY) {
                state.history.shift()
                state.historyIndex--
              }
            })
            return String(apiChar.id)
          },

          updateCharacter: async (id, updates) => {
            const oldChar = get().characters.find((c) => c.id === id)
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
              state.history.push({
                id: genHistoryId(),
                timestamp: Date.now(),
                entityType: 'character',
                entityId: id,
                action: 'update',
                description: `更新角色: ${updates.name || char?.name}`,
                snapshot: oldChar,
              })
              state.historyIndex = state.history.length - 1
              state.canUndo = true
              state.canRedo = false
              if (state.history.length > MAX_HISTORY) {
                state.history.shift()
                state.historyIndex--
              }
            })
          },

          deleteCharacter: async (id) => {
            const oldChar = get().characters.find((c) => c.id === id)
            await characterApi.delete(id)
            set((state) => {
              state.characters = state.characters.filter((c) => c.id !== id)
              state.history.push({
                id: genHistoryId(),
                timestamp: Date.now(),
                entityType: 'character',
                entityId: id,
                action: 'delete',
                description: `删除角色: ${oldChar?.name || String(id)}`,
                snapshot: oldChar,
              })
              state.historyIndex = state.history.length - 1
              state.canUndo = true
              state.canRedo = false
              if (state.history.length > MAX_HISTORY) {
                state.history.shift()
                state.historyIndex--
              }
            })
          },

          addRelationship: async (characterId, relationship) => {
            const apiRel = await relationshipApi.create(characterId, {
              target_id: relationship.targetId,
              type: relationship.type,
              description: relationship.description,
            })
            const newRel: Relationship = {
              id: apiRel.id,
              targetId: apiRel.target_id,
              type: isValidRelationshipType(apiRel.type) ? apiRel.type : 'other',
              description: apiRel.description,
            }
            set((state) => {
              const char = state.characters.find((c) => c.id === characterId)
              if (char) char.relationships.push(newRel)
            })
          },

          removeRelationship: async (characterId, relationshipId) => {
            await relationshipApi.delete(characterId, relationshipId)
            set((state) => {
              const char = state.characters.find((c) => c.id === characterId)
              if (char) {
                char.relationships = char.relationships.filter((r) => r.id !== relationshipId)
              }
            })
          },

          updateStorylineProgress: async (characterId, storylineId, progress) => {
            await storylineApi.update(characterId, storylineId, { progress })
            set((state) => {
              const char = state.characters.find((c) => c.id === characterId)
              if (char) {
                const sl = char.storylines.find((s) => s.id === storylineId)
                if (sl) sl.progress = progress
              }
            })
          },

          // ----------------------------------------
          // Item CRUD
          // ----------------------------------------

          addItem: async (item) => {
            const apiItem = await itemApi.create(item)
            set((state) => {
              state.items.push(apiItem)
            })
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
            set((state) => {
              state.items = state.items.filter((i) => i.id !== id)
            })
          },

          // ----------------------------------------
          // Location CRUD
          // ----------------------------------------

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
            set((state) => {
              state.locations = state.locations.filter((l) => l.id !== id)
            })
          },

          // ----------------------------------------
          // Faction CRUD
          // ----------------------------------------

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
            set((state) => {
              state.factions = state.factions.filter((f) => f.id !== id)
            })
          },

          // ----------------------------------------
          // WorldSetting CRUD
          // ----------------------------------------

          addWorldSetting: async (setting) => {
            const apiWS = await worldSettingApi.create(setting)
            set((state) => { state.worldSettings.push(apiWS) })
            return String(apiWS.id)
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
            set((state) => {
              state.worldSettings = state.worldSettings.filter((w) => w.id !== id)
            })
          },

          // ----------------------------------------
          // Rule CRUD
          // ----------------------------------------

          addRule: async (rule) => {
            const apiRule = await ruleApi.create(rule)
            set((state) => { state.rules.push(apiRule) })
            return String(apiRule.id)
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
            set((state) => {
              state.rules = state.rules.filter((r) => r.id !== id)
            })
          },

          // ----------------------------------------
          // Outline
          // ----------------------------------------

          setOutline: async (outline) => {
            const apiOutline = await outlineApi.create(outline)
            set((state) => {
              state.outline = apiOutline
              state.chapters = []
            })
          },

          addChapter: async (chapter) => {
            if (!get().outline) return
            const apiChapter = await chapterApi.create({
              ...chapter,
              outline_id: get().outline!.id,
            })
            set((state) => { state.chapters.push(apiChapter) })
          },

          updateChapter: async (id, updates) => {
            await chapterApi.update(id, updates)
            set((state) => {
              const ch = state.chapters.find((c) => c.id === id)
              if (ch) Object.assign(ch, updates)
            })
          },

          deleteChapter: async (id) => {
            await chapterApi.delete(id)
            set((state) => {
              state.chapters = state.chapters.filter((c) => c.id !== id)
            })
          },

          // ----------------------------------------
          // IFLine
          // ----------------------------------------

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
            set((state) => {
              state.ifLines = state.ifLines.filter((i) => i.id !== id)
            })
          },

          // ----------------------------------------
          // Batch Operations
          // ----------------------------------------

          importFromChat: async (entities) => {
            for (const { type, name, description } of entities) {
              switch (type) {
                case 'character':
                  await get().addCharacter({ name, description, tier: 'supporting', tags: [] })
                  break
                case 'item':
                  await get().addItem({ name, description })
                  break
                case 'location':
                  await get().addLocation({ name, description, importance: 'minor' })
                  break
                case 'faction':
                  await get().addFaction({ name, description, type: 'other' })
                  break
                case 'world':
                  await get().addWorldSetting({ name, description: description || '' })
                  break
                case 'rule':
                  await get().addRule({ name, description: description || '', type: 'other' })
                  break
                case 'outline':
                  await get().setOutline({ id: Date.now(), title: name, description: description || '' })
                  break
                case 'ifline':
                  await get().addIFLine({ title: name, description: description || '', sync_mode: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                  break
              }
            }
          },

          batchDelete: async (entityType, ids) => {
            set((state) => { state.isLoading = true })
            try {
              switch (entityType) {
                case 'character':
                  await Promise.all(ids.map((id) => characterApi.delete(id)))
                  set((state) => {
                    state.characters = state.characters.filter((c) => !ids.includes(c.id))
                  })
                  break
                case 'item':
                  await Promise.all(ids.map((id) => itemApi.delete(id)))
                  set((state) => {
                    state.items = state.items.filter((i) => !ids.includes(i.id))
                  })
                  break
                case 'location':
                  await Promise.all(ids.map((id) => locationApi.delete(id)))
                  set((state) => {
                    state.locations = state.locations.filter((l) => !ids.includes(l.id))
                  })
                  break
                case 'faction':
                  await Promise.all(ids.map((id) => factionApi.delete(id)))
                  set((state) => {
                    state.factions = state.factions.filter((f) => !ids.includes(f.id))
                  })
                  break
                case 'world':
                  await Promise.all(ids.map((id) => worldSettingApi.delete(id)))
                  set((state) => {
                    state.worldSettings = state.worldSettings.filter((w) => !ids.includes(w.id))
                  })
                  break
                case 'rule':
                  await Promise.all(ids.map((id) => ruleApi.delete(id)))
                  set((state) => {
                    state.rules = state.rules.filter((r) => !ids.includes(r.id))
                  })
                  break
                case 'ifline':
                  await Promise.all(ids.map((id) => ifLineApi.delete(id)))
                  set((state) => {
                    state.ifLines = state.ifLines.filter((i) => !ids.includes(i.id))
                  })
                  break
              }
              set((state) => {
                state.history.push({
                  id: genHistoryId(),
                  timestamp: Date.now(),
                  entityType,
                  entityId: ids[0] || 0,
                  action: 'batch',
                  description: `批量删除 ${ids.length} 个${entityType}`,
                })
                state.historyIndex = state.history.length - 1
                state.canUndo = true
                state.canRedo = false
              })
            } catch (error) {
              set((state) => { state.error = error instanceof Error ? error.message : String(error) })
            } finally {
              set((state) => { state.isLoading = false })
            }
          },

          batchUpdateTags: async (entityType, ids, tags) => {
            // Optimistic update
            set((state) => {
              switch (entityType) {
                case 'character':
                  state.characters.forEach((c) => {
                    if (ids.includes(c.id)) {
                      c.tags = [...new Set([...c.tags, ...tags])]
                    }
                  })
                  break
                case 'item':
                  state.items.forEach((i) => {
                    if (ids.includes(i.id)) {
                      i.tags = [...new Set([...(i.tags || []), ...tags])]
                    }
                  })
                  break
                case 'location':
                  state.locations.forEach((l) => {
                    if (ids.includes(l.id)) {
                      l.tags = [...new Set([...(l.tags || []), ...tags])]
                    }
                  })
                  break
                case 'faction':
                  state.factions.forEach((f) => {
                    if (ids.includes(f.id)) {
                      f.tags = [...new Set([...(f.tags || []), ...tags])]
                    }
                  })
                  break
                case 'ifline':
                  state.ifLines.forEach((i) => {
                    if (ids.includes(i.id)) {
                      i.tags = [...new Set([...(i.tags || []), ...tags])]
                    }
                  })
                  break
              }
            })
          },

          executeBatch: async (operation) => {
            switch (operation.type) {
              case 'delete':
                await get().batchDelete(operation.entityType, operation.ids)
                break
              case 'updateTags':
                await get().batchUpdateTags(operation.entityType, operation.ids, operation.tags)
                break
              case 'updateTier':
                await Promise.all(
                  operation.ids.map((id) =>
                    get().updateCharacter(id, { tier: operation.tier })
                  )
                )
                break
            }
          },

          // ----------------------------------------
          // Tags
          // ----------------------------------------

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
              switch (entityType) {
                case 'character': {
                  const c = state.characters.find((x) => x.id === entityId)
                  if (c && !c.tags.includes(tagName)) c.tags.push(tagName)
                  break
                }
                case 'item': {
                  const i = state.items.find((x) => x.id === entityId)
                  if (i) {
                    if (!i.tags) i.tags = []
                    if (!i.tags.includes(tagName)) i.tags.push(tagName)
                  }
                  break
                }
                case 'location': {
                  const l = state.locations.find((x) => x.id === entityId)
                  if (l) {
                    if (!l.tags) l.tags = []
                    if (!l.tags.includes(tagName)) l.tags.push(tagName)
                  }
                  break
                }
                case 'faction': {
                  const f = state.factions.find((x) => x.id === entityId)
                  if (f) {
                    if (!f.tags) f.tags = []
                    if (!f.tags.includes(tagName)) f.tags.push(tagName)
                  }
                  break
                }
                case 'world': {
                  const w = state.worldSettings.find((x) => x.id === entityId)
                  if (w) {
                    if (!w.tags) w.tags = []
                    if (!w.tags.includes(tagName)) w.tags.push(tagName)
                  }
                  break
                }
                case 'rule': {
                  const r = state.rules.find((x) => x.id === entityId)
                  if (r) {
                    if (!r.tags) r.tags = []
                    if (!r.tags.includes(tagName)) r.tags.push(tagName)
                  }
                  break
                }
                case 'ifline': {
                  const il = state.ifLines.find((x) => x.id === entityId)
                  if (il) {
                    if (!il.tags) il.tags = []
                    if (!il.tags.includes(tagName)) il.tags.push(tagName)
                  }
                  break
                }
              }
            })
          },

          removeTagFromEntity: (entityType, entityId, tagName) => {
            set((state) => {
              switch (entityType) {
                case 'character': {
                  const c = state.characters.find((x) => x.id === entityId)
                  if (c) c.tags = c.tags.filter((t) => t !== tagName)
                  break
                }
                case 'item': {
                  const i = state.items.find((x) => x.id === entityId)
                  if (i && i.tags) i.tags = i.tags.filter((t) => t !== tagName)
                  break
                }
                case 'location': {
                  const l = state.locations.find((x) => x.id === entityId)
                  if (l && l.tags) l.tags = l.tags.filter((t) => t !== tagName)
                  break
                }
                case 'faction': {
                  const f = state.factions.find((x) => x.id === entityId)
                  if (f && f.tags) f.tags = f.tags.filter((t) => t !== tagName)
                  break
                }
                case 'world': {
                  const w = state.worldSettings.find((x) => x.id === entityId)
                  if (w && w.tags) w.tags = w.tags.filter((t) => t !== tagName)
                  break
                }
                case 'rule': {
                  const r = state.rules.find((x) => x.id === entityId)
                  if (r && r.tags) r.tags = r.tags.filter((t) => t !== tagName)
                  break
                }
                case 'ifline': {
                  const il = state.ifLines.find((x) => x.id === entityId)
                  if (il && il.tags) il.tags = il.tags.filter((t) => t !== tagName)
                  break
                }
              }
            })
          },

          // ----------------------------------------
          // Filter & Sort
          // ----------------------------------------

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

          getFilteredLocations: () => {
            const { locations, activeFilter } = get()
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

          getFilteredFactions: () => {
            const { factions, activeFilter } = get()
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

          // ----------------------------------------
          // Search
          // ----------------------------------------

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
              entities: Array<{ id: number; name: string; description?: string; tags?: string[] }>,
              entityType: EntityType
            ) => {
              entities.forEach((entity) => {
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
                let score = 0
                const nameLower = entity.title.toLowerCase()
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

          // ----------------------------------------
          // Undo/Redo
          // ----------------------------------------

          undo: () => {
            const { history, historyIndex } = get()
            if (historyIndex < 0) return

            const entry = history[historyIndex]
            set((state) => {
              state.historyIndex--
              state.canUndo = state.historyIndex >= 0
              state.canRedo = true
            })

            // Restore snapshot if available
            if (entry.snapshot && entry.action === 'update') {
              switch (entry.entityType) {
                case 'character':
                  set((state) => {
                    const idx = state.characters.findIndex((c) => c.id === entry.entityId)
                    if (idx >= 0) {
                      state.characters[idx] = { ...(entry.snapshot as CharacterLocal) }
                    }
                  })
                  break
              }
            } else if (entry.snapshot && entry.action === 'delete') {
              switch (entry.entityType) {
                case 'character':
                  set((state) => {
                    state.characters.push({ ...(entry.snapshot as CharacterLocal) })
                  })
                  break
              }
            }
          },

          redo: () => {
            const { history, historyIndex } = get()
            if (historyIndex >= history.length - 1) return
            // Redo would require storing the forward action - simplified for now
            set((state) => {
              state.historyIndex++
              state.canUndo = true
              state.canRedo = state.historyIndex < state.history.length - 1
            })
          },

          clearHistory: () => {
            set((state) => {
              state.history = []
              state.historyIndex = -1
              state.canUndo = false
              state.canRedo = false
            })
          },
        }),
        {
          name: 'writer-settings-store-v2',
          storage: createHybridStorage(100 * 1024) as never,
          partialize: (state) => ({
            tags: state.tags,
            activeFilter: state.activeFilter,
          }),
          version: 2,
        }
      )
    )
  )
)

// ============================================
// Selectors
// ============================================

export const selectCharacterCount = (state: SettingsState) => state.characters.length
export const selectEntityCounts = (state: SettingsState) => ({
  characters: state.characters.length,
  items: state.items.length,
  locations: state.locations.length,
  factions: state.factions.length,
  worldSettings: state.worldSettings.length,
  rules: state.rules.length,
  ifLines: state.ifLines.length,
})
export const selectWritingSettings = (state: SettingsState) => state.writingSettings

/** 仅选择 loading/error 状态（最小重渲染） */
export const selectSettingsStatus = (state: SettingsState) => ({
  isLoading: state.isLoading,
  error: state.error,
})

/** 选择角色列表（shallow 比较） */
export const selectCharactersShallow = (state: SettingsState) => state.characters

/** 选择 AI 审查结果 */
export const selectAIReviewResult = (state: SettingsState) => state.aiReviewResult

/** 按 tier 筛选角色 */
export const selectCharactersByTier = (tier: CharacterTier) => (state: SettingsState) =>
  state.characters.filter((c) => c.tier === tier)

/** 清理 settings store 临时状态 */
export function cleanupSettingsStore(): void {
  useSettingsStore.setState({
    isLoading: false,
    error: null,
    aiReviewResult: null,
  })
}

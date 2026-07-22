// ============================================
// Settings Data Slice — Entity CRUD, AI, History, Batch
// ============================================

import type { WritableDraft } from 'immer'
import { showOperationError } from '../utils/toastHelper'
import {
  characterApi,
  relationshipApi,
  storylineApi,
  entityRelationApi,
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
import { consumeStream } from '../api/chat'
import { aiReviewApi } from '../api/aiReview'
import type { AIReviewResult } from '../api/types'
import type {
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
  EntityRelation,
} from '../shared/types'
import type {
  Relationship,
  CharacterLocal,
  HistoryEntry,
  BatchOperation,
} from './settingsTypes'
import {
  toLocalCharacter,
  mapApiRelationships,
  mapApiStorylines,
  isValidRelationshipType,
  genHistoryId,
  MAX_HISTORY,
  entityTypeToArrayName,
} from './settingsTypes'
import { createEntityHandlers } from './settingsEntityFactory'

// ============================================
// Data Slice State
// ============================================

export interface DataSliceState {
  characters: CharacterLocal[]
  items: Item[]
  locations: Location[]
  factions: Faction[]
  worldSettings: WorldSetting[]
  rules: Rule[]
  outline: Outline | null
  chapters: Chapter[]
  ifLines: IFLine[]
  relations: EntityRelation[]
  writingSettings: WritingSettings | null
  isLoading: boolean
  error: string | null
  aiReviewResult: AIReviewResult | null
  aiGenerateResult: string | null
  history: HistoryEntry[]
  historyIndex: number
  canUndo: boolean
  canRedo: boolean
}

// ============================================
// Data Slice Actions
// ============================================

export interface DataSliceActions {
  loadAll: () => Promise<void>
  loadCategoryData: (category: EntityType) => Promise<void>
  generate: (type: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule', context?: string) => Promise<void>
  generateRelations: () => Promise<void>
  reviewWithAI: (category: EntityType) => Promise<void>
  addCharacter: (character: Omit<CharacterLocal, 'id' | 'relationships' | 'storylines'>) => Promise<string>
  updateCharacter: (id: number, updates: Partial<CharacterLocal>) => Promise<void>
  deleteCharacter: (id: number) => Promise<void>
  addRelationship: (characterId: number, relationship: Omit<Relationship, 'id'>) => Promise<void>
  updateRelationship: (characterId: number, relationshipId: number, updates: Partial<Omit<Relationship, 'id'>>) => Promise<void>
  removeRelationship: (characterId: number, relationshipId: number) => Promise<void>
  updateStorylineProgress: (characterId: number, storylineId: number, progress: number) => Promise<void>
  loadRelations: () => Promise<void>
  addRelation: (data: Partial<EntityRelation>) => Promise<string>
  updateRelation: (id: number, data: Partial<EntityRelation>) => Promise<void>
  deleteRelation: (id: number) => Promise<void>
  getRelationsForEntity: (entityType: string, entityId: number) => EntityRelation[]
  addItem: (item: Omit<Item, 'id'>) => Promise<string>
  updateItem: (id: number, updates: Partial<Item>) => Promise<void>
  deleteItem: (id: number) => Promise<void>
  addLocation: (location: Omit<Location, 'id'>) => Promise<string>
  updateLocation: (id: number, updates: Partial<Location>) => Promise<void>
  deleteLocation: (id: number) => Promise<void>
  addFaction: (faction: Omit<Faction, 'id'>) => Promise<string>
  updateFaction: (id: number, updates: Partial<Faction>) => Promise<void>
  deleteFaction: (id: number) => Promise<void>
  addWorldSetting: (setting: Omit<WorldSetting, 'id'>) => Promise<string>
  updateWorldSetting: (id: number, updates: Partial<WorldSetting>) => Promise<void>
  deleteWorldSetting: (id: number) => Promise<void>
  addRule: (rule: Omit<Rule, 'id'>) => Promise<string>
  updateRule: (id: number, updates: Partial<Rule>) => Promise<void>
  deleteRule: (id: number) => Promise<void>
  setOutline: (outline: Outline) => Promise<void>
  updateOutline: (updates: { title?: string; description?: string }) => Promise<void>
  addChapter: (chapter: Omit<Chapter, 'id'>) => Promise<void>
  updateChapter: (id: number, updates: Partial<Chapter>) => Promise<void>
  deleteChapter: (id: number) => Promise<void>
  addIFLine: (ifLine: Omit<IFLine, 'id'>) => Promise<void>
  updateIFLine: (id: number, updates: Partial<IFLine>) => Promise<void>
  deleteIFLine: (id: number) => Promise<void>
  importFromChat: (entities: Array<{ type: EntityType | 'plot_point' | 'chapter' | 'plot_thread'; name: string; description?: string }>) => Promise<void>
  batchDelete: (entityType: EntityType, ids: number[]) => Promise<void>
  batchUpdateTags: (entityType: EntityType, ids: number[], tags: string[]) => Promise<void>
  executeBatch: (operation: BatchOperation) => Promise<void>
  undo: () => void
  redo: () => void
  clearHistory: () => void
}

// Full type for the slice creator
type DataSlice = DataSliceState & DataSliceActions

// The full combined state (will be defined in settingsStore, but we need it here for typing)
import type { SettingsState } from './settingsTypes'

type FullState = SettingsState & DataSliceActions

// ============================================
// Slice Creator
// ============================================

export const createDataSlice = (
  rawSet: (fn: (state: WritableDraft<FullState>) => void) => void,
  rawGet: () => FullState,
): DataSlice => {
  const set = rawSet as (fn: (state: WritableDraft<SettingsState>) => void) => void
  const get = rawGet as () => SettingsState & DataSliceActions
  return {
  // ---- Initial State ----
  characters: [],
  items: [],
  locations: [],
  factions: [],
  worldSettings: [],
  rules: [],
  outline: null,
  chapters: [],
  ifLines: [],
  relations: [],
  writingSettings: null,
  isLoading: false,
  error: null,
  aiReviewResult: null,
  aiGenerateResult: null,
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,

  // ---- Data Loading ----

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
          } catch (relationError) {
            showOperationError('角色关系加载', relationError)
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
              } catch (relationError) {
                showOperationError('分类角色关系加载', relationError)
              }
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

  // ---- AI ----

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
      set((state) => { state.aiGenerateResult = null })
      const { stream } = await aiGenerateApi.generate({
        prompt: context || `生成${type}设定`,
        operation: 'continue',
      })
      const result = await consumeStream(stream)
      set((state) => { state.aiGenerateResult = result })
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

  // ---- Character CRUD ----

  addCharacter: async (character) => {
    try {
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
    } catch (error) {
      showOperationError('创建角色', error)
      return ''
    }
  },

  updateCharacter: async (id, updates) => {
    try {
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
          snapshot: oldChar ? { ...oldChar } : undefined,
          forwardSnapshot: char ? { ...char } : undefined,
        })
        state.historyIndex = state.history.length - 1
        state.canUndo = true
        state.canRedo = false
        if (state.history.length > MAX_HISTORY) {
          state.history.shift()
          state.historyIndex--
        }
      })
    } catch (error) {
      showOperationError('更新角色', error)
    }
  },

  deleteCharacter: async (id) => {
    try {
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
    } catch (error) {
      showOperationError('删除角色', error)
    }
  },

  addRelationship: async (characterId, relationship) => {
    try {
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
    } catch (error) {
      showOperationError('添加关系', error)
    }
  },

  updateRelationship: async (characterId, relationshipId, updates) => {
    try {
      const apiRel = await relationshipApi.update(characterId, relationshipId, {
        target_id: updates.targetId,
        type: updates.type,
        description: updates.description,
      })
      set((state) => {
        const char = state.characters.find((c) => c.id === characterId)
        if (char) {
          const rel = char.relationships.find((r) => r.id === relationshipId)
          if (rel) {
            if (apiRel.target_id !== undefined) rel.targetId = apiRel.target_id
            if (apiRel.type !== undefined) {
              rel.type = isValidRelationshipType(apiRel.type) ? apiRel.type : 'other'
            }
            if (apiRel.description !== undefined) rel.description = apiRel.description
          }
        }
      })
    } catch (error) {
      showOperationError('更新关系', error)
    }
  },

  removeRelationship: async (characterId, relationshipId) => {
    try {
      await relationshipApi.delete(characterId, relationshipId)
      set((state) => {
        const char = state.characters.find((c) => c.id === characterId)
        if (char) {
          char.relationships = char.relationships.filter((r) => r.id !== relationshipId)
        }
      })
    } catch (error) {
      showOperationError('删除关系', error)
    }
  },

  updateStorylineProgress: async (characterId, storylineId, progress) => {
    try {
      await storylineApi.update(characterId, storylineId, { progress })
      set((state) => {
        const char = state.characters.find((c) => c.id === characterId)
        if (char) {
          const sl = char.storylines.find((s) => s.id === storylineId)
          if (sl) sl.progress = progress
        }
      })
    } catch (error) {
      showOperationError('更新故事线进度', error)
    }
  },

  // ---- Entity Relation CRUD (cross-entity graph relationships) ----

  loadRelations: async () => {
    try {
      const relations = await entityRelationApi.list()
      set((state) => { state.relations = relations })
    } catch (error) {
      showOperationError('加载关系数据', error)
    }
  },

  addRelation: async (data) => {
    try {
      const apiRel = await entityRelationApi.create(data)
      set((state) => {
        state.relations.push(apiRel)
        state.history.push({
          id: genHistoryId(),
          timestamp: Date.now(),
          entityType: 'character',
          entityId: apiRel.id,
          action: 'create',
          description: `创建关系: ${apiRel.source_type}#${apiRel.source_id} → ${apiRel.target_type}#${apiRel.target_id}`,
        })
        state.historyIndex = state.history.length - 1
        state.canUndo = true
        state.canRedo = false
        if (state.history.length > MAX_HISTORY) {
          state.history.shift()
          state.historyIndex--
        }
      })
      return String(apiRel.id)
    } catch (error) {
      showOperationError('创建关系', error)
      return ''
    }
  },

  updateRelation: async (id, data) => {
    try {
      const oldRel = get().relations.find((r) => r.id === id)
      const apiRel = await entityRelationApi.update(id, data)
      set((state) => {
        const idx = state.relations.findIndex((r) => r.id === id)
        if (idx >= 0) state.relations[idx] = apiRel
        state.history.push({
          id: genHistoryId(),
          timestamp: Date.now(),
          entityType: 'character',
          entityId: id,
          action: 'update',
          description: `更新关系 #${id}`,
          snapshot: oldRel ? { ...oldRel } : undefined,
          forwardSnapshot: { ...apiRel },
        })
        state.historyIndex = state.history.length - 1
        state.canUndo = true
        state.canRedo = false
        if (state.history.length > MAX_HISTORY) {
          state.history.shift()
          state.historyIndex--
        }
      })
    } catch (error) {
      showOperationError('更新关系', error)
    }
  },

  deleteRelation: async (id) => {
    try {
      const oldRel = get().relations.find((r) => r.id === id)
      await entityRelationApi.delete(id)
      set((state) => {
        state.relations = state.relations.filter((r) => r.id !== id)
        state.history.push({
          id: genHistoryId(),
          timestamp: Date.now(),
          entityType: 'character',
          entityId: id,
          action: 'delete',
          description: `删除关系 #${id}`,
          snapshot: oldRel,
        })
        state.historyIndex = state.history.length - 1
        state.canUndo = true
        state.canRedo = false
        if (state.history.length > MAX_HISTORY) {
          state.history.shift()
          state.historyIndex--
        }
      })
    } catch (error) {
      showOperationError('删除关系', error)
    }
  },

  getRelationsForEntity: (entityType, entityId) => {
    const { relations } = get()
    return relations.filter(
      (r) =>
        (r.source_type === entityType && r.source_id === entityId) ||
        (r.target_type === entityType && r.target_id === entityId)
    )
  },

  // ---- Item / Location / Faction / WorldSetting / Rule CRUD ----
  // FE-017 Phase 4.2: refactored to use createEntityHandlers factory.
  // The factory returns `{ add, update, remove, getById, list }`; we alias
  // them to `{ addItem, updateItem, deleteItem, ... }` to preserve the
  // public DataSliceActions interface exactly.

  ...(() => {
    const itemH = createEntityHandlers<Item>({ set, get }, {
      entityType: 'item',
      arrayKey: 'items',
      apiClient: itemApi,
      addLabel: '创建物品',
      updateLabel: '更新物品',
      deleteLabel: '删除物品',
    })
    const locationH = createEntityHandlers<Location>({ set, get }, {
      entityType: 'location',
      arrayKey: 'locations',
      apiClient: locationApi,
      addLabel: '创建地点',
      updateLabel: '更新地点',
      deleteLabel: '删除地点',
    })
    const factionH = createEntityHandlers<Faction>({ set, get }, {
      entityType: 'faction',
      arrayKey: 'factions',
      apiClient: factionApi,
      addLabel: '创建势力',
      updateLabel: '更新势力',
      deleteLabel: '删除势力',
    })
    const worldSettingH = createEntityHandlers<WorldSetting>({ set, get }, {
      entityType: 'world',
      arrayKey: 'worldSettings',
      apiClient: worldSettingApi,
      addLabel: '创建世界观',
      updateLabel: '更新世界观',
      deleteLabel: '删除世界观',
    })
    const ruleH = createEntityHandlers<Rule>({ set, get }, {
      entityType: 'rule',
      arrayKey: 'rules',
      apiClient: ruleApi,
      addLabel: '创建规则',
      updateLabel: '更新规则',
      deleteLabel: '删除规则',
    })
    return {
      addItem: itemH.add,
      updateItem: itemH.update,
      deleteItem: itemH.remove,
      addLocation: locationH.add,
      updateLocation: locationH.update,
      deleteLocation: locationH.remove,
      addFaction: factionH.add,
      updateFaction: factionH.update,
      deleteFaction: factionH.remove,
      addWorldSetting: worldSettingH.add,
      updateWorldSetting: worldSettingH.update,
      deleteWorldSetting: worldSettingH.remove,
      addRule: ruleH.add,
      updateRule: ruleH.update,
      deleteRule: ruleH.remove,
    }
  })(),

  // ---- Outline ----

  setOutline: async (outline) => {
    try {
      const apiOutline = await outlineApi.create(outline)
      set((state) => {
        state.outline = apiOutline
        state.chapters = []
      })
    } catch (error) {
      showOperationError('创建大纲', error)
    }
  },

  updateOutline: async (updates) => {
    const currentOutline = get().outline
    if (!currentOutline) return
    try {
      const updated = await outlineApi.update(currentOutline.id, updates)
      set((state) => {
        state.outline = updated
      })
    } catch (error) {
      showOperationError('更新大纲', error)
    }
  },

  addChapter: async (chapter) => {
    if (!get().outline) return
    try {
      const apiChapter = await chapterApi.create({
        ...chapter,
        outline_id: get().outline!.id,
      })
      set((state) => { state.chapters.push(apiChapter) })
    } catch (error) {
      showOperationError('创建章节', error)
    }
  },

  updateChapter: async (id, updates) => {
    try {
      await chapterApi.update(id, updates)
      set((state) => {
        const ch = state.chapters.find((c) => c.id === id)
        if (ch) Object.assign(ch, updates)
      })
    } catch (error) {
      showOperationError('更新章节', error)
    }
  },

  deleteChapter: async (id) => {
    try {
      await chapterApi.delete(id)
      set((state) => {
        state.chapters = state.chapters.filter((c) => c.id !== id)
      })
    } catch (error) {
      showOperationError('删除章节', error)
    }
  },

  // ---- IFLine ----

  addIFLine: async (ifLine) => {
    try {
      const apiIF = await ifLineApi.create(ifLine)
      set((state) => { state.ifLines.push(apiIF) })
    } catch (error) {
      showOperationError('创建IF线', error)
    }
  },

  updateIFLine: async (id, updates) => {
    try {
      await ifLineApi.update(id, updates)
      set((state) => {
        const line = state.ifLines.find((i) => i.id === id)
        if (line) Object.assign(line, updates)
      })
    } catch (error) {
      showOperationError('更新IF线', error)
    }
  },

  deleteIFLine: async (id) => {
    try {
      await ifLineApi.delete(id)
      set((state) => {
        state.ifLines = state.ifLines.filter((i) => i.id !== id)
      })
    } catch (error) {
      showOperationError('删除IF线', error)
    }
  },

  // ---- Batch Operations ----

  importFromChat: async (entities) => {
    if (!entities || entities.length === 0) return
    try {
      const state = get()
      for (const { type, name, description } of entities) {
        if (!name?.trim()) continue
        const trimmedName = name.trim()
        switch (type) {
          case 'character':
            if (state.characters.some((c) => c.name === trimmedName)) continue
            await get().addCharacter({ name: trimmedName, description, tier: 'supporting', tags: [] })
            break
          case 'item':
            if (state.items.some((i) => i.name === trimmedName)) continue
            await get().addItem({ name: trimmedName, description })
            break
          case 'location':
            if (state.locations.some((l) => l.name === trimmedName)) continue
            await get().addLocation({ name: trimmedName, description, importance: 'minor' })
            break
          case 'faction':
            if (state.factions.some((f) => f.name === trimmedName)) continue
            await get().addFaction({ name: trimmedName, description, type: 'other' })
            break
          case 'world':
            if (state.worldSettings.some((w) => w.name === trimmedName)) continue
            await get().addWorldSetting({ name: trimmedName, description: description || '' })
            break
          case 'rule':
            if (state.rules.some((r) => r.name === trimmedName)) continue
            await get().addRule({ name: trimmedName, description: description || '', type: 'other' })
            break
          case 'outline':
            if (state.outline) continue
            await get().setOutline({ id: Date.now(), title: trimmedName, description: description || '' })
            break
          case 'ifline':
            if (state.ifLines.some((i) => i.title === trimmedName)) continue
            await get().addIFLine({ title: trimmedName, description: description || '', sync_mode: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            break
          case 'plot_point':
          case 'chapter':
          case 'plot_thread': {
            // Convert story structure entries to outline if none exists yet
            if (!state.outline) {
              await get().setOutline({ id: Date.now(), title: trimmedName, description: description || '' })
            }
            break
          }
        }
      }
    } catch (error) {
      showOperationError('从聊天导入', error)
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

  // ---- Undo/Redo ----

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < 0) return

    const entry = history[historyIndex]
    set((state) => {
      state.historyIndex--
      state.canUndo = state.historyIndex >= 0
      state.canRedo = true
    })

    if (entry.snapshot && entry.action === 'update') {
      const arrName = entityTypeToArrayName(entry.entityType)
      if (arrName) {
        set((state) => {
          const arr = state[arrName] as Array<{ id: number }>
          const idx = arr.findIndex((e) => e.id === entry.entityId)
          if (idx >= 0) {
            ;(arr as unknown[])[idx] = { ...(entry.snapshot as object) }
          }
        })
      }
    } else if (entry.snapshot && entry.action === 'delete') {
      const arrName = entityTypeToArrayName(entry.entityType)
      if (arrName) {
        set((state) => {
          ;(state[arrName] as unknown[]).push({ ...(entry.snapshot as object) })
        })
      }
    }
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return

    const nextEntry = history[historyIndex + 1]
    set((state) => {
      state.historyIndex++
      state.canUndo = true
      state.canRedo = state.historyIndex < state.history.length - 1
    })

    if (nextEntry.forwardSnapshot && nextEntry.action === 'update') {
      const arrName = entityTypeToArrayName(nextEntry.entityType)
      if (arrName) {
        set((state) => {
          const arr = state[arrName] as Array<{ id: number }>
          const idx = arr.findIndex((e) => e.id === nextEntry.entityId)
          if (idx >= 0) {
            ;(arr as unknown[])[idx] = { ...(nextEntry.forwardSnapshot as object) }
          }
        })
      }
    } else if (nextEntry.action === 'delete') {
      const arrName = entityTypeToArrayName(nextEntry.entityType)
      if (arrName) {
        set((state) => {
          const arr = state[arrName] as Array<{ id: number }>
          const idx = arr.findIndex((e) => e.id === nextEntry.entityId)
          if (idx >= 0) {
            ;(state[arrName] as unknown[]).splice(idx, 1)
          }
        })
      }
    }
  },

  clearHistory: () => {
    set((state) => {
      state.history = []
      state.historyIndex = -1
      state.canUndo = false
      state.canRedo = false
    })
  },
} as DataSlice }

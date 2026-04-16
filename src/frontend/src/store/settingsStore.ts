import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 实体类型
export type EntityType = 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule' | 'outline' | 'ifline'

export interface Character {
  id: string
  name: string
  gender?: string
  personality?: string
  desires?: string
  flaws?: string
  description?: string
  tier: 'core' | 'supporting' | 'minor'
  cultivationRealm?: string // 修仙境界
  relationships: Relationship[]
  storylines: CharacterStoryline[]
}

export interface Relationship {
  id: string
  targetId: string
  type: 'family' | 'friend' | 'enemy' | 'master' | ' disciple' | 'rival' | 'romantic' | 'other'
  description?: string
}

export interface CharacterStoryline {
  id: string
  title: string
  arc: string
  progress: number // 0-100
}

export interface Item {
  id: string
  name: string
  description?: string
  owner?: string
  location?: string
}

export interface Location {
  id: string
  name: string
  description?: string
  importance: 'major' | 'minor'
}

export interface Faction {
  id: string
  name: string
  description?: string
  type: 'sect' | 'clan' | 'nation' | 'enterprise' | 'other'
}

export interface WorldSetting {
  id: string
  type: 'world'
  name: string
  description: string
  details: Record<string, string>
}

export interface Rule {
  id: string
  name: string
  description: string
  type: 'cultivation' | 'magic' | 'social' | 'other'
}

export interface Outline {
  id: string
  title: string
  description?: string
  chapters: Chapter[]
}

export interface Chapter {
  id: string
  title: string
  summary?: string
  status: 'planning' | 'writing' | 'completed'
  wordCount: number
}

export interface IFLine {
  id: string
  title: string
  linkedCharacterId: string
  description?: string
  syncMode: 'auto' | 'manual'
}

interface SettingsState {
  // 角色
  characters: Character[]
  // 物品
  items: Item[]
  // 地点
  locations: Location[]
  // 势力
  factions: Faction[]
  // 世界观
  worldSettings: WorldSetting[]
  // 规则
  rules: Rule[]
  // 大纲
  outline: Outline | null
  // IF线
  ifLines: IFLine[]
}

interface SettingsActions {
  // AI生成
  generate: () => void
  generateRelations: () => void

  // 角色 CRUD
  addCharacter: (character: Omit<Character, 'id' | 'relationships' | 'storylines'>) => string
  updateCharacter: (id: string, updates: Partial<Character>) => void
  deleteCharacter: (id: string) => void
  addRelationship: (characterId: string, relationship: Omit<Relationship, 'id'>) => void
  removeRelationship: (characterId: string, relationshipId: string) => void
  updateStorylineProgress: (characterId: string, storylineId: string, progress: number) => void

  // 物品 CRUD
  addItem: (item: Omit<Item, 'id'>) => string
  updateItem: (id: string, updates: Partial<Item>) => void
  deleteItem: (id: string) => void

  // 地点 CRUD
  addLocation: (location: Omit<Location, 'id'>) => string
  updateLocation: (id: string, updates: Partial<Location>) => void
  deleteLocation: (id: string) => void

  // 势力 CRUD
  addFaction: (faction: Omit<Faction, 'id'>) => string
  updateFaction: (id: string, updates: Partial<Faction>) => void
  deleteFaction: (id: string) => void

  // 世界观 CRUD
  addWorldSetting: (setting: Omit<WorldSetting, 'id'>) => void
  updateWorldSetting: (id: string, updates: Partial<WorldSetting>) => void
  deleteWorldSetting: (id: string) => void

  // 规则 CRUD
  addRule: (rule: Omit<Rule, 'id'>) => void
  updateRule: (id: string, updates: Partial<Rule>) => void
  deleteRule: (id: string) => void

  // 大纲
  setOutline: (outline: Outline) => void
  addChapter: (chapter: Omit<Chapter, 'id'>) => void
  updateChapter: (id: string, updates: Partial<Chapter>) => void
  deleteChapter: (id: string) => void

  // IF线
  addIFLine: (ifLine: Omit<IFLine, 'id'>) => void
  updateIFLine: (id: string, updates: Partial<IFLine>) => void
  deleteIFLine: (id: string) => void

  // 批量导入（从聊天提取的实体）
  importFromChat: (entities: Array<{ type: EntityType; name: string; description?: string }>) => void
}

let idCounter = 0
const generateId = (prefix: string) => `${prefix}-${++idCounter}`

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      // AI生成
      generate: () => {
        console.log('[AI生成] 触发智能生成...')
      },
      generateRelations: () => {
        console.log('[AI生成] 触发关系生成...')
      },

      // 初始状态
      characters: [],
      items: [],
      locations: [],
      factions: [],
      worldSettings: [],
      rules: [],
      outline: null,
      ifLines: [],

      // 角色 CRUD
      addCharacter: (character) => {
        const id = generateId('char')
        const newCharacter: Character = {
          ...character,
          id,
          relationships: [],
          storylines: [],
        }
        set((state) => ({ characters: [...state.characters, newCharacter] }))
        return id
      },
      updateCharacter: (id, updates) =>
        set((state) => ({
          characters: state.characters.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      deleteCharacter: (id) =>
        set((state) => ({
          characters: state.characters.filter((c) => c.id !== id),
        })),
      addRelationship: (characterId, relationship) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === characterId
              ? { ...c, relationships: [...c.relationships, { ...relationship, id: generateId('rel') }] }
              : c
          ),
        })),
      removeRelationship: (characterId, relationshipId) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === characterId
              ? { ...c, relationships: c.relationships.filter((r) => r.id !== relationshipId) }
              : c
          ),
        })),
      updateStorylineProgress: (characterId, storylineId, progress) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === characterId
              ? {
                  ...c,
                  storylines: c.storylines.map((s) =>
                    s.id === storylineId ? { ...s, progress } : s
                  ),
                }
              : c
          ),
        })),

      // 物品 CRUD
      addItem: (item) => {
        const id = generateId('item')
        set((state) => ({ items: [...state.items, { ...item, id }] }))
        return id
      },
      updateItem: (id, updates) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      deleteItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      // 地点 CRUD
      addLocation: (location) => {
        const id = generateId('loc')
        set((state) => ({ locations: [...state.locations, { ...location, id }] }))
        return id
      },
      updateLocation: (id, updates) =>
        set((state) => ({
          locations: state.locations.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        })),
      deleteLocation: (id) => set((state) => ({ locations: state.locations.filter((l) => l.id !== id) })),

      // 势力 CRUD
      addFaction: (faction) => {
        const id = generateId('fac')
        set((state) => ({ factions: [...state.factions, { ...faction, id }] }))
        return id
      },
      updateFaction: (id, updates) =>
        set((state) => ({
          factions: state.factions.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        })),
      deleteFaction: (id) => set((state) => ({ factions: state.factions.filter((f) => f.id !== id) })),

      // 世界观 CRUD
      addWorldSetting: (setting) => {
        const id = generateId('world')
        set((state) => ({ worldSettings: [...state.worldSettings, { ...setting, id }] }))
      },
      updateWorldSetting: (id, updates) =>
        set((state) => ({
          worldSettings: state.worldSettings.map((w) => (w.id === id ? { ...w, ...updates } : w)),
        })),
      deleteWorldSetting: (id) =>
        set((state) => ({ worldSettings: state.worldSettings.filter((w) => w.id !== id) })),

      // 规则 CRUD
      addRule: (rule) => {
        const id = generateId('rule')
        set((state) => ({ rules: [...state.rules, { ...rule, id }] }))
      },
      updateRule: (id, updates) =>
        set((state) => ({
          rules: state.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      deleteRule: (id) => set((state) => ({ rules: state.rules.filter((r) => r.id !== id) })),

      // 大纲
      setOutline: (outline) => set({ outline }),
      addChapter: (chapter) =>
        set((state) => {
          if (!state.outline) return {}
          return {
            outline: {
              ...state.outline,
              chapters: [...state.outline.chapters, { ...chapter, id: generateId('ch') }],
            },
          }
        }),
      updateChapter: (id, updates) =>
        set((state) => {
          if (!state.outline) return {}
          return {
            outline: {
              ...state.outline,
              chapters: state.outline.chapters.map((c) => (c.id === id ? { ...c, ...updates } : c)),
            },
          }
        }),
      deleteChapter: (id) =>
        set((state) => {
          if (!state.outline) return {}
          return {
            outline: {
              ...state.outline,
              chapters: state.outline.chapters.filter((c) => c.id !== id),
            },
          }
        }),

      // IF线
      addIFLine: (ifLine) => {
        const id = generateId('ifline')
        set((state) => ({ ifLines: [...state.ifLines, { ...ifLine, id }] }))
      },
      updateIFLine: (id, updates) =>
        set((state) => ({
          ifLines: state.ifLines.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      deleteIFLine: (id) => set((state) => ({ ifLines: state.ifLines.filter((i) => i.id !== id) })),

      // 批量导入
      importFromChat: (entities) => {
        const state = get()
        entities.forEach(({ type, name, description }) => {
          switch (type) {
            case 'character':
              state.addCharacter({ name, description, tier: 'supporting' })
              break
            case 'item':
              state.addItem({ name, description })
              break
            case 'location':
              state.addLocation({ name, description, importance: 'minor' })
              break
            case 'faction':
              state.addFaction({ name, description, type: 'other' })
              break
            case 'world':
              state.addWorldSetting({ type: 'world', name, description: description || '', details: {} })
              break
            case 'rule':
              state.addRule({ name, description: description || '', type: 'other' })
              break
          }
        })
      },
    }),
    {
      name: 'writer-settings-store',
    }
  )
)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  characterApi,
  relationshipApi,
  storylineApi,
  itemApi,
  locationApi,
  factionApi,
  worldSettingApi,
  ruleApi,
  outlineApi,
  chapterApi,
  ifLineApi,
  aiGenerateApi,
} from '../api/settings';
import { aiReviewApi, AIReviewResult } from '../api/aiReview';
import type {
  Character,
  Item,
  Location,
  Faction,
  WorldSetting,
  Rule,
  Outline,
  Chapter,
  IFLine,
  EntityType,
} from '../shared/types';

// Re-export EntityType for external usage
export type { EntityType } from '../shared/types';

// 本地关系类型（用于UI）
export interface Relationship {
  id: number;
  targetId: number;
  type: 'family' | 'friend' | 'enemy' | 'master' | 'disciple' | 'rival' | 'romantic' | 'other';
  description?: string;
}

// 本地角色类型（用于UI）
export interface CharacterLocal {
  id: number;
  name: string;
  gender?: string;
  personality?: string;
  desires?: string;
  flaws?: string;
  description?: string;
  tier: 'core' | 'supporting' | 'minor';
  cultivationRealm?: string;
  relationships: Relationship[];
  storylines: CharacterStorylineLocal[];
  tags: string[];
}

// 本地剧情线类型
export interface CharacterStorylineLocal {
  id: number;
  title: string;
  arc: string;
  progress: number;
}

// 标签类型
export interface Tag {
  id: string;
  name: string;
  color?: string;
}

// 带标签的实体基础接口
export interface TaggedEntity {
  tags: string[];
}

interface SettingsState {
  // 角色
  characters: CharacterLocal[];
  // 物品
  items: Item[];
  // 地点
  locations: Location[];
  // 势力
  factions: Faction[];
  // 世界观
  worldSettings: WorldSetting[];
  // 规则
  rules: Rule[];
  // 大纲
  outline: Outline | null;
  chapters: Chapter[];
  // IF线
  ifLines: IFLine[];

  // Loading状态
  isLoading: boolean;
  error: string | null;

  // AI审查结果
  aiReviewResult: AIReviewResult | null;

  // 标签系统
  tags: Tag[];
}

interface SettingsActions {
  // 数据加载
  loadAll: () => Promise<void>;
  loadCategoryData: (category: EntityType) => Promise<void>;

  // AI生成
  generate: (type: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule', context?: string) => Promise<void>;
  generateRelations: () => Promise<void>;
  reviewWithAI: (category: EntityType) => Promise<void>;

  // 角色 CRUD
  addCharacter: (character: Omit<CharacterLocal, 'id' | 'relationships' | 'storylines'>) => Promise<string>;
  updateCharacter: (id: number, updates: Partial<CharacterLocal>) => Promise<void>;
  deleteCharacter: (id: number) => Promise<void>;
  addRelationship: (characterId: number, relationship: Omit<Relationship, 'id'>) => Promise<void>;
  removeRelationship: (characterId: number, relationshipId: number) => Promise<void>;
  updateStorylineProgress: (characterId: number, storylineId: number, progress: number) => Promise<void>;

  // 物品 CRUD
  addItem: (item: Omit<Item, 'id'>) => Promise<string>;
  updateItem: (id: number, updates: Partial<Item>) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;

  // 地点 CRUD
  addLocation: (location: Omit<Location, 'id'>) => Promise<string>;
  updateLocation: (id: number, updates: Partial<Location>) => Promise<void>;
  deleteLocation: (id: number) => Promise<void>;

  // 势力 CRUD
  addFaction: (faction: Omit<Faction, 'id'>) => Promise<string>;
  updateFaction: (id: number, updates: Partial<Faction>) => Promise<void>;
  deleteFaction: (id: number) => Promise<void>;

  // 世界观 CRUD
  addWorldSetting: (setting: Omit<WorldSetting, 'id'>) => Promise<void>;
  updateWorldSetting: (id: number, updates: Partial<WorldSetting>) => Promise<void>;
  deleteWorldSetting: (id: number) => Promise<void>;

  // 规则 CRUD
  addRule: (rule: Omit<Rule, 'id'>) => Promise<void>;
  updateRule: (id: number, updates: Partial<Rule>) => Promise<void>;
  deleteRule: (id: number) => Promise<void>;

  // 大纲
  setOutline: (outline: Outline) => Promise<void>;
  addChapter: (chapter: Omit<Chapter, 'id'>) => Promise<void>;
  updateChapter: (id: number, updates: Partial<Chapter>) => Promise<void>;
  deleteChapter: (id: number) => Promise<void>;

  // IF线
  addIFLine: (ifLine: Omit<IFLine, 'id'>) => Promise<void>;
  updateIFLine: (id: number, updates: Partial<IFLine>) => Promise<void>;
  deleteIFLine: (id: number) => Promise<void>;

  // 批量导入（从聊天提取的实体）
  importFromChat: (entities: Array<{ type: EntityType; name: string; description?: string }>) => Promise<void>;

  // 标签管理
  addTag: (name: string, color?: string) => void;
  removeTag: (tagId: string) => void;
  addTagToEntity: (entityType: EntityType, entityId: number, tagName: string) => void;
  removeTagFromEntity: (entityType: EntityType, entityId: number, tagName: string) => void;

  // 搜索
  searchEntities: (query: string, type?: EntityType | 'all') => Array<{ type: EntityType; id: number; name: string; description?: string; matchScore: number }>;
}

// 将API Character转换为本地Character
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
});

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
    // 初始状态
    characters: [],
    items: [],
    locations: [],
    factions: [],
    worldSettings: [],
    rules: [],
    outline: null,
    chapters: [],
    ifLines: [],
    isLoading: false,
    error: null,
    aiReviewResult: null,
    tags: [],

    // 加载所有数据
    loadAll: async () => {
      set({ isLoading: true, error: null });
      try {
        const [characters, items, locations, factions, worldSettings, rules, outlines, ifLines] =
          await Promise.all([
            characterApi.list(),
            itemApi.list(),
            locationApi.list(),
            factionApi.list(),
            worldSettingApi.list(),
            ruleApi.list(),
            outlineApi.list(),
            ifLineApi.list(),
          ]);

        // 转换角色并加载关系和剧情线
        const charactersWithRelations = await Promise.all(
          characters.map(async (apiChar) => {
            const localChar = toLocalCharacter(apiChar);
            try {
              const [relationships, storylines] = await Promise.all([
                relationshipApi.getByCharacter(apiChar.id),
                storylineApi.getByCharacter(apiChar.id),
              ]);
              localChar.relationships = relationships.map((r) => ({
                id: r.id,
                targetId: r.target_id,
                type: r.type as Relationship['type'],
                description: r.description,
              }));
              localChar.storylines = storylines.map((s) => ({
                id: s.id,
                title: s.title,
                arc: s.arc || '',
                progress: s.progress,
              }));
            } catch {
              // 关系或剧情线获取失败，使用空数组
            }
            return localChar;
          })
        );

        // 获取大纲和章节
        let outline: Outline | null = null;
        let chapters: Chapter[] = [];
        if (outlines.length > 0) {
          outline = outlines[0];
          chapters = await chapterApi.list(outline.id);
        }

        set({
          characters: charactersWithRelations,
          items,
          locations,
          factions,
          worldSettings,
          rules,
          outline,
          chapters,
          ifLines,
          isLoading: false,
        });
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
      }
    },

    // 按分类加载数据
    loadCategoryData: async (category: EntityType) => {
      set({ isLoading: true, error: null });
      try {
        switch (category) {
          case 'character': {
            const characters = await characterApi.list();
            const charactersWithRelations = await Promise.all(
              characters.map(async (apiChar) => {
                const localChar = toLocalCharacter(apiChar);
                try {
                  const [relationships, storylines] = await Promise.all([
                    relationshipApi.getByCharacter(apiChar.id),
                    storylineApi.getByCharacter(apiChar.id),
                  ]);
                  localChar.relationships = relationships.map((r) => ({
                    id: r.id,
                    targetId: r.target_id,
                    type: r.type as Relationship['type'],
                    description: r.description,
                  }));
                  localChar.storylines = storylines.map((s) => ({
                    id: s.id,
                    title: s.title,
                    arc: s.arc || '',
                    progress: s.progress,
                  }));
                } catch {
                  // 关系或剧情线获取失败，使用空数组
                }
                return localChar;
              })
            );
            set({ characters: charactersWithRelations });
            break;
          }
          case 'item': {
            const items = await itemApi.list();
            set({ items });
            break;
          }
          case 'location': {
            const locations = await locationApi.list();
            set({ locations });
            break;
          }
          case 'faction': {
            const factions = await factionApi.list();
            set({ factions });
            break;
          }
          case 'world': {
            const worldSettings = await worldSettingApi.list();
            set({ worldSettings });
            break;
          }
          case 'rule': {
            const rules = await ruleApi.list();
            set({ rules });
            break;
          }
          case 'outline': {
            const outlines = await outlineApi.list();
            let outline: Outline | null = null;
            let chapters: Chapter[] = [];
            if (outlines.length > 0) {
              outline = outlines[0];
              chapters = await chapterApi.list(outline.id);
            }
            set({ outline, chapters });
            break;
          }
          case 'ifline': {
            const ifLines = await ifLineApi.list();
            set({ ifLines });
            break;
          }
        }
        set({ isLoading: false });
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
      }
    },

    // AI审查
    reviewWithAI: async (category: EntityType) => {
      try {
        const result = await aiReviewApi.review(category);
        set({ aiReviewResult: result });
      } catch (error) {
        set({ error: (error as Error).message });
      }
    },

    // AI生成
    generate: async (type, context) => {
      try {
        await aiGenerateApi.generate({ type, context });
      } catch (error) {
        set({ error: (error as Error).message });
      }
    },

    generateRelations: async () => {
      const { characters } = get();
      if (characters.length < 2) {
        set({ error: '需要至少2个角色才能生成关系' });
        return;
      }
      try {
        const apiCharacters = await characterApi.list();
        await aiGenerateApi.generateRelations(apiCharacters);
        // 刷新关系数据
        const charactersWithRelations = await Promise.all(
          characters.map(async (localChar) => {
            const relationships = await relationshipApi.getByCharacter(localChar.id);
            return {
              ...localChar,
              relationships: relationships.map((r) => ({
                id: r.id,
                targetId: r.target_id,
                type: r.type as Relationship['type'],
                description: r.description,
              })),
            };
          })
        );
        set({ characters: charactersWithRelations });
      } catch (error) {
        set({ error: (error as Error).message });
      }
    },

    // 角色 CRUD
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
      });
      const newCharacter: CharacterLocal = {
        ...toLocalCharacter(apiChar),
        relationships: [],
        storylines: [],
      };
      set((state) => ({ characters: [...state.characters, newCharacter] }));
      return String(apiChar.id);
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
      });
      set((state) => ({
        characters: state.characters.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }));
    },

    deleteCharacter: async (id) => {
      await characterApi.delete(id);
      set((state) => ({
        characters: state.characters.filter((c) => c.id !== id),
      }));
    },

    addRelationship: async (characterId, relationship) => {
      const apiRel = await relationshipApi.create(characterId, {
        target_id: relationship.targetId,
        type: relationship.type,
        description: relationship.description,
      });
      const newRel: Relationship = {
        id: apiRel.id,
        targetId: apiRel.target_id,
        type: apiRel.type as Relationship['type'],
        description: apiRel.description,
      };
      set((state) => ({
        characters: state.characters.map((c) =>
          c.id === characterId
            ? { ...c, relationships: [...c.relationships, newRel] }
            : c
        ),
      }));
    },

    removeRelationship: async (characterId, relationshipId) => {
      await relationshipApi.delete(characterId, relationshipId);
      set((state) => ({
        characters: state.characters.map((c) =>
          c.id === characterId
            ? { ...c, relationships: c.relationships.filter((r) => r.id !== relationshipId) }
            : c
        ),
      }));
    },

    updateStorylineProgress: async (characterId, storylineId, progress) => {
      await storylineApi.update(characterId, storylineId, { progress });
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
      }));
    },

    // 物品 CRUD
    addItem: async (item) => {
      const apiItem = await itemApi.create(item);
      set((state) => ({ items: [...state.items, apiItem] }));
      return String(apiItem.id);
    },

    updateItem: async (id, updates) => {
      await itemApi.update(id, updates);
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
    },

    deleteItem: async (id) => {
      await itemApi.delete(id);
      set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
    },

    // 地点 CRUD
    addLocation: async (location) => {
      const apiLoc = await locationApi.create(location);
      set((state) => ({ locations: [...state.locations, apiLoc] }));
      return String(apiLoc.id);
    },

    updateLocation: async (id, updates) => {
      await locationApi.update(id, updates);
      set((state) => ({
        locations: state.locations.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      }));
    },

    deleteLocation: async (id) => {
      await locationApi.delete(id);
      set((state) => ({ locations: state.locations.filter((l) => l.id !== id) }));
    },

    // 势力 CRUD
    addFaction: async (faction) => {
      const apiFac = await factionApi.create(faction);
      set((state) => ({ factions: [...state.factions, apiFac] }));
      return String(apiFac.id);
    },

    updateFaction: async (id, updates) => {
      await factionApi.update(id, updates);
      set((state) => ({
        factions: state.factions.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      }));
    },

    deleteFaction: async (id) => {
      await factionApi.delete(id);
      set((state) => ({ factions: state.factions.filter((f) => f.id !== id) }));
    },

    // 世界观 CRUD
    addWorldSetting: async (setting) => {
      const apiWS = await worldSettingApi.create(setting);
      set((state) => ({ worldSettings: [...state.worldSettings, apiWS] }));
    },

    updateWorldSetting: async (id, updates) => {
      await worldSettingApi.update(id, updates);
      set((state) => ({
        worldSettings: state.worldSettings.map((w) =>
          w.id === id ? { ...w, ...updates } : w
        ),
      }));
    },

    deleteWorldSetting: async (id) => {
      await worldSettingApi.delete(id);
      set((state) => ({
        worldSettings: state.worldSettings.filter((w) => w.id !== id),
      }));
    },

    // 规则 CRUD
    addRule: async (rule) => {
      const apiRule = await ruleApi.create(rule);
      set((state) => ({ rules: [...state.rules, apiRule] }));
    },

    updateRule: async (id, updates) => {
      await ruleApi.update(id, updates);
      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      }));
    },

    deleteRule: async (id) => {
      await ruleApi.delete(id);
      set((state) => ({ rules: state.rules.filter((r) => r.id !== id) }));
    },

    // 大纲
    setOutline: async (outline) => {
      const apiOutline = await outlineApi.create(outline);
      set({ outline: apiOutline, chapters: [] });
    },

    addChapter: async (chapter) => {
      if (!get().outline) return;
      const apiChapter = await chapterApi.create({
        ...chapter,
        outline_id: get().outline!.id,
      });
      set((state) => ({ chapters: [...state.chapters, apiChapter] }));
    },

    updateChapter: async (id, updates) => {
      await chapterApi.update(id, updates);
      set((state) => ({
        chapters: state.chapters.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }));
    },

    deleteChapter: async (id) => {
      await chapterApi.delete(id);
      set((state) => ({ chapters: state.chapters.filter((c) => c.id !== id) }));
    },

    // IF线
    addIFLine: async (ifLine) => {
      const apiIF = await ifLineApi.create(ifLine);
      set((state) => ({ ifLines: [...state.ifLines, apiIF] }));
    },

    updateIFLine: async (id, updates) => {
      await ifLineApi.update(id, updates);
      set((state) => ({
        ifLines: state.ifLines.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
    },

    deleteIFLine: async (id) => {
      await ifLineApi.delete(id);
      set((state) => ({ ifLines: state.ifLines.filter((i) => i.id !== id) }));
    },

    // 批量导入
    importFromChat: async (entities) => {
      for (const { type, name, description } of entities) {
        switch (type) {
          case 'character':
            await get().addCharacter({ name, description, tier: 'supporting', tags: [] });
            break;
          case 'item':
            await get().addItem({ name, description });
            break;
          case 'location':
            await get().addLocation({ name, description, importance: 'minor' });
            break;
          case 'faction':
            await get().addFaction({ name, description, type: 'other' });
            break;
          case 'world':
            await get().addWorldSetting({ name, description: description || '' });
            break;
          case 'rule':
            await get().addRule({ name, description: description || '', type: 'other' });
            break;
        }
      }
    },

    // 标签管理
    addTag: (name, color) => {
      const newTag: Tag = { id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, name, color };
      set((state) => ({ tags: [...state.tags, newTag] }));
    },

    removeTag: (tagId) => {
      set((state) => ({ tags: state.tags.filter((t) => t.id !== tagId) }));
    },

    addTagToEntity: (entityType, entityId, tagName) => {
      set((state) => {
        const newState = { ...state };
        switch (entityType) {
          case 'character':
            newState.characters = state.characters.map((c) =>
              c.id === entityId ? { ...c, tags: [...c.tags, tagName] } : c
            );
            break;
          case 'item':
            newState.items = state.items.map((i) =>
              i.id === entityId ? { ...i, tags: [...(i.tags || []), tagName] } : i
            );
            break;
          case 'location':
            newState.locations = state.locations.map((l) =>
              l.id === entityId ? { ...l, tags: [...(l.tags || []), tagName] } : l
            );
            break;
          case 'faction':
            newState.factions = state.factions.map((f) =>
              f.id === entityId ? { ...f, tags: [...(f.tags || []), tagName] } : f
            );
            break;
          case 'world':
            newState.worldSettings = state.worldSettings.map((w) =>
              w.id === entityId ? { ...w, tags: [...(w.tags || []), tagName] } : w
            );
            break;
          case 'rule':
            newState.rules = state.rules.map((r) =>
              r.id === entityId ? { ...r, tags: [...(r.tags || []), tagName] } : r
            );
            break;
          case 'ifline':
            newState.ifLines = state.ifLines.map((i) =>
              i.id === entityId ? { ...i, tags: [...(i.tags || []), tagName] } : i
            );
            break;
        }
        return newState;
      });
    },

    removeTagFromEntity: (entityType, entityId, tagName) => {
      set((state) => {
        const newState = { ...state };
        switch (entityType) {
          case 'character':
            newState.characters = state.characters.map((c) =>
              c.id === entityId ? { ...c, tags: c.tags.filter((t) => t !== tagName) } : c
            );
            break;
          case 'item':
            newState.items = state.items.map((i) =>
              i.id === entityId ? { ...i, tags: (i.tags || []).filter((t) => t !== tagName) } : i
            );
            break;
          case 'location':
            newState.locations = state.locations.map((l) =>
              l.id === entityId ? { ...l, tags: (l.tags || []).filter((t) => t !== tagName) } : l
            );
            break;
          case 'faction':
            newState.factions = state.factions.map((f) =>
              f.id === entityId ? { ...f, tags: (f.tags || []).filter((t) => t !== tagName) } : f
            );
            break;
          case 'world':
            newState.worldSettings = state.worldSettings.map((w) =>
              w.id === entityId ? { ...w, tags: (w.tags || []).filter((t) => t !== tagName) } : w
            );
            break;
          case 'rule':
            newState.rules = state.rules.map((r) =>
              r.id === entityId ? { ...r, tags: (r.tags || []).filter((t) => t !== tagName) } : r
            );
            break;
          case 'ifline':
            newState.ifLines = state.ifLines.map((i) =>
              i.id === entityId ? { ...i, tags: (i.tags || []).filter((t) => t !== tagName) } : i
            );
            break;
        }
        return newState;
      });
    },

    // 搜索
    searchEntities: (query, type = 'all') => {
      const state = get();
      const results: Array<{ type: EntityType; id: number; name: string; description?: string; matchScore: number }> = [];
      const q = query.toLowerCase().trim();
      if (!q) return results;

      const searchInNamed = (entities: Array<{ id: number; name: string; description?: string; tags?: string[] }>, entityType: EntityType) => {
        entities.forEach((entity) => {
          let score = 0;
          const nameLower = entity.name.toLowerCase();
          const descLower = entity.description?.toLowerCase() || '';
          const tagsLower = entity.tags?.map((t) => t.toLowerCase()) || [];

          if (nameLower === q) score += 100;
          else if (nameLower.startsWith(q)) score += 80;
          else if (nameLower.includes(q)) score += 60;

          if (descLower.includes(q)) score += 30;

          tagsLower.forEach((tag) => {
            if (tag === q) score += 50;
            else if (tag.includes(q)) score += 25;
          });

          if (score > 0) {
            results.push({ type: entityType, id: entity.id, name: entity.name, description: entity.description, matchScore: score });
          }
        });
      };

      const searchInIFLines = () => {
        state.ifLines.forEach((entity) => {
          let score = 0;
          const nameLower = entity.title.toLowerCase();
          const descLower = entity.description?.toLowerCase() || '';
          const tagsLower = entity.tags?.map((t) => t.toLowerCase()) || [];

          if (nameLower === q) score += 100;
          else if (nameLower.startsWith(q)) score += 80;
          else if (nameLower.includes(q)) score += 60;

          if (descLower.includes(q)) score += 30;

          tagsLower.forEach((tag) => {
            if (tag === q) score += 50;
            else if (tag.includes(q)) score += 25;
          });

          if (score > 0) {
            results.push({ type: 'ifline' as EntityType, id: entity.id, name: entity.title, description: entity.description, matchScore: score });
          }
        });
      };

      if (type === 'all' || type === 'character') searchInNamed(state.characters, 'character');
      if (type === 'all' || type === 'item') searchInNamed(state.items, 'item');
      if (type === 'all' || type === 'location') searchInNamed(state.locations, 'location');
      if (type === 'all' || type === 'faction') searchInNamed(state.factions, 'faction');
      if (type === 'all' || type === 'world') searchInNamed(state.worldSettings, 'world');
      if (type === 'all' || type === 'rule') searchInNamed(state.rules, 'rule');
      if (type === 'all' || type === 'ifline') searchInIFLines();

      return results.sort((a, b) => b.matchScore - a.matchScore);
    },
  }),
    {
      name: 'writer-settings-store',
      partialize: () => ({
        // Only persist user preferences, not all data (which is loaded from backend)
      }),
    }
  )
);

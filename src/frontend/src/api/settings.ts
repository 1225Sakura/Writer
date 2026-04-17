import { api } from "./request";
import type {
  Character,
  CharacterRelationship,
  CharacterStoryline,
  Item,
  Location,
  Faction,
  WorldSetting,
  Rule,
  Outline,
  Chapter,
  IFLine,
} from "./types";

// ============================================
// Characters
// ============================================

export const characterApi = {
  list: () => api.get<Character[]>("/settings/characters"),

  get: (id: number) =>
    api.get<Character>(`/settings/characters/${id}`),

  create: (data: Partial<Character>) =>
    api.post<Character>("/settings/characters", data),

  update: (id: number, data: Partial<Character>) =>
    api.patch<Character>(`/settings/characters/${id}`, data),

  delete: (id: number) =>
    api.delete(`/settings/characters/${id}`),
};

// ============================================
// Character Relationships
// ============================================

export const relationshipApi = {
  getByCharacter: (characterId: number) =>
    api.get<CharacterRelationship[]>(`/settings/characters/${characterId}/relationships`),

  create: (characterId: number, data: Partial<CharacterRelationship>) =>
    api.post<CharacterRelationship>(
      `/settings/characters/${characterId}/relationships`,
      data
    ),

  delete: (characterId: number, relationshipId: number) =>
    api.delete(`/settings/characters/${characterId}/relationships/${relationshipId}`),
};

// ============================================
// Character Storylines
// ============================================

export const storylineApi = {
  getByCharacter: (characterId: number) =>
    api.get<CharacterStoryline[]>(`/settings/characters/${characterId}/storylines`),

  create: (characterId: number, data: Partial<CharacterStoryline>) =>
    api.post<CharacterStoryline>(
      `/settings/characters/${characterId}/storylines`,
      data
    ),

  update: (characterId: number, storylineId: number, data: Partial<CharacterStoryline>) =>
    api.patch<CharacterStoryline>(
      `/settings/characters/${characterId}/storylines/${storylineId}`,
      data
    ),

  delete: (characterId: number, storylineId: number) =>
    api.delete(`/settings/characters/${characterId}/storylines/${storylineId}`),
};

// ============================================
// Items
// ============================================

export const itemApi = {
  list: () => api.get<Item[]>("/settings/items"),

  get: (id: number) => api.get<Item>(`/settings/items/${id}`),

  create: (data: Partial<Item>) => api.post<Item>("/settings/items", data),

  update: (id: number, data: Partial<Item>) =>
    api.patch<Item>(`/settings/items/${id}`, data),

  delete: (id: number) => api.delete(`/settings/items/${id}`),
};

// ============================================
// Locations
// ============================================

export const locationApi = {
  list: () => api.get<Location[]>("/settings/locations"),

  get: (id: number) => api.get<Location>(`/settings/locations/${id}`),

  create: (data: Partial<Location>) =>
    api.post<Location>("/settings/locations", data),

  update: (id: number, data: Partial<Location>) =>
    api.patch<Location>(`/settings/locations/${id}`, data),

  delete: (id: number) => api.delete(`/settings/locations/${id}`),
};

// ============================================
// Factions
// ============================================

export const factionApi = {
  list: () => api.get<Faction[]>("/settings/factions"),

  get: (id: number) => api.get<Faction>(`/settings/factions/${id}`),

  create: (data: Partial<Faction>) =>
    api.post<Faction>("/settings/factions", data),

  update: (id: number, data: Partial<Faction>) =>
    api.patch<Faction>(`/settings/factions/${id}`, data),

  delete: (id: number) => api.delete(`/settings/factions/${id}`),
};

// ============================================
// World Settings
// ============================================

export const worldSettingApi = {
  list: () => api.get<WorldSetting[]>("/settings/world"),

  get: (id: number) => api.get<WorldSetting>(`/settings/world/${id}`),

  create: (data: Partial<WorldSetting>) =>
    api.post<WorldSetting>("/settings/world", data),

  update: (id: number, data: Partial<WorldSetting>) =>
    api.patch<WorldSetting>(`/settings/world/${id}`, data),

  delete: (id: number) => api.delete(`/settings/world/${id}`),
};

// ============================================
// Rules
// ============================================

export const ruleApi = {
  list: () => api.get<Rule[]>("/settings/rules"),

  get: (id: number) => api.get<Rule>(`/settings/rules/${id}`),

  create: (data: Partial<Rule>) => api.post<Rule>("/settings/rules", data),

  update: (id: number, data: Partial<Rule>) =>
    api.patch<Rule>(`/settings/rules/${id}`, data),

  delete: (id: number) => api.delete(`/settings/rules/${id}`),
};

// ============================================
// Outlines & Chapters
// ============================================

export const outlineApi = {
  list: () => api.get<Outline[]>("/settings/outlines"),

  get: (id: number) => api.get<Outline>(`/settings/outlines/${id}`),

  create: (data: Partial<Outline>) =>
    api.post<Outline>("/settings/outlines", data),

  update: (id: number, data: Partial<Outline>) =>
    api.patch<Outline>(`/settings/outlines/${id}`, data),

  delete: (id: number) => api.delete(`/settings/outlines/${id}`),
};

export const chapterApi = {
  list: (outlineId?: number) =>
    api.get<Chapter[]>("/settings/chapters", outlineId ? { outline_id: outlineId } : undefined),

  get: (id: number) => api.get<Chapter>(`/settings/chapters/${id}`),

  create: (data: Partial<Chapter>) =>
    api.post<Chapter>("/settings/chapters", data),

  update: (id: number, data: Partial<Chapter>) =>
    api.patch<Chapter>(`/settings/chapters/${id}`, data),

  delete: (id: number) => api.delete(`/settings/chapters/${id}`),
};

// ============================================
// IF Lines
// ============================================

export const ifLineApi = {
  list: () => api.get<IFLine[]>("/settings/iflines"),

  get: (id: number) => api.get<IFLine>(`/settings/iflines/${id}`),

  create: (data: Partial<IFLine>) =>
    api.post<IFLine>("/settings/iflines", data),

  update: (id: number, data: Partial<IFLine>) =>
    api.patch<IFLine>(`/settings/iflines/${id}`, data),

  delete: (id: number) => api.delete(`/settings/iflines/${id}`),
};

// ============================================
// AI Generation
// ============================================

export const aiGenerateApi = {
  generateRelations: (characters: Character[]) =>
    api.post<{ relationships: CharacterRelationship[] }>("/ai/generate-relations", {
      characters,
    }),

  generate: (context: {
    type: "character" | "item" | "location" | "faction" | "world" | "rule";
    context?: string;
  }) =>
    api.post<{ content: unknown }>("/ai/generate", context),
};

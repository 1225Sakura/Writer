import { api } from "./request"
import type {
  Character,
  CharacterRelationship,
  CharacterStoryline,
  EntityRelation,
  Item,
  Location,
  Faction,
  WorldSetting,
  Rule,
  WritingSettings,
  WritingSettingsUpdateRequest,
  PaginationParams,
  CharacterFilters,
  ItemFilters,
  LocationFilters,
  FactionFilters,
  RuleFilters,
  ExportDataResponse,
  ImportSummaryResponse,
  AIProviderConfig,
  AIProviderConfigCreate,
  AIProviderConfigUpdate,
  AIProviderConfigTest,
  ConnectionTestResult,
} from "./types"

// ============================================
// Characters
// ============================================

export const characterApi = {
  /** List all characters with optional tier filter. */
  list: async (
    params: PaginationParams & CharacterFilters = {}
  ): Promise<Character[]> => {
    const { skip = 0, limit = 100, tier } = params
    return api.get<Character[]>("/settings/characters", { skip, limit, tier })
  },

  /** Get a specific character by ID. */
  get: async (id: number): Promise<Character> =>
    api.get<Character>(`/settings/characters/${id}`),

  /** Create a new character. */
  create: async (data: Partial<Character>): Promise<Character> =>
    api.post<Character>("/settings/characters", data),

  /** Update an existing character. */
  update: async (id: number, data: Partial<Character>): Promise<Character> =>
    api.patch<Character>(`/settings/characters/${id}`, data),

  /** Delete a character. */
  delete: async (id: number): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/settings/characters/${id}`),
}

// ============================================
// Character Relationships
// ============================================

export const relationshipApi = {
  /** Get all relationships for a character. */
  getByCharacter: async (characterId: number): Promise<CharacterRelationship[]> =>
    api.get<CharacterRelationship[]>(`/settings/characters/${characterId}/relationships`),

  /** Create a relationship for a character. */
  create: async (
    characterId: number,
    data: Partial<CharacterRelationship>
  ): Promise<CharacterRelationship> =>
    api.post<CharacterRelationship>(
      `/settings/characters/${characterId}/relationships`,
      data
    ),

  /** Update a relationship. */
  update: async (
    characterId: number,
    relationshipId: number,
    data: Partial<CharacterRelationship>
  ): Promise<CharacterRelationship> =>
    api.put<CharacterRelationship>(
      `/settings/characters/${characterId}/relationships/${relationshipId}`,
      data
    ),

  /** Delete a relationship. */
  delete: async (
    characterId: number,
    relationshipId: number
  ): Promise<{ message: string }> =>
    api.delete<{ message: string }>(
      `/settings/characters/${characterId}/relationships/${relationshipId}`
    ),
}

// ============================================
// Character Storylines
// ============================================

export const storylineApi = {
  /** Get all storylines for a character. */
  getByCharacter: async (characterId: number): Promise<CharacterStoryline[]> =>
    api.get<CharacterStoryline[]>(`/settings/characters/${characterId}/storylines`),

  /** Create a storyline for a character. */
  create: async (
    characterId: number,
    data: Partial<CharacterStoryline>
  ): Promise<CharacterStoryline> =>
    api.post<CharacterStoryline>(
      `/settings/characters/${characterId}/storylines`,
      data
    ),

  /** Update a storyline. */
  update: async (
    characterId: number,
    storylineId: number,
    data: Partial<CharacterStoryline>
  ): Promise<CharacterStoryline> =>
    api.patch<CharacterStoryline>(
      `/settings/characters/${characterId}/storylines/${storylineId}`,
      data
    ),

  /** Delete a storyline. */
  delete: async (
    characterId: number,
    storylineId: number
  ): Promise<{ message: string }> =>
    api.delete<{ message: string }>(
      `/settings/characters/${characterId}/storylines/${storylineId}`
    ),
}

// ============================================
// Items
// ============================================

export const itemApi = {
  /** List all items with optional owner filter. */
  list: async (
    params: PaginationParams & ItemFilters = {}
  ): Promise<Item[]> => {
    const { skip = 0, limit = 100, owner } = params
    return api.get<Item[]>("/settings/items", { skip, limit, owner })
  },

  /** Get a specific item by ID. */
  get: async (id: number): Promise<Item> =>
    api.get<Item>(`/settings/items/${id}`),

  /** Create a new item. */
  create: async (data: Partial<Item>): Promise<Item> =>
    api.post<Item>("/settings/items", data),

  /** Update an existing item. */
  update: async (id: number, data: Partial<Item>): Promise<Item> =>
    api.patch<Item>(`/settings/items/${id}`, data),

  /** Delete an item. */
  delete: async (id: number): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/settings/items/${id}`),
}

// ============================================
// Locations
// ============================================

export const locationApi = {
  /** List all locations with optional importance filter. */
  list: async (
    params: PaginationParams & LocationFilters = {}
  ): Promise<Location[]> => {
    const { skip = 0, limit = 100, importance } = params
    return api.get<Location[]>("/settings/locations", { skip, limit, importance })
  },

  /** Get a specific location by ID. */
  get: async (id: number): Promise<Location> =>
    api.get<Location>(`/settings/locations/${id}`),

  /** Create a new location. */
  create: async (data: Partial<Location>): Promise<Location> =>
    api.post<Location>("/settings/locations", data),

  /** Update an existing location. */
  update: async (id: number, data: Partial<Location>): Promise<Location> =>
    api.patch<Location>(`/settings/locations/${id}`, data),

  /** Delete a location. */
  delete: async (id: number): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/settings/locations/${id}`),
}

// ============================================
// Factions
// ============================================

export const factionApi = {
  /** List all factions with optional type filter. */
  list: async (
    params: PaginationParams & FactionFilters = {}
  ): Promise<Faction[]> => {
    const { skip = 0, limit = 100, type } = params
    return api.get<Faction[]>("/settings/factions", { skip, limit, type })
  },

  /** Get a specific faction by ID. */
  get: async (id: number): Promise<Faction> =>
    api.get<Faction>(`/settings/factions/${id}`),

  /** Create a new faction. */
  create: async (data: Partial<Faction>): Promise<Faction> =>
    api.post<Faction>("/settings/factions", data),

  /** Update an existing faction. */
  update: async (id: number, data: Partial<Faction>): Promise<Faction> =>
    api.patch<Faction>(`/settings/factions/${id}`, data),

  /** Delete a faction. */
  delete: async (id: number): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/settings/factions/${id}`),
}

// ============================================
// World Settings
// ============================================

export const worldSettingApi = {
  /** List all world settings. */
  list: async (params: PaginationParams = {}): Promise<WorldSetting[]> => {
    const { skip = 0, limit = 100 } = params
    return api.get<WorldSetting[]>("/settings/world", { skip, limit })
  },

  /** Get a specific world setting by ID. */
  get: async (id: number): Promise<WorldSetting> =>
    api.get<WorldSetting>(`/settings/world/${id}`),

  /** Create a new world setting. */
  create: async (data: Partial<WorldSetting>): Promise<WorldSetting> =>
    api.post<WorldSetting>("/settings/world", data),

  /** Update an existing world setting. */
  update: async (id: number, data: Partial<WorldSetting>): Promise<WorldSetting> =>
    api.patch<WorldSetting>(`/settings/world/${id}`, data),

  /** Delete a world setting. */
  delete: async (id: number): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/settings/world/${id}`),
}

// ============================================
// Rules
// ============================================

export const ruleApi = {
  /** List all rules with optional type filter. */
  list: async (
    params: PaginationParams & RuleFilters = {}
  ): Promise<Rule[]> => {
    const { skip = 0, limit = 100, type } = params
    return api.get<Rule[]>("/settings/rules", { skip, limit, type })
  },

  /** Get a specific rule by ID. */
  get: async (id: number): Promise<Rule> =>
    api.get<Rule>(`/settings/rules/${id}`),

  /** Create a new rule. */
  create: async (data: Partial<Rule>): Promise<Rule> =>
    api.post<Rule>("/settings/rules", data),

  /** Update an existing rule. */
  update: async (id: number, data: Partial<Rule>): Promise<Rule> =>
    api.patch<Rule>(`/settings/rules/${id}`, data),

  /** Delete a rule. */
  delete: async (id: number): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/settings/rules/${id}`),
}

// ============================================
// Writing Settings
// ============================================

export const writingSettingsApi = {
  /** Get current writing settings (creates default if not exists). */
  get: async (): Promise<WritingSettings> =>
    api.get<WritingSettings>("/settings/writing"),

  /** Update writing settings. */
  update: async (data: WritingSettingsUpdateRequest): Promise<WritingSettings> =>
    api.patch<WritingSettings>("/settings/writing", data),

  /** Save sprint timer data (debounced by caller). */
  saveSprintData: async (sprintData: {
    sprintMinutes: number
    breakMinutes: number
    sprintCount: number
  }): Promise<WritingSettings> =>
    api.patch<WritingSettings>("/settings/writing", {
      sprint_data_json: JSON.stringify(sprintData),
    }),
}

// ============================================
// Entity Relations (cross-entity graph relationships)
// ============================================

export const entityRelationApi = {
  /** List all relations, optionally filtered by source/target entity. */
  list: async (params?: {
    source_type?: string
    source_id?: number
    target_type?: string
    target_id?: number
  }): Promise<EntityRelation[]> =>
    api.get<EntityRelation[]>("/settings/relations", params ?? {}),

  /** Get a specific relation by ID. */
  get: async (id: number): Promise<EntityRelation> =>
    api.get<EntityRelation>(`/settings/relations/${id}`),

  /** Create a new relation. */
  create: async (data: Partial<EntityRelation>): Promise<EntityRelation> =>
    api.post<EntityRelation>("/settings/relations", data),

  /** Update an existing relation. */
  update: async (id: number, data: Partial<EntityRelation>): Promise<EntityRelation> =>
    api.patch<EntityRelation>(`/settings/relations/${id}`, data),

  /** Delete a relation. */
  delete: async (id: number): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/settings/relations/${id}`),

  /** Get all relations for a specific entity (as source or target). */
  getByEntity: async (entityType: string, entityId: number): Promise<EntityRelation[]> =>
    api.get<EntityRelation[]>("/settings/relations", {
      source_type: entityType,
      source_id: entityId,
    }),
}

// ============================================
// Export / Import
// ============================================

export const backupApi = {
  /** Export all project data as JSON for backup and migration. */
  export: async (): Promise<ExportDataResponse> =>
    api.get<ExportDataResponse>("/project/export"),

  /** Import project data from JSON. */
  import: async (data: ExportDataResponse): Promise<ImportSummaryResponse> =>
    api.post<ImportSummaryResponse>("/project/import", data),
}

// ============================================
// AI Provider Config
// ============================================

export const aiProviderConfigApi = {
  list: (projectId?: number) =>
    api.get<AIProviderConfig[]>("/settings/ai-provider", { project_id: projectId }),
  get: (id: number) =>
    api.get<AIProviderConfig>(`/settings/ai-provider/${id}`),
  // Phase 1 Track A: backend uses PUT (full replace) not PATCH (partial).
  // PATCH was misaligned with backend; tests broke. Aligned here.
  getKey: (id: number) =>
    api.get<{ api_key: string }>(`/settings/ai-provider/${id}/key`),
  create: (data: AIProviderConfigCreate) =>
    api.post<AIProviderConfig>("/settings/ai-provider", data),
  update: (id: number, data: AIProviderConfigUpdate) =>
    api.put<AIProviderConfig>(`/settings/ai-provider/${id}`, data),
  delete: (id: number) =>
    api.delete(`/settings/ai-provider/${id}`),
  activate: (id: number) =>
    api.post<AIProviderConfig>(`/settings/ai-provider/${id}/activate`),
  // Phase 1 Track A: backend has no `/{id}/test`; test uses request body.
  testConnectionParams: (data: AIProviderConfigTest) =>
    api.post<ConnectionTestResult>("/settings/ai-provider/test", data),
}

// ============================================
// Default Export
// ============================================

export default {
  character: characterApi,
  relationship: relationshipApi,
  storyline: storylineApi,
  entityRelation: entityRelationApi,
  item: itemApi,
  location: locationApi,
  faction: factionApi,
  worldSetting: worldSettingApi,
  rule: ruleApi,
  writingSettings: writingSettingsApi,
  backup: backupApi,
  aiProviderConfig: aiProviderConfigApi,
}

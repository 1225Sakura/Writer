// ============================================
// Shared Types & Helpers for Settings Stores
// ============================================

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
import type { AIReviewResult } from '../api/types'

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

/** Filter criteria */
export interface FilterCriteria {
  query?: string
  tags?: string[]
  tier?: CharacterTier[]
  sortBy: 'name' | 'createdAt' | 'updatedAt'
  sortOrder: 'asc' | 'desc'
}

/** History entry */
export interface HistoryEntry {
  id: string
  timestamp: number
  entityType: EntityType
  entityId: number
  action: 'create' | 'update' | 'delete' | 'batch'
  description: string
  /** Snapshot before action (for undo) */
  snapshot?: unknown
  /** Snapshot after action (for redo) */
  forwardSnapshot?: unknown
}

/** Batch operation types */
export type BatchOperation =
  | { type: 'delete'; entityType: EntityType; ids: number[] }
  | { type: 'updateTags'; entityType: EntityType; ids: number[]; tags: string[] }
  | { type: 'updateTier'; ids: number[]; tier: CharacterTier }

// ============================================
// Validation Types
// ============================================

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

// ============================================
// State Interfaces (for sub-store slices)
// ============================================

/** Data state slice — entity arrays, loading, AI review, history */
export interface SettingsDataState {
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
  isLoading: boolean
  error: string | null
  aiReviewResult: AIReviewResult | null
  aiGenerateResult: string | null
  history: HistoryEntry[]
  historyIndex: number
  canUndo: boolean
  canRedo: boolean
}

/** UI state slice — tags, filters */
export interface SettingsUIState {
  tags: Tag[]
  activeFilter: FilterCriteria
}

/** Validation state slice — validation errors, dirty tracking */
export interface SettingsValidationState {
  validationErrors: Record<string, ValidationError[]>
  dirtyFields: Record<string, string[]>
  isValidating: boolean
}

/** Combined state (data + UI + validation) */
export type SettingsState = SettingsDataState & SettingsUIState & SettingsValidationState

// ============================================
// Helpers
// ============================================

export const DEFAULT_TIER: CharacterTier = 'supporting'

export const toLocalCharacter = (apiChar: Character): CharacterLocal => ({
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

export const mapApiRelationships = (relationships: CharacterRelationship[]): Relationship[] =>
  relationships.map((r) => ({
    id: r.id,
    targetId: r.target_id,
    type: isValidRelationshipType(r.type) ? r.type : 'other',
    description: r.description,
  }))

export const mapApiStorylines = (storylines: CharacterStoryline[]): CharacterStorylineLocal[] =>
  storylines.map((s) => ({
    id: s.id,
    title: s.title,
    arc: s.arc ?? '',
    progress: s.progress,
  }))

export function isValidRelationshipType(type: string): type is Relationship['type'] {
  const validTypes: Relationship['type'][] = ['family', 'friend', 'enemy', 'master', 'disciple', 'rival', 'romantic', 'other']
  return validTypes.includes(type as Relationship['type'])
}

export const genHistoryId = (): string => `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export const MAX_HISTORY = 50

export function entityTypeToArrayName(entityType: EntityType): keyof SettingsDataState | null {
  const map: Record<string, keyof SettingsDataState> = {
    character: 'characters',
    item: 'items',
    location: 'locations',
    faction: 'factions',
    world: 'worldSettings',
    rule: 'rules',
    ifline: 'ifLines',
  }
  return map[entityType] ?? null
}

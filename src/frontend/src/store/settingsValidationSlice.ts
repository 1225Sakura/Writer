// ============================================
// Settings Validation Slice — Dirty tracking, validation errors
// ============================================

import type { WritableDraft } from 'immer'
import type { EntityType } from '../shared/types'
import type { ValidationError } from './settingsTypes'
import type { SettingsState } from './settingsTypes'

// ============================================
// Validation Slice State
// ============================================

export interface ValidationSliceState {
  validationErrors: Record<string, ValidationError[]>
  dirtyFields: Record<string, string[]>
  isValidating: boolean
}

// ============================================
// Validation Slice Actions
// ============================================

export interface ValidationSliceActions {
  setValidationErrors: (entityType: EntityType, entityId: number, errors: ValidationError[]) => void
  clearValidationErrors: (entityType: EntityType, entityId: number) => void
  clearAllValidationErrors: () => void
  markDirty: (entityType: EntityType, entityId: number, field: string) => void
  markClean: (entityType: EntityType, entityId: number, field: string) => void
  clearDirtyFields: (entityType: EntityType, entityId: number) => void
  isEntityDirty: (entityType: EntityType, entityId: number) => boolean
  getValidationErrors: (entityType: EntityType, entityId: number) => ValidationError[]
}

type ValidationSlice = ValidationSliceState & ValidationSliceActions

// ============================================
// Validation Rules (exported for external use)
// ============================================

const VALIDATION_RULES: Record<string, Record<string, (value: unknown) => string | null>> = {
  character: {
    name: (v) => (typeof v === 'string' && v.trim().length > 0) ? null : 'Name is required',
  },
  item: {
    name: (v) => (typeof v === 'string' && v.trim().length > 0) ? null : 'Name is required',
  },
  location: {
    name: (v) => (typeof v === 'string' && v.trim().length > 0) ? null : 'Name is required',
  },
  faction: {
    name: (v) => (typeof v === 'string' && v.trim().length > 0) ? null : 'Name is required',
  },
  world: {
    name: (v) => (typeof v === 'string' && v.trim().length > 0) ? null : 'Name is required',
  },
  rule: {
    name: (v) => (typeof v === 'string' && v.trim().length > 0) ? null : 'Name is required',
  },
  ifline: {
    title: (v) => (typeof v === 'string' && v.trim().length > 0) ? null : 'Title is required',
  },
}

/**
 * Validate an entity against its rules. Returns errors array (empty if valid).
 */
export function validateEntity(entityType: EntityType, data: Record<string, unknown>): ValidationError[] {
  const rules = VALIDATION_RULES[entityType]
  if (!rules) return []

  const errors: ValidationError[] = []
  for (const [field, rule] of Object.entries(rules)) {
    const message = rule(data[field])
    if (message) {
      errors.push({ field, message, severity: 'error' })
    }
  }
  return errors
}

// ============================================
// Slice Creator
// ============================================

export const createValidationSlice = (
  rawSet: (fn: (state: WritableDraft<SettingsState>) => void) => void,
  get: () => SettingsState,
): ValidationSlice => {
  const set = rawSet
  return {
  // ---- Initial State ----
  validationErrors: {},
  dirtyFields: {},
  isValidating: false,

  // ---- Validation Actions ----

  setValidationErrors: (entityType, entityId, errors) => {
    const key = `${entityType}:${entityId}`
    set((state) => { state.validationErrors[key] = errors })
  },

  clearValidationErrors: (entityType, entityId) => {
    const key = `${entityType}:${entityId}`
    set((state) => { delete state.validationErrors[key] })
  },

  clearAllValidationErrors: () => {
    set((state) => { state.validationErrors = {} })
  },

  markDirty: (entityType, entityId, field) => {
    const key = `${entityType}:${entityId}`
    set((state) => {
      if (!state.dirtyFields[key]) state.dirtyFields[key] = []
      if (!state.dirtyFields[key].includes(field)) state.dirtyFields[key].push(field)
    })
  },

  markClean: (entityType, entityId, field) => {
    const key = `${entityType}:${entityId}`
    set((state) => {
      if (state.dirtyFields[key]) {
        state.dirtyFields[key] = state.dirtyFields[key].filter((f) => f !== field)
        if (state.dirtyFields[key].length === 0) delete state.dirtyFields[key]
      }
    })
  },

  clearDirtyFields: (entityType, entityId) => {
    const key = `${entityType}:${entityId}`
    set((state) => { delete state.dirtyFields[key] })
  },

  isEntityDirty: (entityType, entityId) => {
    const key = `${entityType}:${entityId}`
    return (get().dirtyFields[key]?.length ?? 0) > 0
  },

  getValidationErrors: (entityType, entityId) => {
    const key = `${entityType}:${entityId}`
    return get().validationErrors[key] ?? []
  },
} as ValidationSlice }

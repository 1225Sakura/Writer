// ============================================
// Settings Validation Store — Typed facade over settingsStore
// Provides typed access to validation-related state and actions.
// ============================================

import { useSettingsStore } from './settingsStore'
import type { SettingsValidationState } from './settingsTypes'
import { validateEntity as _validateEntity } from './settingsValidationSlice'

// Re-export types for direct imports from this module
export type { SettingsValidationState, ValidationError } from './settingsTypes'
export type { ValidationSliceState, ValidationSliceActions } from './settingsValidationSlice'

// Re-export validateEntity from the slice
export const validateEntity = _validateEntity

/**
 * Typed selector hook for validation-related state.
 * Reads from the main settingsStore but only returns validation slice.
 */
export const useSettingsValidationStore = () => {
  const store = useSettingsStore()
  return {
    // Validation state
    validationErrors: store.validationErrors,
    dirtyFields: store.dirtyFields,
    isValidating: store.isValidating,

    // Validation actions
    setValidationErrors: store.setValidationErrors,
    clearValidationErrors: store.clearValidationErrors,
    clearAllValidationErrors: store.clearAllValidationErrors,
    markDirty: store.markDirty,
    markClean: store.markClean,
    clearDirtyFields: store.clearDirtyFields,
    isEntityDirty: store.isEntityDirty,
    getValidationErrors: store.getValidationErrors,
  } as const
}

/**
 * Direct access to validation store state (outside React).
 * Use for imperative code, event handlers, etc.
 */
export const getValidationState = (): SettingsValidationState => {
  const state = useSettingsStore.getState()
  return {
    validationErrors: state.validationErrors,
    dirtyFields: state.dirtyFields,
    isValidating: state.isValidating,
  }
}

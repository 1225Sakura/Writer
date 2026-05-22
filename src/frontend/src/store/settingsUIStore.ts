// ============================================
// Settings UI Store — Typed facade over settingsStore
// Provides typed access to UI-related state and actions.
// ============================================

import { useSettingsStore } from './settingsStore'
import type { SettingsUIState } from './settingsTypes'
// UISliceState re-exported below for consumers

// Re-export types for direct imports from this module
export type { SettingsUIState } from './settingsTypes'
export type { UISliceState, UISliceActions } from './settingsUISlice'

/**
 * Typed selector hook for UI-related state.
 * Reads from the main settingsStore but only returns UI slice.
 */
export const useSettingsUIStore = () => {
  const store = useSettingsStore()
  return {
    // Tags
    tags: store.tags,

    // Filter & Sort
    activeFilter: store.activeFilter,

    // Tag actions
    addTag: store.addTag,
    removeTag: store.removeTag,
    addTagToEntity: store.addTagToEntity,
    removeTagFromEntity: store.removeTagFromEntity,

    // Filter & Sort actions
    setFilter: store.setFilter,
    clearFilter: store.clearFilter,
    getFilteredCharacters: store.getFilteredCharacters,
    getFilteredItems: store.getFilteredItems,
    getFilteredLocations: store.getFilteredLocations,
    getFilteredFactions: store.getFilteredFactions,

    // Search
    searchEntities: store.searchEntities,
  } as const
}

/**
 * Direct access to UI store state (outside React).
 * Use for imperative code, event handlers, etc.
 */
export const getUIState = (): SettingsUIState => {
  const state = useSettingsStore.getState()
  return {
    tags: state.tags,
    activeFilter: state.activeFilter,
  }
}

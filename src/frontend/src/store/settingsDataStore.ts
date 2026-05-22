// ============================================
// Settings Data Store — Typed facade over settingsStore
// Provides typed access to data-related state and actions.
// ============================================

import { useSettingsStore } from './settingsStore'
import type { SettingsDataState } from './settingsTypes'
// DataSliceState re-exported below for consumers

// Re-export types for direct imports from this module
export type { SettingsDataState } from './settingsTypes'
export type { DataSliceState, DataSliceActions } from './settingsDataSlice'

/**
 * Typed selector hook for data-related state.
 * Reads from the main settingsStore but only returns data slice.
 */
export const useSettingsDataStore = () => {
  const store = useSettingsStore()
  return {
    // Entity data
    characters: store.characters,
    items: store.items,
    locations: store.locations,
    factions: store.factions,
    worldSettings: store.worldSettings,
    rules: store.rules,
    outline: store.outline,
    chapters: store.chapters,
    ifLines: store.ifLines,
    writingSettings: store.writingSettings,

    // Loading & Error
    isLoading: store.isLoading,
    error: store.error,

    // AI Review
    aiReviewResult: store.aiReviewResult,

    // History
    history: store.history,
    historyIndex: store.historyIndex,
    canUndo: store.canUndo,
    canRedo: store.canRedo,

    // Data loading actions
    loadAll: store.loadAll,
    loadCategoryData: store.loadCategoryData,

    // AI actions
    generate: store.generate,
    generateRelations: store.generateRelations,
    reviewWithAI: store.reviewWithAI,

    // Character CRUD
    addCharacter: store.addCharacter,
    updateCharacter: store.updateCharacter,
    deleteCharacter: store.deleteCharacter,
    addRelationship: store.addRelationship,
    removeRelationship: store.removeRelationship,
    updateStorylineProgress: store.updateStorylineProgress,

    // Item CRUD
    addItem: store.addItem,
    updateItem: store.updateItem,
    deleteItem: store.deleteItem,

    // Location CRUD
    addLocation: store.addLocation,
    updateLocation: store.updateLocation,
    deleteLocation: store.deleteLocation,

    // Faction CRUD
    addFaction: store.addFaction,
    updateFaction: store.updateFaction,
    deleteFaction: store.deleteFaction,

    // WorldSetting CRUD
    addWorldSetting: store.addWorldSetting,
    updateWorldSetting: store.updateWorldSetting,
    deleteWorldSetting: store.deleteWorldSetting,

    // Rule CRUD
    addRule: store.addRule,
    updateRule: store.updateRule,
    deleteRule: store.deleteRule,

    // Outline
    setOutline: store.setOutline,
    addChapter: store.addChapter,
    updateChapter: store.updateChapter,
    deleteChapter: store.deleteChapter,

    // IFLine
    addIFLine: store.addIFLine,
    updateIFLine: store.updateIFLine,
    deleteIFLine: store.deleteIFLine,

    // Batch operations
    importFromChat: store.importFromChat,
    batchDelete: store.batchDelete,
    batchUpdateTags: store.batchUpdateTags,
    executeBatch: store.executeBatch,

    // Undo/Redo
    undo: store.undo,
    redo: store.redo,
    clearHistory: store.clearHistory,
  } as const
}

/**
 * Direct access to data store state (outside React).
 * Use for imperative code, event handlers, etc.
 */
export const getDataState = (): SettingsDataState => {
  const state = useSettingsStore.getState()
  return {
    characters: state.characters,
    items: state.items,
    locations: state.locations,
    factions: state.factions,
    worldSettings: state.worldSettings,
    rules: state.rules,
    outline: state.outline,
    chapters: state.chapters,
    ifLines: state.ifLines,
    writingSettings: state.writingSettings,
    isLoading: state.isLoading,
    error: state.error,
    aiReviewResult: state.aiReviewResult,
    history: state.history,
    historyIndex: state.historyIndex,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  }
}

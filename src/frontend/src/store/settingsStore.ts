// ============================================
// Settings Store — Thin combiner of Zustand slices
// ============================================

import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createHybridStorage } from './utils/indexedDBStorage'

// Import slice creators
import { createDataSlice } from './settingsDataSlice'
import type { DataSliceState, DataSliceActions } from './settingsDataSlice'
import { createUISlice } from './settingsUISlice'
import type { UISliceState, UISliceActions } from './settingsUISlice'
import { createValidationSlice } from './settingsValidationSlice'
import type { ValidationSliceState, ValidationSliceActions } from './settingsValidationSlice'

// ============================================
// Combined State Type
// ============================================

type SettingsState = DataSliceState & UISliceState & ValidationSliceState
type SettingsActions = DataSliceActions & UISliceActions & ValidationSliceActions

// ============================================
// Store
// ============================================

// biome-ignore lint/suspicious/noExplicitAny: Zustand middleware type inference requires cast
export const useSettingsStore = create<SettingsState & SettingsActions>()(
  immer(
    subscribeWithSelector(
      persist(
        ((set: any, get: any) => ({
          ...createDataSlice(set, get),
          ...createUISlice(set, get),
          ...createValidationSlice(set, get),
        })) as any,
        {
          name: 'writer-settings-store-v2',
          storage: createHybridStorage(100 * 1024) as never,
          partialize: (state: SettingsState) => ({
            tags: state.tags,
            activeFilter: state.activeFilter,
          }),
          version: 2,
        } as any
      )
    )
  )
)

// Selectors
export const selectCharacterCount = (s: SettingsState) => s.characters.length
export const selectEntityCounts = (s: SettingsState) => ({
  characters: s.characters.length, items: s.items.length, locations: s.locations.length,
  factions: s.factions.length, worldSettings: s.worldSettings.length, rules: s.rules.length, ifLines: s.ifLines.length,
})
export const selectWritingSettings = (s: SettingsState) => s.writingSettings
export const selectSettingsStatus = (s: SettingsState) => ({ isLoading: s.isLoading, error: s.error })
export const selectCharactersShallow = (s: SettingsState) => s.characters
export const selectAIReviewResult = (s: SettingsState) => s.aiReviewResult
export const selectCharactersByTier = (tier: string) => (s: SettingsState) => s.characters.filter((c) => c.tier === tier)

export function cleanupSettingsStore(): void {
  useSettingsStore.setState({ isLoading: false, error: null, aiReviewResult: null })
}

// Re-exports for backward compatibility
export type {
  Relationship, CharacterLocal, Tag, FilterCriteria,
  HistoryEntry, BatchOperation, CharacterStorylineLocal,
  ValidationError, SettingsDataState, SettingsUIState, SettingsValidationState,
} from './settingsTypes'
export type { SettingsState }
export type { EntityType } from '../shared/types'
export { validateEntity } from './settingsValidationSlice'

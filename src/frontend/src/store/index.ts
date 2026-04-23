// Store exports with backward compatibility
// New modular stores
export { useSessionStore, selectCurrentSession, selectSessionCount } from './sessionStore'
export { useMessageStore, selectMessageCount, selectIsEmptySession, selectUserMessages, selectAssistantMessages } from './messageStore'
export { useChatEntityStore, selectConfirmedEntities, selectPendingEntities, selectEntitiesByType } from './chatEntityStore'
export { useEntityStore, selectCharacterCount, selectEntityCounts, selectCharactersByTier } from './entityStore'
export { useRelationStore } from './relationStore'
export { useFilterStore, selectActiveFilter, selectTags } from './filterStore'

// Backward compatibility - re-export original stores
export {
  useChatStore,
  selectConfirmedEntities as chatSelectConfirmed,
  selectPendingEntities as chatSelectPending,
  selectMessageCount as chatSelectMessageCount,
  selectIsEmptySession as chatSelectIsEmpty,
} from './chatStore'
export {
  useSettingsStore,
  selectCharacterCount as settingsSelectCharacterCount,
  selectEntityCounts as settingsSelectEntityCounts,
} from './settingsStore'

// Types from chatStore
export type { ChatMessageLocal as ChatMessage, ExtractedEntityLocal as ExtractedEntity, EntityExtractionState, MessageCache } from './chatStore'

// Types from settingsStore
export type { Relationship, CharacterLocal, Tag, FilterCriteria, HistoryEntry, BatchOperation, CharacterStorylineLocal } from './settingsStore'

// Entity types
export type { EntityType } from '../shared/types'
export type { Character, Item, Location, Faction, WorldSetting, Rule, Outline, Chapter, IFLine } from '../api/types'

// UI Store
export { useUIStore, type InterfaceType, type UIState } from './uiStore'

// Writing Store
export {
  useWritingStore,
  type WritingStyle,
  type AIGenerationJob,
  type AutoSaveState,
  type DraftVersionLocal as DraftVersion,
  type PlotThreadLocal as PlotThread,
  type AIInspectionResultLocal as AIInspectionResult,
  selectCurrentChapter,
  selectDraftVersionsForCurrentChapter,
  selectPendingJobs,
  selectCompletedJobs,
} from './writingStore'

// History Store
export {
  useHistoryStore,
  type HistoryActionType,
  type HistoryEntityType,
  type HistoryEntry as GlobalHistoryEntry,
  type GroupedHistory,
  selectRecentHistory,
  selectUnsyncedCount,
} from './historyStore'

// Sync Store
export {
  useSyncStore,
  type SyncStatus,
  type SyncMode,
  type IFLineSyncState,
  type CharacterStoryProgress,
  type SyncConflict,
  type AIGenerationTask,
  selectActiveIFLines,
  selectConflictsNeedingAttention,
  selectSyncProgress,
} from './syncStore'
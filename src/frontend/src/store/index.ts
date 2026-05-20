// Store exports with backward compatibility
// New modular stores
export { useSessionStore, selectCurrentSession, selectSessionCount, selectSessionStatus } from './sessionStore'
export { useMessageStore, selectMessageCount, selectIsEmptySession, selectUserMessages, selectAssistantMessages } from './messageStore'
export { useChatEntityStore, selectConfirmedEntities, selectPendingEntities, selectEntitiesByType } from './chatEntityStore'
export { useEntityStore, selectCharacterCount, selectEntityCounts, selectCharactersByTier, selectEntityStatus } from './entityStore'
export { useRelationStore } from './relationStore'
export { useFilterStore, selectActiveFilter, selectTags } from './filterStore'

// Backward compatibility - re-export original stores
export {
  useChatStore,
  selectConfirmedEntities as chatSelectConfirmed,
  selectPendingEntities as chatSelectPending,
  selectMessageCount as chatSelectMessageCount,
  selectIsEmptySession as chatSelectIsEmpty,
  selectStreamingState,
  selectLoadingError,
  selectEntitiesByType as chatSelectEntitiesByType,
  cleanupChatStore,
} from './chatStore'
export {
  useSettingsStore,
  selectCharacterCount as settingsSelectCharacterCount,
  selectEntityCounts as settingsSelectEntityCounts,
  selectSettingsStatus,
  selectWritingSettings,
  cleanupSettingsStore,
} from './settingsStore'

// Types from chatStore
export type { ChatMessageLocal as ChatMessage, ExtractedEntityLocal as ExtractedEntity, EntityExtractionState, MessageCache } from './chatStore'

// Types from settingsStore
export type { Relationship, CharacterLocal, Tag, FilterCriteria, HistoryEntry, BatchOperation, CharacterStorylineLocal } from './settingsStore'

// Entity types
export type { EntityType } from '../shared/types'
export type { Character, Item, Location, Faction, WorldSetting, Rule, Outline, Chapter, IFLine } from '../api/types'

// UI Store
export {
  useUIStore,
  type InterfaceType,
  type UIState,
  selectDrawerState,
  selectNavigationState,
  selectPanelSizes,
  selectTheme,
  selectDisplayModes,
  cleanupUIStore,
} from './uiStore'

// Writing Store (editor state, session, config)
export {
  useWritingStore,
  type WritingStyle,
  type AutoSaveState,
  type ChapterNote,
  type WritingSession,
  type DailyStats,
  selectCurrentChapter,
  selectDraftVersionsForCurrentChapter,
  selectWritingConfig,
  selectCurrentContent,
  selectLoadingState,
  cleanupWritingStore,
} from './writingStore'

// Content Store (chapters, outlines, drafts, IF lines, plot threads, inspections)
export {
  useContentStore,
  type DraftVersionLocal as DraftVersion,
  type PlotThreadLocal as PlotThread,
  type AIInspectionResultLocal as AIInspectionResult,
  selectChapters,
  selectContentLoading,
  cleanupContentStore,
} from './contentStore'

// AI Store (generation queue, streaming, styles)
export {
  useAIStore,
  type AIGenerationJob,
  selectPendingJobs,
  selectCompletedJobs,
  cleanupAIStore,
} from './aiStore'

// Checker Store (consistency, continuity, pacing, OOC, high-point, reader-pull)
export {
  useCheckerStore,
  selectCheckerResults,
  selectCheckerLoading,
  selectCheckerError,
  cleanupCheckerStore,
} from './checkerStore'

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
  selectSyncStatusOnly,
  selectSyncStats,
  cleanupSyncStore,
} from './syncStore'

// Context Store
export {
  useContextStore,
  selectContextPack,
  selectContextChunks,
  selectContextStats,
  selectContextWeights,
  selectLastQuery,
  selectContextLoading,
  selectContextError,
  cleanupContextStore,
} from './contextStore'

// Analytics Store
export {
  useAnalyticsStore,
  selectEngagementAnalysis,
  selectHookAnalysis,
  selectDebtReport,
  selectEngagementScore,
  selectStrandDefinitions,
  selectPacingAnalysis,
  selectRedLines,
  selectAdvice,
  selectAnalyticsLoading,
  selectAnalyticsError,
  cleanupAnalyticsStore,
} from './analyticsStore'

// Graph Store
export {
  useGraphStore,
  selectGraphEntities,
  selectGraphVisualization,
  selectGraphSelectedNode,
  selectGraphLoading,
  selectGraphError,
  selectGraphClusters,
  selectGraphDuplicates,
  cleanupGraphStore,
} from './graphStore'

// System Store
export {
  useSystemStore,
  selectGenres,
  selectGenreProfile,
  selectWorkflows,
  selectExecutions,
  selectMetrics,
  selectDebts,
  selectTrends,
  selectProjectStatus,
  selectQuickStatus,
  selectConstraintRules,
  selectLastCheckResult,
  selectSystemLoading,
  selectSystemError,
  cleanupSystemStore,
} from './systemStore'

// Project Data Store
export {
  useProjectDataStore,
  selectSnapshots,
  selectSnapshotCount,
  selectBackupStatus,
  selectExportData,
  selectImportResult,
  selectProjectDataLoading,
  selectProjectDataError,
  cleanupProjectDataStore,
} from './projectDataStore'

// Store utilities
export {
  shallow,
  createSelector,
  createShallowSelector,
  useShallowSelector,
  shallowSelectors,
  indexedDBStorage,
  createHybridStorage,
  createOptimisticContext,
  withOptimisticUpdate,
  createOptimisticMessage,
  createOptimisticEntityUpdate,
  createCrossStoreSync,
  createBidirectionalSync,
  createCleanupRegistry,
  createAutoCleanupSubscription,
} from './utils'

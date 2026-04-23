// ============================================
// Import types from shared types module for local use
// ============================================

import type {
  ChatMessage,
  Character,
  CharacterRelationship,
  CharacterStoryline,
  Item,
  Faction,
  WorldSetting,
  Rule,
  WritingSettings,
  ChapterStatus,
  PlotThreadStatus,
} from "@/shared/types"

// ============================================
// Re-export types from shared types module
// ============================================

export type {
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
  ChatSession,
  ChatMessage,
  ExtractedEntity,
  DraftVersion,
  PlotThread,
  AIInspectionResult,
  WritingSettings,
  ApiResponse,
  PaginatedResponse,
  ErrorResponse,
  SuccessResponse,
  Project,
  GenreConfiguration,
  BackgroundTask,
  WorkflowExecution,
  AgentExecutionLog,
  ChapterStatus,
  IFLineSyncMode,
  PlotThreadStatus,
  ChatRole,
  EntityType,
  SettingsEntityType,
} from "@/shared/types"

// Re-export with 'Api' suffix to avoid naming conflicts
export type {
  Character as ApiCharacter,
  Chapter as ApiChapter,
  Outline as ApiOutline,
  IFLine as ApiIFLine,
  DraftVersion as ApiDraftVersion,
  PlotThread as ApiPlotThread,
  AIInspectionResult as ApiAIInspectionResult,
  WritingSettings as ApiWritingSettings,
  ChatSession as ApiChatSession,
  ChatMessage as ApiChatMessage,
  ExtractedEntity as ApiExtractedEntity,
  Item as ApiItem,
  Location as ApiLocation,
  Faction as ApiFaction,
  WorldSetting as ApiWorldSetting,
  Rule as ApiRule,
  Project as ApiProject,
  BackgroundTask as ApiBackgroundTask,
  WorkflowExecution as ApiWorkflowExecution,
  AgentExecutionLog as ApiAgentExecutionLog,
} from "@/shared/types"

// ============================================
// Writing Style Enum
// ============================================

export type WritingStyleType =
  | "default"
  | "jiangnan"
  | "kafka"
  | "camus"
  | "custom"

// ============================================
// API-specific types (not in shared)
// ============================================

// ============================================
// Chat API Types
// ============================================

export interface ChatSendRequest {
  content: string
  collected_settings?: Record<string, string | number | boolean | null>
  current_category?: string
}

export interface AgentResult {
  confidence: number
  metadata: Record<string, string | number | boolean>
  warnings: string[]
  content?: string
}

export interface ChatSendResponse {
  user_message: ChatMessage
  ai_message: ChatMessage
  stream?: ReadableStream<Uint8Array>
  agent_result?: AgentResult
}

export interface SessionSummaryResponse {
  session_id: number
  summary: string
}

// ============================================
// AI Generation Types
// ============================================

export type AIOperationType =
  | "continue"
  | "expand"
  | "condense"
  | "rewrite"
  | "polish"
  | "optimize"

export interface AIGenerateRequest {
  prompt: string
  operation: AIOperationType
  chapter_id?: number
  human_ai_ratio?: number
  style?: string
}

export interface AIGenerateHeaders {
  operation: string
  "human-ai-ratio": string
  style: string
}

export interface AIGenerateResponse {
  operation: string
  "human-ai-ratio": string
  style: string
}

export interface AIStreamResult {
  stream: ReadableStream<Uint8Array>
  headers: AIGenerateResponse
}

// ============================================
// AI Context & Extract Types
// ============================================

export interface SceneConstraint {
  location?: string
  time?: string
  mood?: string
  pov?: string
}

export interface ContinuityInfo {
  previous_chapter_summary?: string
  active_plot_threads: string[]
  character_states: Record<string, string>
}

export interface AIContextResponse {
  chapter_id: number
  chapter_title?: string
  core_task: {
    objective?: string
    target_length?: number
    focus?: string
  }
  承接上文: {
    summary?: string
    unresolved_threads?: string[]
  }
  active_characters: Array<{
    id: number
    name: string
    state: string
    motivation?: string
  }>
  scene_constraints: SceneConstraint
  time_constraints: string
  style_guidance: string
  continuity: ContinuityInfo
  engagement_strategy: string
  raw_ai_response?: string
}

export interface ExtractedScene {
  location?: string
  characters: string[]
  events: string[]
  mood?: string
}

export interface ExtractedRelationship {
  source: string
  target: string
  type: string
  description?: string
}

export interface ExtractedStateChange {
  entity: string
  property: string
  old_value?: string
  new_value: string
}

export interface AIExtractResponse {
  chapter_id?: number
  entities: Array<{
    type: string
    name: string
    description?: string
  }>
  relationships: ExtractedRelationship[]
  state_changes: ExtractedStateChange[]
  scenes: ExtractedScene[]
  summary: string
}

// ============================================
// AI Review Types
// ============================================

export interface AIReviewResult {
  review_content: string
  raw_response: Record<string, string | number | boolean | string[]>
}

export interface AIReviewRequest {
  settings_data: Record<string, unknown>
}

export interface AIChapterInspectionResponse {
  chapter_id: number
  review_content: string
  raw_response: Record<string, string | number | boolean | string[]>
}

// ============================================
// Checker Types (from /ai/check/* endpoints)
// ============================================

export interface CheckerBaseRequest {
  chapter_id: number
}

export interface CheckerBaseResponse {
  chapter_id: number
  score: number
  issues: string[]
  suggestions: string[]
}

export interface ContinuityPlotThreadStatus {
  thread_id: number
  title: string
  status: string
  fulfilled: boolean
}

export interface ContinuityCheckResponse extends CheckerBaseResponse {
  plot_thread_status: ContinuityPlotThreadStatus[]
}

export interface StrandRatio {
  strand: string
  percentage: number
}

export interface PacingCheckResponse extends CheckerBaseResponse {
  strand_ratios: StrandRatio[]
  analysis: string
}

export interface OOCViolation {
  location: string
  expected_behavior: string
  actual_behavior: string
  reason: string
}

export interface OOCCheckResponse extends CheckerBaseResponse {
  character_id: number
  violations: OOCViolation[]
}

export interface HighPoint {
  location: string
  type: string
  intensity: number
  pacing: string
}

export interface HighPointCheckResponse extends CheckerBaseResponse {
  high_points: HighPoint[]
  excitement_density: string
  ending_hook: string
}

export interface ReaderPullHook {
  location: string
  type: string
  description: string
  effectiveness: number
}

export interface ReaderPullCheckResponse extends CheckerBaseResponse {
  hooks: ReaderPullHook[]
  opening_hook: string
  ending_hook: string
  curiosity_gaps: string[]
}

// ============================================
// Export/Import Types
// ============================================

export interface ExportDataResponse {
  version: string
  exported_at: string
  characters: Character[]
  character_relationships: CharacterRelationship[]
  character_storylines: CharacterStoryline[]
  items: Item[]
  locations: Location[]
  factions: Faction[]
  world_settings: WorldSetting[]
  rules: Rule[]
  writing_settings: WritingSettings | null
}

export interface ImportSummaryResponse {
  success: boolean
  message: string
  imported: Record<string, number>
}

// ============================================
// Settings API Types
// ============================================

export interface WritingSettingsUpdateRequest {
  human_ai_ratio?: number
  writing_style?: string
  target_word_count?: number
}

// ============================================
// Pagination & Filter Types
// ============================================

export interface PaginationParams {
  skip?: number
  limit?: number
}

export interface ChapterFilters {
  outline_id?: number
  status?: ChapterStatus
}

export interface CharacterFilters {
  tier?: string
}

export interface ItemFilters {
  owner?: string
}

export interface LocationFilters {
  importance?: string
}

export interface FactionFilters {
  type?: string
}

export interface RuleFilters {
  type?: string
}

export interface IFLineFilters {
  character_id?: number
}

export interface PlotThreadFilters {
  status?: PlotThreadStatus
}

export interface EntityFilters {
  entity_type?: string
  confirmed?: boolean
}

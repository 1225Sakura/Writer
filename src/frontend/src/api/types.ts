// ============================================
// Re-export types from shared types module
// ============================================

export type {
  Character,
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
// Entity Type Enum (for AI review categorization)
// ============================================

export type EntityType =
  | "character"
  | "item"
  | "location"
  | "faction"
  | "world"
  | "rule"
  | "outline"
  | "chapter"
  | "plot_thread"

// ============================================
// API-specific types (not in shared)
// ============================================

export interface CharacterRelationship {
  id: number
  character_id: number
  target_id: number
  type: "family" | "friend" | "enemy" | "master" | "disciple" | "rival" | "romantic" | "other"
  description?: string
}

export interface CharacterStoryline {
  id: number
  character_id: number
  title: string
  arc?: string
  progress: number
}

// ============================================
// Chat API Types
// ============================================

export interface ChatSendRequest {
  content: string
  collected_settings?: Record<string, unknown>
  current_category?: string
}

export interface ChatSendResponse {
  user_message: ChatMessage
  ai_message: ChatMessage
  agent_result?: {
    confidence: number
    metadata: Record<string, unknown>
    warnings: string[]
    content?: string | Record<string, unknown>
  }
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

export interface AIContextResponse {
  chapter_id: number
  chapter_title?: string
  core_task: Record<string, unknown>
  承接上文: Record<string, unknown>
  active_characters: unknown[]
  scene_constraints: Record<string, unknown>
  time_constraints: string
  style_guidance: string
  continuity: Record<string, unknown>
  engagement_strategy: string
  raw_ai_response?: string
}

export interface AIExtractResponse {
  chapter_id?: number
  entities: unknown[]
  relationships: unknown[]
  state_changes: unknown[]
  scenes: unknown[]
  summary: string
}

// ============================================
// AI Review Types
// ============================================

export interface AIReviewResult {
  review_content: string
  raw_response: Record<string, unknown>
}

export interface AIReviewRequest {
  settings_data: Record<string, unknown>
}

export interface AIChapterInspectionResponse {
  chapter_id: number
  review_content: string
  raw_response: Record<string, unknown>
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

export interface ContinuityCheckResponse extends CheckerBaseResponse {
  plot_thread_status: Record<string, unknown>
}

export interface PacingCheckResponse extends CheckerBaseResponse {
  strand_ratios: Record<string, unknown>
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
  characters: unknown[]
  character_relationships: unknown[]
  character_storylines: unknown[]
  items: unknown[]
  locations: unknown[]
  factions: unknown[]
  world_settings: unknown[]
  rules: unknown[]
  writing_settings: Record<string, unknown> | null
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
  status?: "pending" | "writing" | "review" | "completed" | "archived"
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
  status?: "active" | "resolved" | "abandoned" | "hidden"
}

export interface EntityFilters {
  entity_type?: string
  confirmed?: boolean
}

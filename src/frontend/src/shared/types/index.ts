// ============================================
// Project & Genre Configuration
// ============================================

export interface Project {
  id: number
  name: string
  description?: string
  genre?: string
  created_at: string
  updated_at: string
}

export interface GenreConfiguration {
  id: number
  genre: string
  config_json: string
  created_at: string
  updated_at: string
}

// ============================================
// Background Tasks
// ============================================

export interface BackgroundTask {
  id: string
  type: string
  status: "pending" | "running" | "completed" | "failed"
  payload?: string
  result?: string
  error?: string
  retries: number
  created_at: string
  updated_at: string
}

// ============================================
// Characters & Relationships
// ============================================

export interface Character {
  id: number
  project_id?: number
  name: string
  gender?: string
  personality?: string
  desires?: string
  flaws?: string
  description?: string
  tier?: string
  cultivation_realm?: string
  created_at: string
  updated_at: string
}

export interface CharacterRelationship {
  id: number
  project_id?: number
  character_id: number
  target_id: number
  type: string
  description?: string
}

export interface CharacterStoryline {
  id: number
  project_id?: number
  character_id: number
  title: string
  arc?: string
  progress: number
}

// ============================================
// World Entities
// ============================================

export interface Item {
  id: number
  project_id?: number
  name: string
  description?: string
  owner?: string
  location?: string
  tags?: string[]
}

export interface Location {
  id: number
  project_id?: number
  name: string
  description?: string
  importance?: string
  tags?: string[]
}

export interface Faction {
  id: number
  project_id?: number
  name: string
  description?: string
  type?: string
  tags?: string[]
}

export interface WorldSetting {
  id: number
  project_id?: number
  name: string
  description?: string
  details_json?: string
  tags?: string[]
}

export interface Rule {
  id: number
  project_id?: number
  name: string
  description?: string
  type?: string
  tags?: string[]
}

// ============================================
// Story Structure
// ============================================

export interface Outline {
  id: number
  project_id?: number
  title: string
  description?: string
}

export type ChapterStatus = "planning" | "pending" | "writing" | "review" | "completed" | "archived"

export interface Chapter {
  id: number
  project_id?: number
  outline_id?: number
  title?: string
  summary?: string
  status: ChapterStatus
  word_count: number
  chapter_order: number
  content_storage_id?: string
  created_at: string
  updated_at: string
}

export type IFLineSyncMode = "auto" | "manual" | "paused"

export interface IFLine {
  id: number
  project_id?: number
  title: string
  linked_character_id?: number
  description?: string
  sync_mode: IFLineSyncMode
  progress?: number
  tags?: string[]
  created_at: string
  updated_at: string
}

// ============================================
// Chat / Conversation (Interface 1)
// ============================================

export interface ChatSession {
  id: number
  project_id?: number
  created_at: string
  updated_at: string
}

export type ChatRole = "user" | "assistant" | "system"

export interface ChatMessage {
  id: number
  project_id?: number
  session_id: number
  role: ChatRole
  content: string
  created_at: string
}

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
  | "ifline"

export interface ExtractedEntity {
  id: number
  project_id?: number
  session_id: number
  type: EntityType
  name: string
  description?: string
  confirmed: number
  created_at: string
}

// ============================================
// Writing & Versioning (Interface 3)
// ============================================

export interface DraftVersion {
  id: number
  project_id?: number
  chapter_id: number
  content: string
  content_storage_id?: string
  version_number: number
  created_at: string
}

export type PlotThreadStatus = "active" | "resolved" | "abandoned" | "hidden" | "open" | "revealed"

export interface PlotThread {
  id: number
  project_id?: number
  title: string
  description?: string
  status: PlotThreadStatus
  created_chapter_id?: number
  reveal_chapter_id?: number
  created_at: string
}

export interface AIInspectionResult {
  id: number
  project_id?: number
  chapter_id: number
  inspection_type: string
  issues_json?: string
  suggestions_json?: string
  auto_fixed: number
  created_at: string
}

export interface WritingSettings {
  id: number
  project_id?: number
  human_ai_ratio: number
  writing_style: string
  target_word_count: number
  created_at: string
  updated_at: string
}

// ============================================
// Workflow Execution Tracking
// ============================================

export interface WorkflowExecution {
  id: number
  workflow_name: string
  status: "pending" | "running" | "completed" | "failed"
  started_at: string
  completed_at?: string
  results_json?: string
  error_message?: string
}

export interface AgentExecutionLog {
  id: number
  workflow_execution_id: number
  agent_name: string
  stage_name: string
  status: "pending" | "running" | "completed" | "failed"
  result_json?: string
  started_at: string
  completed_at?: string
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T
  message?: string
  request_id?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  request_id?: string
  timestamp?: string
}

export interface SuccessResponse {
  data?: Record<string, unknown>
  message?: string
  request_id?: string
}

// ============================================
// Entity type for category navigation in settings store
// ============================================

export type SettingsEntityType =
  | "character"
  | "item"
  | "location"
  | "faction"
  | "world"
  | "rule"
  | "outline"
  | "ifline"

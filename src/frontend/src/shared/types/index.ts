// Character
export interface Character {
  id: number;
  name: string;
  gender?: string;
  personality?: string;
  desires?: string;
  flaws?: string;
  description?: string;
  tier?: string;
  cultivation_realm?: string;
  created_at: string;
  updated_at: string;
}

export interface CharacterRelationship {
  id: number;
  character_id: number;
  target_id: number;
  type: string;
  description?: string;
}

export interface CharacterStoryline {
  id: number;
  character_id: number;
  title: string;
  arc?: string;
  progress: number;
}

// World entities
export interface Item {
  id: number;
  name: string;
  description?: string;
  owner?: string;
  location?: string;
}

export interface Location {
  id: number;
  name: string;
  description?: string;
  importance?: string;
}

export interface Faction {
  id: number;
  name: string;
  description?: string;
  type?: string;
}

export interface WorldSetting {
  id: number;
  name: string;
  description?: string;
  details_json?: string;
}

export interface Rule {
  id: number;
  name: string;
  description?: string;
  type?: string;
}

// Story structure
export interface Outline {
  id: number;
  title: string;
  description?: string;
}

export interface Chapter {
  id: number;
  outline_id?: number;
  title?: string;
  summary?: string;
  status: string;
  word_count: number;
  chapter_order: number;
  created_at: string;
  updated_at: string;
}

export interface IFLine {
  id: number;
  title: string;
  linked_character_id?: number;
  description?: string;
  sync_mode: string;
  created_at: string;
  updated_at: string;
}

// Chat
export interface ChatSession {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: string;
  content: string;
  created_at: string;
}

export interface ExtractedEntity {
  id: number;
  session_id: number;
  type: string;
  name: string;
  description?: string;
  confirmed: boolean;
  created_at: string;
}

// Writing
export interface DraftVersion {
  id: number;
  chapter_id: number;
  content: string;
  version_number: number;
  created_at: string;
}

export interface PlotThread {
  id: number;
  title: string;
  description?: string;
  status: string;
  created_chapter_id?: number;
  reveal_chapter_id?: number;
  created_at: string;
}

export interface AIInspectionResult {
  id: number;
  chapter_id: number;
  inspection_type: string;
  issues_json?: string;
  suggestions_json?: string;
  auto_fixed: boolean;
  created_at: string;
}

export interface WritingSettings {
  id: number;
  human_ai_ratio: number;
  writing_style: string;
  target_word_count: number;
  created_at: string;
  updated_at: string;
}

// API types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

// Entity type for category navigation in settings store
export type EntityType = 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule' | 'outline' | 'ifline';

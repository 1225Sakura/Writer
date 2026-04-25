/**
 * Genres API - Frontend wrappers for genre template and profile management.
 *
 * Covers:
 * - List genre presets (/genres)
 * - Get genre aliases (/genres/aliases)
 * - Get genre profile (/genres/{genre}/profile)
 * - Apply genre to project (/genres/{genre}/apply)
 * - Build profile from chapters (/genres/build-profile)
 * - Build writing guidance (/genres/{genre}/guidance)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenrePresetResponse {
  name: string
  profile_key: string
  description: string
  core_tropes: string[]
}

export interface GenreProfileResponse {
  genre: string
  profile_key: string
  description: string
  core_tropes: string[]
  narrative_rhythm: Record<string, unknown>
  terminology_hints: Record<string, unknown>
  character_archetypes: string[]
  world_building_focus: string[]
  pressure_source: string
  release_target: string
  guidance_text: string
  reference_hints: string[]
  composite_hints?: string[]
  secondary_genres?: string[]
}

export interface GenreApplyRequest {
  project_id: number
  genre: string
}

export interface GenreApplyResponse {
  project_id: number
  genre: string
  profile: Record<string, unknown>
  applied_at?: string
}

export interface AliasesResponse {
  input_aliases: Record<string, string[]>
  profile_key_aliases: Record<string, string[]>
  all_mappings: Record<string, Record<string, string>>
}

export interface BuildProfileRequest {
  project_id: number
  chapter_contents?: string[]
}

export interface BuiltProfileResponse {
  detected_genre: string
  genre_scores: Record<string, number>
  vocabulary: Record<string, unknown>
  syntax: Record<string, unknown>
  statistics: Record<string, unknown>
  preset_profile: Record<string, unknown>
}

export interface GuidanceRequest {
  chapter: number
  reader_signal?: Record<string, unknown>
  low_score_threshold?: number
  hook_diversify_enabled?: boolean
}

export interface StrategyCard {
  title: string
  description: string
  priority: string
}

export interface ChecklistItem {
  item: string
  completed: boolean
  category: string
}

export interface GuidanceResponse {
  chapter: number
  genre: string
  profile_key: string
  strategy_card: StrategyCard
  guidance: string[]
  methodology: string[]
  checklist: ChecklistItem[]
  checklist_completion: Record<string, unknown>
  risk_flags: string[]
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** List all available genre presets. */
export const listGenres = (): Promise<GenrePresetResponse[]> =>
  api.get<GenrePresetResponse[]>("/genres")

/** Get all genre alias mappings. */
export const getGenreAliases = (): Promise<AliasesResponse> =>
  api.get<AliasesResponse>("/genres/aliases")

/** Get a complete genre profile by name or profile key. */
export const getGenreProfile = (genre: string): Promise<GenreProfileResponse> =>
  api.get<GenreProfileResponse>(`/genres/${encodeURIComponent(genre)}/profile`)

/** Apply a genre to a project. */
export const applyGenre = (
  genre: string,
  request: GenreApplyRequest
): Promise<GenreApplyResponse> =>
  api.post<GenreApplyResponse>(`/genres/${encodeURIComponent(genre)}/apply`, request)

/** Build a genre profile from chapter contents. */
export const buildProfileFromChapters = (
  request: BuildProfileRequest
): Promise<BuiltProfileResponse> =>
  api.post<BuiltProfileResponse>("/genres/build-profile", request)

/** Build writing guidance for a genre and chapter. */
export const buildGuidance = (
  genre: string,
  request: GuidanceRequest
): Promise<GuidanceResponse> =>
  api.post<GuidanceResponse>(`/genres/${encodeURIComponent(genre)}/guidance`, request)

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const genresApi = {
  listGenres,
  getGenreAliases,
  getGenreProfile,
  applyGenre,
  buildProfileFromChapters,
  buildGuidance,
}

export default genresApi

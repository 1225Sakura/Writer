import { api } from "./request"
import type {
  AIReviewResult,
  AIReviewRequest,
  AIChapterInspectionResponse,
  CheckerBaseResponse,
  ContinuityCheckResponse,
  PacingCheckResponse,
  OOCCheckResponse,
  HighPointCheckResponse,
  ReaderPullCheckResponse,
  ExtractedEntity,
} from "./types"

// ============================================
// AI Review API
// ============================================

export const aiReviewApi = {
  /**
   * Review world settings for consistency using AI.
   * Analyzes characters, locations, items, factions, and rules
   * for logical consistency and potential issues.
   */
  reviewSettings: async (
    data: AIReviewRequest
  ): Promise<AIReviewResult> => {
    return api.post<AIReviewResult>("/ai/review", data)
  },

  /**
   * Run AI inspection on a chapter.
   * Checks for consistency, plot holes, character consistency, etc.
   */
  inspectChapter: async (
    chapterId: number
  ): Promise<AIChapterInspectionResponse> => {
    return api.post<AIChapterInspectionResponse>(`/ai/chapters/${chapterId}/inspect`)
  },

  /**
   * Extract entities from chat messages.
   * Returns extracted characters, locations, items, factions, etc.
   */
  extractEntities: async (
    chatMessages: Array<{ role: string; content: string }>
  ): Promise<{ entities: ExtractedEntity[] }> => {
    return api.post<{ entities: ExtractedEntity[] }>("/ai/extract-entities", {
      chat_messages: chatMessages,
    })
  },
}

// ============================================
// AI Checker API
// ============================================

export const checkerApi = {
  /**
   * Check world consistency for a chapter.
   * Validates locations, timelines, power levels, item ownership,
   * and faction relationships against established world settings.
   */
  checkConsistency: async (
    chapterId: number
  ): Promise<CheckerBaseResponse> => {
    return api.post<CheckerBaseResponse>("/ai/check/consistency", {
      chapter_id: chapterId,
    })
  },

  /**
   * Check scene and narrative continuity for a chapter.
   * Validates scene transitions, event consistency, character state continuity,
   * plot thread fulfillment, and detail coherence with previous chapters.
   */
  checkContinuity: async (
    chapterId: number
  ): Promise<ContinuityCheckResponse> => {
    return api.post<ContinuityCheckResponse>("/ai/check/continuity", {
      chapter_id: chapterId,
    })
  },

  /**
   * Check narrative pacing and strand ratios for a chapter.
   * Analyzes quest/fire/constellation strand ratios against the
   * target 60%/20%/20% distribution.
   */
  checkPacing: async (
    chapterId: number
  ): Promise<PacingCheckResponse> => {
    return api.post<PacingCheckResponse>("/ai/check/pacing", {
      chapter_id: chapterId,
    })
  },

  /**
   * Check for Out-Of-Character behavior.
   * Validates that a character's actions in the chapter are consistent
   * with their established personality, desires, and flaws.
   */
  checkOOC: async (
    chapterId: number,
    characterId: number
  ): Promise<OOCCheckResponse> => {
    return api.post<OOCCheckResponse>("/ai/check/ooc", {
      chapter_id: chapterId,
      character_id: characterId,
    })
  },

  /**
   * Check excitement density and high points for a chapter.
   * Analyzes climax distribution, emotional pacing, buildup adequacy,
   * and chapter-ending hook strength.
   */
  checkHighPoint: async (
    chapterId: number
  ): Promise<HighPointCheckResponse> => {
    return api.post<HighPointCheckResponse>("/ai/check/high-point", {
      chapter_id: chapterId,
    })
  },

  /**
   * Check reader engagement and hooks for a chapter.
   * Analyzes opening hooks, ending suspense, conflict drivers,
   * curiosity gaps, and emotional resonance points.
   */
  checkReaderPull: async (
    chapterId: number
  ): Promise<ReaderPullCheckResponse> => {
    return api.post<ReaderPullCheckResponse>("/ai/check/reader-pull", {
      chapter_id: chapterId,
    })
  },

  /**
   * Run all checkers on a chapter.
   * Convenience method that runs consistency, continuity, pacing,
   * high-point, and reader-pull checks.
   */
  checkAll: async (
    chapterId: number
  ): Promise<{
    consistency: CheckerBaseResponse
    continuity: ContinuityCheckResponse
    pacing: PacingCheckResponse
    highPoint: HighPointCheckResponse
    readerPull: ReaderPullCheckResponse
  }> => {
    const [consistency, continuity, pacing, highPoint, readerPull] =
      await Promise.all([
        checkerApi.checkConsistency(chapterId),
        checkerApi.checkContinuity(chapterId),
        checkerApi.checkPacing(chapterId),
        checkerApi.checkHighPoint(chapterId),
        checkerApi.checkReaderPull(chapterId),
      ])
    return { consistency, continuity, pacing, highPoint, readerPull }
  },
}

// Export all AI review APIs
export default {
  review: aiReviewApi,
  checker: checkerApi,
}

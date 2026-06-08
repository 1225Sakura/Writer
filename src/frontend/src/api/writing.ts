import type {
  Outline,
  Chapter,
  DraftVersion,
  IFLine,
  PlotThread,
  AIInspectionResult,
  AIGenerateRequest,
  AIContextResponse,
  AIExtractResponse,
  AIChapterInspectionResponse,
  DeepContextResponse,
  PaginationParams,
  ChapterFilters,
  IFLineFilters,
  PlotThreadFilters,
  ConsistencyCheckResponse,
  ContinuityCheckResponse,
  PacingCheckResponse,
  OOCCheckResponse,
  HighPointCheckResponse,
  ReaderPullCheckResponse,
  ChapterSnapshot,
  ChapterSnapshotDiff,
} from "./types"
import { api, resolveBaseURL, getApiKey } from "./request"

// ============================================
// Outlines
// ============================================

export const outlineApi = {
  /** List all story outlines. */
  list: async (params: PaginationParams = {}): Promise<Outline[]> => {
    const { skip = 0, limit = 50 } = params
    return api.get<Outline[]>("/chapters/outlines", { skip, limit })
  },

  /** Get a specific outline by ID. */
  get: async (outlineId: number): Promise<Outline> => {
    return api.get<Outline>(`/chapters/outlines/${outlineId}`)
  },

  /** Create a new story outline. */
  create: async (data: { title: string; description?: string }): Promise<Outline> => {
    return api.post<Outline>("/chapters/outlines", data)
  },

  /** Update an existing outline. */
  update: async (
    outlineId: number,
    data: { title?: string; description?: string }
  ): Promise<Outline> => {
    return api.patch<Outline>(`/chapters/outlines/${outlineId}`, data)
  },

  /** Delete an outline. */
  delete: async (outlineId: number): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/chapters/outlines/${outlineId}`)
  },
}

// ============================================
// Chapters
// ============================================

export const chapterApi = {
  /** List all chapters with optional filtering. */
  list: async (
    params: PaginationParams & ChapterFilters = {}
  ): Promise<Chapter[]> => {
    const { skip = 0, limit = 100, outline_id, status } = params
    return api.get<Chapter[]>("/chapters/", { skip, limit, outline_id, status })
  },

  /** Get a specific chapter by ID. */
  getById: async (chapterId: number): Promise<Chapter> => {
    return api.get<Chapter>(`/chapters/${chapterId}`)
  },

  /** Create a new chapter. */
  create: async (data: {
    outline_id?: number
    title?: string
    summary?: string
    status?: string
    word_count?: number
    chapter_order?: number
  }): Promise<Chapter> => {
    return api.post<Chapter>("/chapters/", data)
  },

  /** Update an existing chapter. */
  update: async (
    chapterId: number,
    data: {
      outline_id?: number
      title?: string
      summary?: string
      status?: string
      word_count?: number
      chapter_order?: number
      notes?: string
      note_category?: string
      note_pinned?: boolean
      battle_station_data?: string
    }
  ): Promise<Chapter> => {
    return api.patch<Chapter>(`/chapters/${chapterId}`, data)
  },

  /** Delete a chapter. */
  delete: async (chapterId: number): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/chapters/${chapterId}`)
  },
}

// ============================================
// Draft Versions
// ============================================

export const draftApi = {
  /** List all draft versions for a chapter. */
  list: async (
    chapterId: number,
    params: PaginationParams = {}
  ): Promise<DraftVersion[]> => {
    const { skip = 0, limit = 20 } = params
    return api.get<DraftVersion[]>(`/chapters/${chapterId}/drafts`, { skip, limit })
  },

  /** Create a new draft version for a chapter. */
  create: async (
    chapterId: number,
    data: { content: string; version_number: number }
  ): Promise<DraftVersion> => {
    return api.post<DraftVersion>(`/chapters/${chapterId}/drafts`, {
      chapter_id: chapterId,
      ...data,
    })
  },

  /** Get a specific draft version by version number. */
  getVersion: async (
    chapterId: number,
    versionNumber: number
  ): Promise<DraftVersion> => {
    return api.get<DraftVersion>(`/chapters/${chapterId}/drafts/${versionNumber}`)
  },

  /** Delete a draft version. */
  delete: async (chapterId: number, versionNumber: number): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/chapters/${chapterId}/drafts/${versionNumber}`)
  },
}

// ============================================
// IF Lines
// ============================================

export const ifLineApi = {
  /** List all IF lines with optional character filter. */
  list: async (
    params: PaginationParams & IFLineFilters = {}
  ): Promise<IFLine[]> => {
    const { skip = 0, limit = 50, character_id } = params
    return api.get<IFLine[]>("/chapters/if-lines", { skip, limit, character_id })
  },

  /** Get a specific IF line by ID. */
  get: async (ifLineId: number): Promise<IFLine> => {
    return api.get<IFLine>(`/chapters/if-lines/${ifLineId}`)
  },

  /** Create a new IF line. */
  create: async (data: {
    title: string
    linked_character_id?: number
    description?: string
    sync_mode?: string
  }): Promise<IFLine> => {
    return api.post<IFLine>("/chapters/if-lines", data)
  },

  /** Update an existing IF line. */
  update: async (
    ifLineId: number,
    data: {
      title?: string
      linked_character_id?: number
      description?: string
      sync_mode?: string
    }
  ): Promise<IFLine> => {
    return api.patch<IFLine>(`/chapters/if-lines/${ifLineId}`, data)
  },

  /** Delete an IF line. */
  delete: async (ifLineId: number): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/chapters/if-lines/${ifLineId}`)
  },
}

// ============================================
// Plot Threads
// ============================================

export const plotThreadApi = {
  /** List all plot threads with optional status filter. */
  list: async (
    params: PaginationParams & PlotThreadFilters = {}
  ): Promise<PlotThread[]> => {
    const { skip = 0, limit = 100, status } = params
    return api.get<PlotThread[]>("/chapters/plot-threads", { skip, limit, status })
  },

  /** Get a specific plot thread by ID. */
  get: async (plotThreadId: number): Promise<PlotThread> => {
    return api.get<PlotThread>(`/chapters/plot-threads/${plotThreadId}`)
  },

  /** Create a new plot thread. */
  create: async (data: {
    title: string
    description?: string
    status?: string
    created_chapter_id?: number
    reveal_chapter_id?: number
  }): Promise<PlotThread> => {
    return api.post<PlotThread>("/chapters/plot-threads", data)
  },

  /** Update an existing plot thread. */
  update: async (
    plotThreadId: number,
    data: {
      title?: string
      description?: string
      status?: string
      created_chapter_id?: number
      reveal_chapter_id?: number
    }
  ): Promise<PlotThread> => {
    return api.patch<PlotThread>(`/chapters/plot-threads/${plotThreadId}`, data)
  },

  /** Delete a plot thread. */
  delete: async (plotThreadId: number): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/chapters/plot-threads/${plotThreadId}`)
  },
}

// ============================================
// AI Inspections
// ============================================

export const inspectionApi = {
  /** List all AI inspection results for a chapter. */
  list: async (
    chapterId: number,
    params: PaginationParams = {}
  ): Promise<AIInspectionResult[]> => {
    const { skip = 0, limit = 20 } = params
    return api.get<AIInspectionResult[]>(`/chapters/${chapterId}/inspections`, { skip, limit })
  },

  /** Create a new AI inspection result for a chapter. */
  create: async (
    chapterId: number,
    data: {
      inspection_type: string
      issues_json?: string
      suggestions_json?: string
    }
  ): Promise<AIInspectionResult> => {
    return api.post<AIInspectionResult>(
      `/chapters/${chapterId}/inspections`,
      data
    )
  },
}

// ============================================
// Styles
// ============================================

export interface WritingStyleDef {
  id: string
  name: string
  description: string
}

export const stylesApi = {
  /** List all available writing styles. */
  list: async (): Promise<WritingStyleDef[]> => {
    return api.get<WritingStyleDef[]>("/styles")
  },

  /** Get a specific writing style by ID. */
  get: async (styleId: string): Promise<WritingStyleDef> => {
    return api.get<WritingStyleDef>(`/styles/${styleId}`)
  },
}

// ============================================
// AI Checkers
// ============================================

export const checkerApi = {
  /** Check world consistency for a chapter. */
  consistency: async (chapterId: number): Promise<ConsistencyCheckResponse> => {
    return api.post<ConsistencyCheckResponse>("/ai/check/consistency", { chapter_id: chapterId })
  },

  /** Check narrative continuity for a chapter. */
  continuity: async (chapterId: number): Promise<ContinuityCheckResponse> => {
    return api.post<ContinuityCheckResponse>("/ai/check/continuity", { chapter_id: chapterId })
  },

  /** Check narrative pacing for a chapter. */
  pacing: async (chapterId: number): Promise<PacingCheckResponse> => {
    return api.post<PacingCheckResponse>("/ai/check/pacing", { chapter_id: chapterId })
  },

  /** Check for Out-Of-Character behavior. */
  ooc: async (chapterId: number, characterId: number): Promise<OOCCheckResponse> => {
    return api.post<OOCCheckResponse>("/ai/check/ooc", { chapter_id: chapterId, character_id: characterId })
  },

  /** Check excitement density and high points. */
  highPoint: async (chapterId: number): Promise<HighPointCheckResponse> => {
    return api.post<HighPointCheckResponse>("/ai/check/high-point", { chapter_id: chapterId })
  },

  /** Check reader engagement and hooks. */
  readerPull: async (chapterId: number): Promise<ReaderPullCheckResponse> => {
    return api.post<ReaderPullCheckResponse>("/ai/check/reader-pull", { chapter_id: chapterId })
  },
}

// ============================================
// AI Operations
// ============================================

export const aiApi = {
  /**
   * Generate AI content with streaming response.
   * Uses fetch API (not axios) because axios does not support
   * responseType: "stream" in browser environments.
   */
  generate: async (data: AIGenerateRequest): Promise<{
    stream: ReadableStream<Uint8Array>
    headers: { operation: string; "human-ai-ratio": string; style: string }
  }> => {
    const baseURL = await resolveBaseURL()
    const url = `${baseURL}/ai/generate`

    // Reuse the same API key logic as the axios interceptor
    const apiKey = await getApiKey()

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error")
      throw new Error(`AI generation failed: ${response.status} ${errorText}`)
    }

    if (!response.body) {
      throw new Error("AI generation failed: response body is null")
    }

    return {
      stream: response.body,
      headers: {
        operation: response.headers.get("x-operation") || data.operation,
        "human-ai-ratio": response.headers.get("x-human-ai-ratio") || String(data.human_ai_ratio ?? 70),
        style: response.headers.get("x-style") || data.style || "default",
      },
    }
  },

  /**
   * Build a writing execution context for a chapter.
   * Returns a complete context package with core task, characters, constraints, etc.
   */
  buildContext: async (chapterId: number): Promise<AIContextResponse> => {
    return api.post<AIContextResponse>("/ai/context", { chapter_id: chapterId })
  },

  /**
   * Build a deep narrative context for a chapter.
   * Returns previous chapter summary, associated characters, plot thread statuses,
   * outline info, and IF lines.
   */
  buildDeepContext: async (chapterId: number): Promise<DeepContextResponse> => {
    return api.post<DeepContextResponse>("/ai/context/deep", { chapter_id: chapterId })
  },

  /**
   * Extract structured entities from chapter content.
   * Returns entities, relationships, state changes, scenes, and summary.
   */
  extract: async (content: string, chapterId?: number): Promise<AIExtractResponse> => {
    return api.post<AIExtractResponse>("/ai/extract", { content, chapter_id: chapterId })
  },

  /**
   * Run AI inspection on a chapter.
   * Checks for consistency, plot holes, character consistency, etc.
   */
  inspectChapter: async (chapterId: number): Promise<AIChapterInspectionResponse> => {
    return api.post<AIChapterInspectionResponse>(`/ai/chapters/${chapterId}/inspect`)
  },

  // Convenience methods for specific operations

  /** Optimize content. */
  optimize: async (
    content: string,
    chapterId?: number,
    humanAiRatio?: number
  ): Promise<{ stream: ReadableStream<Uint8Array>; headers: { operation: string; "human-ai-ratio": string; style: string } }> => {
    return aiApi.generate({
      prompt: content,
      operation: "optimize",
      chapter_id: chapterId,
      human_ai_ratio: humanAiRatio,
    })
  },

  /** Expand content. */
  expand: async (
    content: string,
    chapterId?: number,
    humanAiRatio?: number
  ): Promise<{ stream: ReadableStream<Uint8Array>; headers: { operation: string; "human-ai-ratio": string; style: string } }> => {
    return aiApi.generate({
      prompt: content,
      operation: "expand",
      chapter_id: chapterId,
      human_ai_ratio: humanAiRatio,
    })
  },

  /** Condense/shrink content. */
  shrink: async (
    content: string,
    chapterId?: number,
    humanAiRatio?: number
  ): Promise<{ stream: ReadableStream<Uint8Array>; headers: { operation: string; "human-ai-ratio": string; style: string } }> => {
    return aiApi.generate({
      prompt: content,
      operation: "condense",
      chapter_id: chapterId,
      human_ai_ratio: humanAiRatio,
    })
  },

  /** Rewrite content. */
  rewrite: async (
    content: string,
    chapterId?: number,
    humanAiRatio?: number
  ): Promise<{ stream: ReadableStream<Uint8Array>; headers: { operation: string; "human-ai-ratio": string; style: string } }> => {
    return aiApi.generate({
      prompt: content,
      operation: "rewrite",
      chapter_id: chapterId,
      human_ai_ratio: humanAiRatio,
    })
  },

  /** Continue writing from content. */
  continue: async (
    content: string,
    chapterId?: number,
    humanAiRatio?: number
  ): Promise<{ stream: ReadableStream<Uint8Array>; headers: { operation: string; "human-ai-ratio": string; style: string } }> => {
    return aiApi.generate({
      prompt: content,
      operation: "continue",
      chapter_id: chapterId,
      human_ai_ratio: humanAiRatio,
    })
  },

  /** Polish content. */
  polish: async (
    content: string,
    chapterId?: number,
    humanAiRatio?: number
  ): Promise<{ stream: ReadableStream<Uint8Array>; headers: { operation: string; "human-ai-ratio": string; style: string } }> => {
    return aiApi.generate({
      prompt: content,
      operation: "polish",
      chapter_id: chapterId,
      human_ai_ratio: humanAiRatio,
    })
  },

  /** Evaluate AI output quality. Returns scores for coherence, style consistency, and plot reasonability. */
  evaluateQuality: async (
    original: string,
    result: string,
    operation?: string
  ): Promise<{ overall: number; coherence: number; style_consistency: number; plot_reasonability: number }> => {
    return api.post<{ overall: number; coherence: number; style_consistency: number; plot_reasonability: number }>(
      "/ai/evaluate-quality",
      { original, result, operation }
    )
  },
}

// ============================================
// Chapter Snapshots
// ============================================

export const snapshotApi = {
  /** List all snapshots for a chapter. */
  list: async (
    chapterId: number,
    params: PaginationParams = {}
  ): Promise<ChapterSnapshot[]> => {
    const { skip = 0, limit = 50 } = params
    return api.get<ChapterSnapshot[]>(`/chapters/${chapterId}/snapshots`, { skip, limit })
  },

  /** Create a new snapshot for a chapter. */
  create: async (
    chapterId: number,
    data?: { content?: string; label?: string }
  ): Promise<ChapterSnapshot> => {
    return api.post<ChapterSnapshot>(`/chapters/${chapterId}/snapshots`, {
      chapter_id: chapterId,
      ...data,
    })
  },

  /** Mark or unmark a snapshot. */
  mark: async (
    chapterId: number,
    snapshotId: number,
    data: { is_marked: boolean; label?: string }
  ): Promise<ChapterSnapshot> => {
    return api.patch<ChapterSnapshot>(
      `/chapters/${chapterId}/snapshots/${snapshotId}/mark`,
      data
    )
  },

  /** Get diff between two snapshots. */
  diff: async (data: {
    old_snapshot_id: number
    new_snapshot_id: number
  }): Promise<ChapterSnapshotDiff> => {
    return api.post<ChapterSnapshotDiff>("/chapters/snapshots/diff", data)
  },
}

// Export all APIs
export default {
  outline: outlineApi,
  chapter: chapterApi,
  draft: draftApi,
  ifLine: ifLineApi,
  plotThread: plotThreadApi,
  inspection: inspectionApi,
  ai: aiApi,
  styles: stylesApi,
  checker: checkerApi,
  snapshot: snapshotApi,
}

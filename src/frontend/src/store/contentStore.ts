import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  outlineApi,
  chapterApi,
  draftApi,
  ifLineApi,
  plotThreadApi,
  inspectionApi,
} from '../api/writing'
import type {
  Chapter,
  Outline,
  IFLine,
  PlotThread,
  DraftVersion,
  AIInspectionResult,
} from '../api/types'
import { showOperationError } from '../utils/toastHelper'

// ============================================
// Types
// ============================================

export interface DraftVersionLocal {
  id: string
  chapterId: string
  content: string
  versionNumber: number
  createdAt: number
}

export interface PlotThreadLocal {
  id: string
  title: string
  description?: string
  status: 'open' | 'revealed' | 'closed'
  createdChapterId: string
  revealChapterId?: string
}

export interface AIInspectionResultLocal {
  id: string
  chapterId: string
  inspectionType: 'consistency' | 'relationship' | 'foreshadowing' | 'suggestion'
  issues: string[]
  suggestions: string[]
  autoFixed: boolean
  createdAt: number
}

interface ContentLoadingState {
  outlines: boolean
  ifLines: boolean
  plotThreads: boolean
  drafts: boolean
  inspections: boolean
}

interface ContentState {
  chapters: Chapter[]
  outlines: Outline[]
  ifLines: IFLine[]
  plotThreads: PlotThread[]
  draftVersions: DraftVersion[]
  inspectionResults: AIInspectionResult[]
  loading: ContentLoadingState
}

interface ContentActions {
  // Chapter CRUD
  setChapters: (chapters: Chapter[]) => void
  fetchChapters: () => Promise<void>
  createChapter: (data: {
    outline_id?: number
    title?: string
    summary?: string
    chapter_order?: number
    status?: string
    word_count?: number
  }) => Promise<Chapter>
  updateChapter: (id: number, updates: Partial<Chapter>) => Promise<void>
  deleteChapter: (id: number) => Promise<void>

  // Outline CRUD
  fetchOutlines: () => Promise<void>
  createOutline: (data: { title: string; description?: string }) => Promise<Outline>
  updateOutline: (id: number, updates: { title?: string; description?: string }) => Promise<void>
  deleteOutline: (id: number) => Promise<void>

  // Draft versions
  fetchDrafts: (chapterId: number) => Promise<void>
  saveDraftVersion: (chapterId: number, content: string) => Promise<DraftVersion>
  restoreDraftVersion: (chapterId: number, versionNumber: number) => Promise<string>
  getDraftVersions: (chapterId: number) => DraftVersion[]
  deleteDraftVersion: (draftId: number) => Promise<void>

  // IFLine CRUD
  fetchIFLines: (characterId?: number) => Promise<void>
  createIFLine: (data: {
    title: string
    linked_character_id?: number
    description?: string
    sync_mode?: string
  }) => Promise<IFLine>
  updateIFLine: (id: number, updates: Partial<IFLine>) => Promise<void>
  deleteIFLine: (id: number) => Promise<void>

  // Plot thread CRUD
  fetchPlotThreads: (status?: string) => Promise<void>
  createPlotThread: (data: {
    title: string
    description?: string
    status?: string
    created_chapter_id?: number
    reveal_chapter_id?: number
  }) => Promise<PlotThread>
  updatePlotThread: (id: number, updates: Partial<PlotThread>) => Promise<void>
  deletePlotThread: (id: number) => Promise<void>

  // Inspections
  fetchInspections: (chapterId: number) => Promise<void>
  createInspection: (
    chapterId: number,
    data: { inspection_type: string; issues_json?: string; suggestions_json?: string }
  ) => Promise<AIInspectionResult>
}

// ============================================
// Store
// ============================================

export const useContentStore = create<ContentState & ContentActions>()(
  immer(
    subscribeWithSelector((set, get) => ({
      // Initial state
      chapters: [],
      outlines: [],
      ifLines: [],
      plotThreads: [],
      draftVersions: [],
      inspectionResults: [],
      loading: {
        outlines: false,
        ifLines: false,
        plotThreads: false,
        drafts: false,
        inspections: false,
      },

      // ----------------------------------------
      // Chapter CRUD
      // ----------------------------------------

      setChapters: (chapters) => {
        set((state) => { state.chapters = chapters })
      },

      fetchChapters: async () => {
        try {
          const chapters = await chapterApi.list()
          set((state) => { state.chapters = chapters })
        } catch (error) {
          showOperationError('fetchChapters', error)
        }
      },

      createChapter: async (data) => {
        try {
          const chapter = await chapterApi.create({
            ...data,
            status: data.status || 'planning',
            word_count: data.word_count || 0,
          })
          set((state) => { state.chapters.push(chapter) })
          return chapter
        } catch (error) {
          showOperationError('创建章节', error)
          throw error
        }
      },

      updateChapter: async (id, updates) => {
        try {
          await chapterApi.update(id, updates)
          set((state) => {
            const ch = state.chapters.find((c) => c.id === id)
            if (ch) Object.assign(ch, updates)
          })
        } catch (error) {
          showOperationError('更新章节', error)
        }
      },

      deleteChapter: async (id) => {
        try {
          await chapterApi.delete(id)
          set((state) => {
            state.chapters = state.chapters.filter((c) => c.id !== id)
          })
        } catch (error) {
          showOperationError('删除章节', error)
        }
      },

      // ----------------------------------------
      // Outline CRUD
      // ----------------------------------------

      fetchOutlines: async () => {
        set((state) => { state.loading.outlines = true })
        try {
          const outlines = await outlineApi.list()
          set((state) => { state.outlines = outlines })
        } catch (error) {
          showOperationError('fetchOutlines', error)
        } finally {
          set((state) => { state.loading.outlines = false })
        }
      },

      createOutline: async (data) => {
        try {
          const outline = await outlineApi.create(data)
          set((state) => { state.outlines.push(outline) })
          return outline
        } catch (error) {
          showOperationError('创建大纲', error)
          throw error
        }
      },

      updateOutline: async (id, updates) => {
        try {
          await outlineApi.update(id, updates)
          set((state) => {
            const o = state.outlines.find((x) => x.id === id)
            if (o) Object.assign(o, updates)
          })
        } catch (error) {
          showOperationError('更新大纲', error)
        }
      },

      deleteOutline: async (id) => {
        try {
          await outlineApi.delete(id)
          set((state) => {
            state.outlines = state.outlines.filter((o) => o.id !== id)
          })
        } catch (error) {
          showOperationError('删除大纲', error)
        }
      },

      // ----------------------------------------
      // Draft Versions
      // ----------------------------------------

      fetchDrafts: async (chapterId) => {
        set((state) => { state.loading.drafts = true })
        try {
          const drafts = await draftApi.list(chapterId)
          set((state) => { state.draftVersions = drafts })
        } catch (error) {
          showOperationError('fetchDrafts', error)
        } finally {
          set((state) => { state.loading.drafts = false })
        }
      },

      saveDraftVersion: async (chapterId, content) => {
        try {
          const existingDrafts = get().draftVersions.filter(
            (d) => d.chapter_id === chapterId
          )
          const versionNumber = existingDrafts.length + 1
          const draft = await draftApi.create(chapterId, {
            content,
            version_number: versionNumber,
          })
          set((state) => { state.draftVersions.push(draft) })
          return draft
        } catch (error) {
          showOperationError('保存草稿', error)
          throw error
        }
      },

      restoreDraftVersion: async (chapterId, versionNumber) => {
        try {
          const draft = await draftApi.getVersion(chapterId, versionNumber)
          return draft.content
        } catch (error) {
          showOperationError('恢复草稿', error)
          throw error
        }
      },

      getDraftVersions: (chapterId) => {
        return get().draftVersions
          .filter((d) => d.chapter_id === chapterId)
          .sort((a, b) => b.version_number - a.version_number)
      },

      deleteDraftVersion: async (draftId) => {
        try {
          const draft = get().draftVersions.find((d) => d.id === draftId)
          if (!draft) return
          await draftApi.delete(draft.chapter_id, draft.version_number)
          set((state) => {
            state.draftVersions = state.draftVersions.filter((d) => d.id !== draftId)
          })
        } catch (error) {
          showOperationError('删除草稿', error)
        }
      },

      // ----------------------------------------
      // IFLine CRUD
      // ----------------------------------------

      fetchIFLines: async (characterId) => {
        set((state) => { state.loading.ifLines = true })
        try {
          const ifLines = await ifLineApi.list({ character_id: characterId })
          set((state) => { state.ifLines = ifLines })
        } catch (error) {
          showOperationError('fetchIFLines', error)
        } finally {
          set((state) => { state.loading.ifLines = false })
        }
      },

      createIFLine: async (data) => {
        try {
          const ifLine = await ifLineApi.create(data)
          set((state) => { state.ifLines.push(ifLine) })
          return ifLine
        } catch (error) {
          showOperationError('创建IF线', error)
          throw error
        }
      },

      updateIFLine: async (id, updates) => {
        try {
          await ifLineApi.update(id, updates)
          set((state) => {
            const line = state.ifLines.find((l) => l.id === id)
            if (line) Object.assign(line, updates)
          })
        } catch (error) {
          showOperationError('更新IF线', error)
        }
      },

      deleteIFLine: async (id) => {
        try {
          await ifLineApi.delete(id)
          set((state) => {
            state.ifLines = state.ifLines.filter((l) => l.id !== id)
          })
        } catch (error) {
          showOperationError('删除IF线', error)
        }
      },

      // ----------------------------------------
      // Plot Thread CRUD
      // ----------------------------------------

      fetchPlotThreads: async (status) => {
        set((state) => { state.loading.plotThreads = true })
        try {
          const plotThreads = await plotThreadApi.list({ status: status as 'active' | 'resolved' | 'abandoned' | 'hidden' })
          set((state) => { state.plotThreads = plotThreads })
        } catch (error) {
          showOperationError('fetchPlotThreads', error)
        } finally {
          set((state) => { state.loading.plotThreads = false })
        }
      },

      createPlotThread: async (data) => {
        try {
          const plotThread = await plotThreadApi.create(data)
          set((state) => { state.plotThreads.push(plotThread) })
          return plotThread
        } catch (error) {
          showOperationError('创建情节线', error)
          throw error
        }
      },

      updatePlotThread: async (id, updates) => {
        try {
          await plotThreadApi.update(id, updates)
          set((state) => {
            const pt = state.plotThreads.find((p) => p.id === id)
            if (pt) Object.assign(pt, updates)
          })
        } catch (error) {
          showOperationError('更新情节线', error)
        }
      },

      deletePlotThread: async (id) => {
        try {
          await plotThreadApi.delete(id)
          set((state) => {
            state.plotThreads = state.plotThreads.filter((p) => p.id !== id)
          })
        } catch (error) {
          showOperationError('删除情节线', error)
        }
      },

      // ----------------------------------------
      // Inspections
      // ----------------------------------------

      fetchInspections: async (chapterId) => {
        set((state) => { state.loading.inspections = true })
        try {
          const inspections = await inspectionApi.list(chapterId)
          set((state) => {
            state.inspectionResults = [
              ...state.inspectionResults.filter((i) => i.chapter_id !== chapterId),
              ...inspections,
            ]
          })
        } catch (error) {
          showOperationError('fetchInspections', error)
        } finally {
          set((state) => { state.loading.inspections = false })
        }
      },

      createInspection: async (chapterId, data) => {
        try {
          const inspection = await inspectionApi.create(chapterId, data)
          set((state) => { state.inspectionResults.push(inspection) })
          return inspection
        } catch (error) {
          showOperationError('创建审查', error)
          throw error
        }
      },
    }))
  )
)

// ============================================
// Selectors
// ============================================

export const selectChapterById = (state: ContentState, chapterId: number | null) =>
  state.chapters.find((c) => c.id === chapterId)

export const selectChapters = (state: ContentState) => state.chapters

export const selectDraftVersionsForChapter = (state: ContentState, chapterId: number | null) =>
  chapterId
    ? state.draftVersions
        .filter((d) => d.chapter_id === chapterId)
        .sort((a, b) => b.version_number - a.version_number)
    : []

export const selectContentLoading = (state: ContentState) => state.loading

export function cleanupContentStore() {
  useContentStore.setState((state) => {
    state.loading.outlines = false
    state.loading.ifLines = false
    state.loading.plotThreads = false
    state.loading.drafts = false
    state.loading.inspections = false
  })
}

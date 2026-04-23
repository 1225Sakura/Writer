import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Editor } from '@tiptap/react'
import {
  outlineApi,
  chapterApi,
  draftApi,
  ifLineApi,
  plotThreadApi,
  inspectionApi,
  aiApi,
} from '../api/writing'
import { writingSettingsApi } from '../api/settings'
import { consumeStream } from '../api/chat'
import type {
  Chapter,
  Outline,
  IFLine,
  PlotThread,
  DraftVersion,
  AIInspectionResult,
} from '../api/types'
import { createHybridStorage } from './utils/indexedDBStorage'

// ============================================
// Types
// ============================================

export type WritingStyle = 'default' | 'jiangnan' | 'kafka' | 'camus' | 'custom'

export interface DraftVersionLocal {
  id: string
  chapterId: string
  content: string
  versionNumber: number
  createdAt: number
}

export interface ChapterNote {
  id: string
  chapterId: number
  content: string
  createdAt: number
  updatedAt: number
}

export interface WritingSession {
  startTime: number
  endTime?: number
  wordCountStart: number
  wordCountEnd: number
  chapterId: number
}

export interface DailyStats {
  date: string
  wordCount: number
  sessionCount: number
  sessionMinutes: number
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

/** AI生成队列项 */
export interface AIGenerationJob {
  id: string
  type: 'optimize' | 'expand' | 'condense' | 'rewrite' | 'continue' | 'polish'
  content: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: string
  error?: string
  createdAt: number
  completedAt?: number
  progress: number
  retryCount: number
}

/** 自动保存状态 */
export type AutoSaveState = 'idle' | 'saving' | 'saved' | 'unsaved' | 'error'

interface LoadingState {
  chapters: boolean
  outlines: boolean
  ifLines: boolean
  plotThreads: boolean
  drafts: boolean
  ai: boolean
}

interface WritingState {
  // Core
  currentChapterId: number | null
  currentContent: string
  wordCount: number
  targetWordCount: number
  chapters: Chapter[]
  outlines: Outline[]
  ifLines: IFLine[]
  plotThreads: PlotThread[]
  draftVersions: DraftVersion[]
  inspectionResults: AIInspectionResult[]

  // Writing config
  humanAIRatio: number
  writingStyle: WritingStyle

  // Editor
  editor: Editor | null

  // Warnings
  oocWarnings: string[]
  powerImbalanceWarnings: string[]

  // Loading
  loading: LoadingState

  // Notes
  chapterNotes: ChapterNote[]

  // Session
  sessionStartTime: number | null
  sessionWordCountStart: number

  // Stats
  dailyStats: DailyStats[]

  // Auto-save
  saveStatus: AutoSaveState
  lastSavedAt: number | null
  autoSaveEnabled: boolean
  autoSaveInterval: number

  // AI Generation Queue
  aiJobQueue: AIGenerationJob[]
  currentJobId: string | null

  // Error
  error: string | null
}

interface WritingActions {
  // Init
  init: () => Promise<void>

  // Chapter
  setCurrentChapter: (chapterId: number | null) => void
  updateContent: (content: string) => void
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
  saveCurrentChapter: () => Promise<void>

  // Auto-save
  triggerAutoSave: () => Promise<void>
  setAutoSaveEnabled: (enabled: boolean) => void
  setAutoSaveInterval: (intervalMs: number) => void

  // Outline
  fetchOutlines: () => Promise<void>
  createOutline: (data: { title: string; description?: string }) => Promise<Outline>
  updateOutline: (id: number, updates: { title?: string; description?: string }) => Promise<void>
  deleteOutline: (id: number) => Promise<void>

  // Draft versions
  fetchDrafts: (chapterId: number) => Promise<void>
  saveDraftVersion: (chapterId: number, content: string) => Promise<DraftVersion>
  restoreDraftVersion: (chapterId: number, versionNumber: number) => Promise<void>
  getDraftVersions: (chapterId: number) => DraftVersion[]
  deleteDraftVersion: (draftId: number) => Promise<void>

  // IFLine
  fetchIFLines: (characterId?: number) => Promise<void>
  createIFLine: (data: {
    title: string
    linked_character_id?: number
    description?: string
    sync_mode?: string
  }) => Promise<IFLine>
  updateIFLine: (id: number, updates: Partial<IFLine>) => Promise<void>
  deleteIFLine: (id: number) => Promise<void>

  // Plot threads
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

  // AI operations with queue
  optimize: (content: string) => Promise<string>
  expand: (content: string) => Promise<string>
  condense: (content: string) => Promise<string>
  rewrite: (content: string) => Promise<string>
  continue: (content: string) => Promise<string>
  polish: (content: string) => Promise<string>

  // AI Queue management
  addJob: (type: AIGenerationJob['type'], content: string) => string
  cancelJob: (jobId: string) => void
  clearCompletedJobs: () => void
  retryJob: (jobId: string) => Promise<void>
  getJobStatus: (jobId: string) => AIGenerationJob | undefined
  /** @internal Process next job in queue */
  processNextJob: () => Promise<void>
  /** @internal Wait for a specific job to complete */
  waitForJob: (jobId: string) => Promise<void>

  // Config
  setHumanAIRatio: (ratio: number) => void
  setWritingStyle: (style: WritingStyle) => void
  setTargetWordCount: (count: number) => void
  setEditor: (editor: Editor | null) => void

  // Warnings
  setOOCWarnings: (warnings: string[]) => void
  setPowerImbalanceWarnings: (warnings: string[]) => void
  clearWarnings: () => void

  // Notes
  getChapterNote: (chapterId: number) => ChapterNote | undefined
  setChapterNote: (chapterId: number, content: string) => void
  deleteChapterNote: (chapterId: number) => void

  // Session tracking
  startWritingSession: (chapterId: number, wordCount: number) => void
  endWritingSession: () => WritingSession | null
  getSessionDuration: () => number
  getSessionWPM: () => number

  // Daily stats
  getDailyStats: (date?: string) => DailyStats | undefined
  getTodayWordCount: () => number

  // Save status
  setSaveStatus: (status: AutoSaveState) => void
  markSaved: () => void
  markUnsaved: () => void
}

// ============================================
// Helpers
// ============================================

const genJobId = () => `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const genNoteId = (chapterId: number) => `note-${chapterId}-${Date.now()}`

// ============================================
// Store
// ============================================

export const useWritingStore = create<WritingState & WritingActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
          currentChapterId: null,
          currentContent: '',
          wordCount: 0,
          targetWordCount: 2000,
          chapters: [],
          outlines: [],
          ifLines: [],
          plotThreads: [],
          draftVersions: [],
          inspectionResults: [],
          humanAIRatio: 70,
          writingStyle: 'default',
          editor: null,
          oocWarnings: [],
          powerImbalanceWarnings: [],
          loading: {
            chapters: false,
            outlines: false,
            ifLines: false,
            plotThreads: false,
            drafts: false,
            ai: false,
          },
          chapterNotes: [],
          sessionStartTime: null,
          sessionWordCountStart: 0,
          dailyStats: [],
          saveStatus: 'idle',
          lastSavedAt: null,
          autoSaveEnabled: true,
          autoSaveInterval: 30000,
          aiJobQueue: [],
          currentJobId: null,
          error: null,

          // ----------------------------------------
          // Init
          // ----------------------------------------

          init: async () => {
            set((state) => {
              state.loading.chapters = true
              state.loading.outlines = true
            })
            try {
              const [chapters, outlines, settings] = await Promise.all([
                chapterApi.list(),
                outlineApi.list(),
                writingSettingsApi.get().catch(() => null),
              ])
              set((state) => {
                state.chapters = chapters
                state.outlines = outlines
                // Override local settings with backend settings if available
                if (settings) {
                  if (settings.human_ai_ratio !== undefined) {
                    state.humanAIRatio = Math.round(settings.human_ai_ratio * 100)
                  }
                  if (settings.writing_style) {
                    state.writingStyle = settings.writing_style as WritingStyle
                  }
                  if (settings.target_word_count) {
                    state.targetWordCount = settings.target_word_count
                  }
                }
              })
            } catch (error) {
              console.error('Failed to initialize writing store:', error)
            } finally {
              set((state) => {
                state.loading.chapters = false
                state.loading.outlines = false
              })
            }
          },

          // ----------------------------------------
          // Chapter
          // ----------------------------------------

          setCurrentChapter: (chapterId) => {
            const state = get()
            // End previous session
            if (state.sessionStartTime && state.currentChapterId) {
              state.endWritingSession()
            }
            set((s) => {
              s.currentChapterId = chapterId
              s.currentContent = ''
              s.wordCount = 0
              s.saveStatus = 'idle'
            })
            if (chapterId) {
              get().fetchDrafts(chapterId)
              get().startWritingSession(chapterId, 0)
            }
          },

          updateContent: (content) => {
            const wordCount = content.replace(/\s/g, '').length
            set((state) => {
              state.currentContent = content
              state.wordCount = wordCount
              if (state.autoSaveEnabled && state.saveStatus !== 'saving') {
                state.saveStatus = 'unsaved'
              }
            })
          },

          setChapters: (chapters) => {
            set((state) => { state.chapters = chapters })
          },

          fetchChapters: async () => {
            set((state) => { state.loading.chapters = true })
            try {
              const chapters = await chapterApi.list()
              set((state) => { state.chapters = chapters })
            } catch (error) {
              console.error('Failed to fetch chapters:', error)
            } finally {
              set((state) => { state.loading.chapters = false })
            }
          },

          createChapter: async (data) => {
            const chapter = await chapterApi.create({
              ...data,
              status: data.status || 'planning',
              word_count: data.word_count || 0,
            })
            set((state) => { state.chapters.push(chapter) })
            return chapter
          },

          updateChapter: async (id, updates) => {
            await chapterApi.update(id, updates)
            set((state) => {
              const ch = state.chapters.find((c) => c.id === id)
              if (ch) Object.assign(ch, updates)
            })
          },

          deleteChapter: async (id) => {
            await chapterApi.delete(id)
            set((state) => {
              state.chapters = state.chapters.filter((c) => c.id !== id)
              if (state.currentChapterId === id) {
                state.currentChapterId = null
                state.currentContent = ''
              }
            })
          },

          saveCurrentChapter: async () => {
            const { currentChapterId, currentContent } = get()
            if (!currentChapterId) return
            const wordCount = currentContent.replace(/\s/g, '').length
            set((state) => { state.saveStatus = 'saving' })
            try {
              // Update chapter metadata
              await chapterApi.update(currentChapterId, { word_count: wordCount })

              // Save content as draft version
              if (currentContent.trim()) {
                const existingDrafts = get().draftVersions.filter(
                  (d) => d.chapter_id === currentChapterId
                )
                await draftApi.create(currentChapterId, {
                  content: currentContent,
                  version_number: existingDrafts.length + 1,
                })
                // Refresh drafts
                const updatedDrafts = await draftApi.list(currentChapterId)
                set((state) => { state.draftVersions = updatedDrafts })
              }

              set((state) => {
                const ch = state.chapters.find((c) => c.id === currentChapterId)
                if (ch) {
                  ch.word_count = wordCount
                }
                state.saveStatus = 'saved'
                state.lastSavedAt = Date.now()
              })
            } catch (error) {
              console.error('Failed to save chapter:', error)
              set((state) => { state.saveStatus = 'error' })
            }
          },

          // ----------------------------------------
          // Auto-save
          // ----------------------------------------

          triggerAutoSave: async () => {
            const { currentChapterId, currentContent, saveStatus } = get()
            if (!currentChapterId || saveStatus === 'saving') return
            if (!currentContent.trim()) return

            set((state) => { state.saveStatus = 'saving' })
            try {
              const wordCount = currentContent.replace(/\s/g, '').length
              await chapterApi.update(currentChapterId, { word_count: wordCount })

              // Also save draft version periodically
              const drafts = get().draftVersions.filter(
                (d) => d.chapter_id === currentChapterId
              )
              const shouldSaveDraft = drafts.length === 0 ||
                (get().lastSavedAt && Date.now() - get().lastSavedAt! > 5 * 60 * 1000)

              if (shouldSaveDraft) {
                await draftApi.create(currentChapterId, {
                  content: currentContent,
                  version_number: drafts.length + 1,
                })
                // Refresh drafts
                const updatedDrafts = await draftApi.list(currentChapterId)
                set((state) => { state.draftVersions = updatedDrafts })
              }

              set((state) => {
                state.saveStatus = 'saved'
                state.lastSavedAt = Date.now()
                const ch = state.chapters.find((c) => c.id === currentChapterId)
                if (ch) ch.word_count = wordCount
              })
            } catch (error) {
              console.error('Auto-save failed:', error)
              set((state) => { state.saveStatus = 'error' })
            }
          },

          setAutoSaveEnabled: (enabled) => {
            set((state) => { state.autoSaveEnabled = enabled })
          },

          setAutoSaveInterval: (intervalMs) => {
            set((state) => { state.autoSaveInterval = intervalMs })
          },

          // ----------------------------------------
          // Outline
          // ----------------------------------------

          fetchOutlines: async () => {
            set((state) => { state.loading.outlines = true })
            try {
              const outlines = await outlineApi.list()
              set((state) => { state.outlines = outlines })
            } catch (error) {
              console.error('Failed to fetch outlines:', error)
            } finally {
              set((state) => { state.loading.outlines = false })
            }
          },

          createOutline: async (data) => {
            const outline = await outlineApi.create(data)
            set((state) => { state.outlines.push(outline) })
            return outline
          },

          updateOutline: async (id, updates) => {
            await outlineApi.update(id, updates)
            set((state) => {
              const o = state.outlines.find((x) => x.id === id)
              if (o) Object.assign(o, updates)
            })
          },

          deleteOutline: async (id) => {
            await outlineApi.delete(id)
            set((state) => {
              state.outlines = state.outlines.filter((o) => o.id !== id)
            })
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
              console.error('Failed to fetch drafts:', error)
            } finally {
              set((state) => { state.loading.drafts = false })
            }
          },

          saveDraftVersion: async (chapterId, content) => {
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
          },

          restoreDraftVersion: async (chapterId, versionNumber) => {
            try {
              const draft = await draftApi.getVersion(chapterId, versionNumber)
              set((state) => {
                state.currentContent = draft.content
                state.wordCount = draft.content.replace(/\s/g, '').length
                state.saveStatus = 'unsaved'
              })
            } catch (error) {
              console.error('Failed to restore draft version:', error)
              set((state) => { state.error = (error as Error).message })
            }
          },

          getDraftVersions: (chapterId) => {
            return get().draftVersions
              .filter((d) => d.chapter_id === chapterId)
              .sort((a, b) => b.version_number - a.version_number)
          },

          deleteDraftVersion: async (draftId) => {
            const draft = get().draftVersions.find((d) => d.id === draftId)
            if (!draft) return
            await draftApi.delete(draft.chapter_id, draft.version_number)
            set((state) => {
              state.draftVersions = state.draftVersions.filter((d) => d.id !== draftId)
            })
          },

          // ----------------------------------------
          // IFLine
          // ----------------------------------------

          fetchIFLines: async (characterId) => {
            set((state) => { state.loading.ifLines = true })
            try {
              const ifLines = await ifLineApi.list({ character_id: characterId })
              set((state) => { state.ifLines = ifLines })
            } catch (error) {
              console.error('Failed to fetch IF lines:', error)
            } finally {
              set((state) => { state.loading.ifLines = false })
            }
          },

          createIFLine: async (data) => {
            const ifLine = await ifLineApi.create(data)
            set((state) => { state.ifLines.push(ifLine) })
            return ifLine
          },

          updateIFLine: async (id, updates) => {
            await ifLineApi.update(id, updates)
            set((state) => {
              const line = state.ifLines.find((l) => l.id === id)
              if (line) Object.assign(line, updates)
            })
          },

          deleteIFLine: async (id) => {
            await ifLineApi.delete(id)
            set((state) => {
              state.ifLines = state.ifLines.filter((l) => l.id !== id)
            })
          },

          // ----------------------------------------
          // Plot Threads
          // ----------------------------------------

          fetchPlotThreads: async (status) => {
            set((state) => { state.loading.plotThreads = true })
            try {
              const plotThreads = await plotThreadApi.list({ status: status as 'active' | 'resolved' | 'abandoned' | 'hidden' })
              set((state) => { state.plotThreads = plotThreads })
            } catch (error) {
              console.error('Failed to fetch plot threads:', error)
            } finally {
              set((state) => { state.loading.plotThreads = false })
            }
          },

          createPlotThread: async (data) => {
            const plotThread = await plotThreadApi.create(data)
            set((state) => { state.plotThreads.push(plotThread) })
            return plotThread
          },

          updatePlotThread: async (id, updates) => {
            await plotThreadApi.update(id, updates)
            set((state) => {
              const pt = state.plotThreads.find((p) => p.id === id)
              if (pt) Object.assign(pt, updates)
            })
          },

          deletePlotThread: async (id) => {
            await plotThreadApi.delete(id)
            set((state) => {
              state.plotThreads = state.plotThreads.filter((p) => p.id !== id)
            })
          },

          // ----------------------------------------
          // Inspections
          // ----------------------------------------

          fetchInspections: async (chapterId) => {
            try {
              const inspections = await inspectionApi.list(chapterId)
              set((state) => {
                state.inspectionResults = [
                  ...state.inspectionResults.filter((i) => i.chapter_id !== chapterId),
                  ...inspections,
                ]
              })
            } catch (error) {
              console.error('Failed to fetch inspections:', error)
            }
          },

          createInspection: async (chapterId, data) => {
            const inspection = await inspectionApi.create(chapterId, data)
            set((state) => { state.inspectionResults.push(inspection) })
            return inspection
          },

          // ----------------------------------------
          // AI Operations with Queue
          // ----------------------------------------

          addJob: (type, content) => {
            const jobId = genJobId()
            const job: AIGenerationJob = {
              id: jobId,
              type,
              content,
              status: 'pending',
              createdAt: Date.now(),
              progress: 0,
              retryCount: 0,
            }
            set((state) => {
              state.aiJobQueue.push(job)
            })
            // Auto-process if not already processing
            const { currentJobId } = get()
            if (!currentJobId) {
              get().processNextJob()
            }
            return jobId
          },

          cancelJob: (jobId) => {
            set((state) => {
              const job = state.aiJobQueue.find((j) => j.id === jobId)
              if (!job) return

              if (job.status === 'pending') {
                job.status = 'failed'
                job.error = '已取消'
              } else if (job.status === 'processing') {
                // Mark for cancellation - the processNextJob loop will check this
                job.error = '取消中...'
                // Abort controller will be checked during streaming
              }
            })
          },

          clearCompletedJobs: () => {
            set((state) => {
              state.aiJobQueue = state.aiJobQueue.filter(
                (j) => j.status === 'pending' || j.status === 'processing'
              )
            })
          },

          retryJob: async (jobId) => {
            set((state) => {
              const job = state.aiJobQueue.find((j) => j.id === jobId)
              if (job) {
                job.status = 'pending'
                job.error = undefined
                job.progress = 0
              }
            })
            await get().processNextJob()
          },

          getJobStatus: (jobId) => {
            return get().aiJobQueue.find((j) => j.id === jobId)
          },

          // Internal: process next job in queue with retry, timeout, and cancellation
          processNextJob: async () => {
            const { aiJobQueue, currentJobId } = get()
            if (currentJobId) return // Already processing

            const nextJob = aiJobQueue.find((j) => j.status === 'pending')
            if (!nextJob) return

            const MAX_RETRIES = 3
            const TIMEOUT_MS = 30000

            set((state) => {
              state.currentJobId = nextJob.id
              nextJob.status = 'processing'
              nextJob.progress = 5
              state.loading.ai = true
            })

            const chapterId = get().currentChapterId ?? undefined
            const ratio = get().humanAIRatio
            let lastError: Error | null = null

            // Retry loop
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
              // Check if job was cancelled before starting
              const currentJob = get().aiJobQueue.find((j) => j.id === nextJob.id)
              if (!currentJob || currentJob.error === '取消中...') {
                set((state) => {
                  const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                  if (job) {
                    job.status = 'failed'
                    job.error = '已取消'
                    job.progress = 0
                  }
                  state.currentJobId = null
                  state.loading.ai = false
                })
                return
              }

              if (attempt > 0) {
                set((state) => {
                  const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                  if (job) {
                    job.retryCount = attempt
                    job.progress = 5
                    job.error = undefined
                  }
                })
                // Exponential backoff before retry
                await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
              }

              try {
                let res: { stream: ReadableStream<Uint8Array>; headers: { operation: string; 'human-ai-ratio': string; style: string } }
                switch (nextJob.type) {
                  case 'optimize':
                    res = await aiApi.optimize(nextJob.content, chapterId, ratio)
                    break
                  case 'expand':
                    res = await aiApi.expand(nextJob.content, chapterId, ratio)
                    break
                  case 'condense':
                    res = await aiApi.shrink(nextJob.content, chapterId, ratio)
                    break
                  case 'rewrite':
                    res = await aiApi.rewrite(nextJob.content, chapterId, ratio)
                    break
                  case 'continue':
                    res = await aiApi.continue(nextJob.content, chapterId, ratio)
                    break
                  case 'polish':
                    res = await aiApi.polish(nextJob.content, chapterId, ratio)
                    break
                  default:
                    throw new Error('Unknown job type')
                }

                // Consume stream with timeout, progress tracking, and cancellation check
                const result = await Promise.race([
                  consumeStream(res.stream, {
                    onChunk: () => {
                      // Chunk updates are handled by progress events
                    },
                    onProgress: (percent) => {
                      set((state) => {
                        const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                        if (job) job.progress = percent
                      })
                    },
                    onDone: () => {
                      set((state) => {
                        const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                        if (job) job.progress = 100
                      })
                    },
                  }),
                  new Promise<string>((_, reject) => {
                    setTimeout(() => {
                      reject(new Error('AI生成超时，请重试'))
                    }, TIMEOUT_MS)
                  }),
                ])

                // Check if cancelled during stream consumption
                const postStreamJob = get().aiJobQueue.find((j) => j.id === nextJob.id)
                if (postStreamJob?.error === '取消中...') {
                  set((state) => {
                    const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                    if (job) {
                      job.status = 'failed'
                      job.error = '已取消'
                      job.progress = 0
                    }
                    state.currentJobId = null
                    state.loading.ai = false
                  })
                  return
                }

                // Validate result
                if (!result || !result.trim()) {
                  throw new Error('AI返回了空内容')
                }

                set((state) => {
                  const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                  if (job) {
                    job.status = 'completed'
                    job.result = result
                    job.completedAt = Date.now()
                    job.progress = 100
                    job.retryCount = attempt
                  }
                  state.currentJobId = null
                  state.loading.ai = false
                })

                // Success - break retry loop
                lastError = null
                break
              } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))
                console.warn(`[AI Job] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed for ${nextJob.type}:`, lastError.message)

                // Don't retry on cancellation
                const checkJob = get().aiJobQueue.find((j) => j.id === nextJob.id)
                if (checkJob?.error === '取消中...') {
                  set((state) => {
                    const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                    if (job) {
                      job.status = 'failed'
                      job.error = '已取消'
                      job.progress = 0
                    }
                    state.currentJobId = null
                    state.loading.ai = false
                  })
                  return
                }

                // On final attempt, mark as failed
                if (attempt === MAX_RETRIES) {
                  set((state) => {
                    const job = state.aiJobQueue.find((j) => j.id === nextJob.id)
                    if (job) {
                      job.status = 'failed'
                      job.error = lastError?.message || 'AI生成失败，已达到最大重试次数'
                      job.progress = 0
                    }
                    state.currentJobId = null
                    state.loading.ai = false
                  })
                }
              }
            }

            // Process next job
            await get().processNextJob()
          },

          optimize: async (content) => {
            const jobId = get().addJob('optimize', content)
            await get().waitForJob(jobId)
            const job = get().aiJobQueue.find((j) => j.id === jobId)
            if (job?.status === 'completed') return job.result!
            throw new Error(job?.error || 'Optimization failed')
          },

          expand: async (content) => {
            const jobId = get().addJob('expand', content)
            await get().waitForJob(jobId)
            const job = get().aiJobQueue.find((j) => j.id === jobId)
            if (job?.status === 'completed') return job.result!
            throw new Error(job?.error || 'Expansion failed')
          },

          condense: async (content) => {
            const jobId = get().addJob('condense', content)
            await get().waitForJob(jobId)
            const job = get().aiJobQueue.find((j) => j.id === jobId)
            if (job?.status === 'completed') return job.result!
            throw new Error(job?.error || 'Shrink failed')
          },

          rewrite: async (content) => {
            const jobId = get().addJob('rewrite', content)
            await get().waitForJob(jobId)
            const job = get().aiJobQueue.find((j) => j.id === jobId)
            if (job?.status === 'completed') return job.result!
            throw new Error(job?.error || 'Rewrite failed')
          },

          continue: async (content) => {
            const jobId = get().addJob('continue', content)
            await get().waitForJob(jobId)
            const job = get().aiJobQueue.find((j) => j.id === jobId)
            if (job?.status === 'completed') return job.result!
            throw new Error(job?.error || 'Continue failed')
          },

          polish: async (content) => {
            const jobId = get().addJob('polish', content)
            await get().waitForJob(jobId)
            const job = get().aiJobQueue.find((j) => j.id === jobId)
            if (job?.status === 'completed') return job.result!
            throw new Error(job?.error || 'Polish failed')
          },

          // Helper to wait for a job
          waitForJob: async (jobId) => {
            return new Promise<void>((resolve) => {
              const check = () => {
                const job = get().aiJobQueue.find((j) => j.id === jobId)
                if (job && (job.status === 'completed' || job.status === 'failed')) {
                  resolve()
                } else {
                  setTimeout(check, 100)
                }
              }
              check()
            })
          },

          // ----------------------------------------
          // Config
          // ----------------------------------------

          setHumanAIRatio: (ratio) => {
            set((state) => { state.humanAIRatio = ratio })
            // Sync to backend (fire and forget)
            writingSettingsApi.update({ human_ai_ratio: ratio / 100 }).catch((err) => {
              console.warn('Failed to sync human-ai ratio to backend:', err)
            })
          },

          setWritingStyle: (style) => {
            set((state) => { state.writingStyle = style })
            // Sync to backend (fire and forget)
            writingSettingsApi.update({ writing_style: style }).catch((err) => {
              console.warn('Failed to sync writing style to backend:', err)
            })
          },

          setTargetWordCount: (count) => {
            set((state) => { state.targetWordCount = count })
          },

          setEditor: (editor) => {
            set((state) => { state.editor = editor as unknown as typeof state.editor })
          },

          // ----------------------------------------
          // Warnings
          // ----------------------------------------

          setOOCWarnings: (warnings) => {
            set((state) => { state.oocWarnings = warnings })
          },

          setPowerImbalanceWarnings: (warnings) => {
            set((state) => { state.powerImbalanceWarnings = warnings })
          },

          clearWarnings: () => {
            set((state) => {
              state.oocWarnings = []
              state.powerImbalanceWarnings = []
            })
          },

          // ----------------------------------------
          // Notes
          // ----------------------------------------

          getChapterNote: (chapterId) => {
            return get().chapterNotes.find((n) => n.chapterId === chapterId)
          },

          setChapterNote: (chapterId, content) => {
            set((state) => {
              const existing = state.chapterNotes.find((n) => n.chapterId === chapterId)
              const now = Date.now()
              if (existing) {
                existing.content = content
                existing.updatedAt = now
              } else {
                state.chapterNotes.push({
                  id: genNoteId(chapterId),
                  chapterId,
                  content,
                  createdAt: now,
                  updatedAt: now,
                })
              }
            })
          },

          deleteChapterNote: (chapterId) => {
            set((state) => {
              state.chapterNotes = state.chapterNotes.filter((n) => n.chapterId !== chapterId)
            })
          },

          // ----------------------------------------
          // Session Tracking
          // ----------------------------------------

          startWritingSession: (_chapterId, wordCount) => {
            set((state) => {
              state.sessionStartTime = Date.now()
              state.sessionWordCountStart = wordCount
            })
          },

          endWritingSession: () => {
            const state = get()
            if (!state.sessionStartTime || !state.currentChapterId) return null

            const endTime = Date.now()
            const session: WritingSession = {
              startTime: state.sessionStartTime,
              endTime,
              wordCountStart: state.sessionWordCountStart,
              wordCountEnd: state.wordCount,
              chapterId: state.currentChapterId,
            }

            const today = new Date().toISOString().split('T')[0]
            const wordsWritten = Math.max(0, session.wordCountEnd - session.wordCountStart)
            const sessionMinutes = Math.max(1, Math.round((endTime - session.startTime) / 60000))

            set((s) => {
              const existing = s.dailyStats.find((d) => d.date === today)
              if (existing) {
                existing.wordCount += wordsWritten
                existing.sessionCount += 1
                existing.sessionMinutes += sessionMinutes
              } else {
                s.dailyStats.push({
                  date: today,
                  wordCount: wordsWritten,
                  sessionCount: 1,
                  sessionMinutes,
                })
              }
              s.sessionStartTime = null
            })

            return session
          },

          getSessionDuration: () => {
            const { sessionStartTime } = get()
            if (!sessionStartTime) return 0
            return Math.floor((Date.now() - sessionStartTime) / 1000)
          },

          getSessionWPM: () => {
            const { sessionStartTime, sessionWordCountStart, wordCount } = get()
            if (!sessionStartTime) return 0
            const minutes = (Date.now() - sessionStartTime) / 60000
            if (minutes < 0.5) return 0
            return Math.round((wordCount - sessionWordCountStart) / minutes)
          },

          // ----------------------------------------
          // Daily Stats
          // ----------------------------------------

          getDailyStats: (date) => {
            const targetDate = date || new Date().toISOString().split('T')[0]
            return get().dailyStats.find((d) => d.date === targetDate)
          },

          getTodayWordCount: () => {
            const today = new Date().toISOString().split('T')[0]
            return get().dailyStats.find((d) => d.date === today)?.wordCount || 0
          },

          // ----------------------------------------
          // Save Status
          // ----------------------------------------

          setSaveStatus: (status) => {
            set((state) => { state.saveStatus = status })
          },

          markSaved: () => {
            set((state) => {
              state.saveStatus = 'saved'
              state.lastSavedAt = Date.now()
            })
          },

          markUnsaved: () => {
            set((state) => { state.saveStatus = 'unsaved' })
          },
        }),
        {
          name: 'writer-writing-store-v2',
          storage: createHybridStorage(100 * 1024) as never,
          partialize: (state) => ({
            humanAIRatio: state.humanAIRatio,
            writingStyle: state.writingStyle,
            targetWordCount: state.targetWordCount,
            chapterNotes: state.chapterNotes,
            dailyStats: state.dailyStats,
            autoSaveEnabled: state.autoSaveEnabled,
            autoSaveInterval: state.autoSaveInterval,
          }),
          version: 2,
        }
      )
    )
  )
)

// ============================================
// Selectors
// ============================================

export const selectCurrentChapter = (state: WritingState) =>
  state.chapters.find((c) => c.id === state.currentChapterId)

export const selectDraftVersionsForCurrentChapter = (state: WritingState) =>
  state.currentChapterId
    ? state.draftVersions
        .filter((d) => d.chapter_id === state.currentChapterId)
        .sort((a, b) => b.version_number - a.version_number)
    : []

export const selectPendingJobs = (state: WritingState) =>
  state.aiJobQueue.filter((j) => j.status === 'pending')

export const selectCompletedJobs = (state: WritingState) =>
  state.aiJobQueue.filter((j) => j.status === 'completed')

/** 仅选择写作配置（最小重渲染） */
export const selectWritingConfig = (state: WritingState) => ({
  humanAIRatio: state.humanAIRatio,
  writingStyle: state.writingStyle,
  targetWordCount: state.targetWordCount,
  autoSaveEnabled: state.autoSaveEnabled,
  autoSaveInterval: state.autoSaveInterval,
})

/** 仅选择当前章节内容 */
export const selectCurrentContent = (state: WritingState) => ({
  currentContent: state.currentContent,
  wordCount: state.wordCount,
  saveStatus: state.saveStatus,
})

/** 仅选择 loading 状态 */
export const selectLoadingState = (state: WritingState) => state.loading

/** 清理 writing store 临时状态 */
export function cleanupWritingStore() {
  useWritingStore.setState((state) => {
    state.loading.chapters = false
    state.loading.outlines = false
    state.loading.ifLines = false
    state.loading.plotThreads = false
    state.loading.drafts = false
    state.loading.ai = false
    state.error = null
    state.saveStatus = 'idle'
  })
}

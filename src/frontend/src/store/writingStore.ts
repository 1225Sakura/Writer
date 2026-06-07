import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Editor } from '@tiptap/react'
import { chapterApi, draftApi } from '../api/writing'
import { writingSettingsApi } from '../api/settings'
import { createHybridStorage } from './utils/indexedDBStorage'
import { useContentStore } from './contentStore'
import { showOperationError, showWarning } from '../utils/toastHelper'

// Types

export type WritingStyle = 'default' | 'jiangnan' | 'kafka' | 'camus' | 'custom'

export interface ChapterNote {
  id: string
  chapterId: number
  content: string
  category: string
  pinned: boolean
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

export type AutoSaveState = 'idle' | 'saving' | 'saved' | 'unsaved' | 'error'

interface WritingState {
  // Editor state
  currentChapterId: number | null
  currentContent: string
  wordCount: number
  targetWordCount: number
  editor: Editor | null

  // Three-tier goals
  chapterTargetWordCount: number
  dailyTargetWordCount: number

  // Writing config
  humanAIRatio: number
  writingStyle: WritingStyle

  // Loading (editor-specific)
  loading: {
    chapters: boolean
    outlines: boolean
  }

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
}

interface WritingActions {
  // Init
  init: () => Promise<void>

  // Chapter (editor-level)
  setCurrentChapter: (chapterId: number | null) => void
  updateContent: (content: string) => void
  saveCurrentChapter: () => Promise<void>

  // Auto-save
  triggerAutoSave: () => Promise<void>
  setAutoSaveEnabled: (enabled: boolean) => void
  setAutoSaveInterval: (intervalMs: number) => void

  // Config
  setHumanAIRatio: (ratio: number) => void
  setWritingStyle: (style: WritingStyle) => void
  setTargetWordCount: (count: number) => void
  setChapterTargetWordCount: (count: number) => void
  setDailyTargetWordCount: (count: number) => void
  setEditor: (editor: Editor | null) => void

  // Notes
  getChapterNote: (chapterId: number) => ChapterNote | undefined
  setChapterNote: (chapterId: number, content: string, category?: string, pinned?: boolean) => Promise<void>
  deleteChapterNote: (chapterId: number) => Promise<void>

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

const genNoteId = (chapterId: number) => `note-${chapterId}-${Date.now()}`

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
          editor: null,
          chapterTargetWordCount: 3000,
          dailyTargetWordCount: 2000,
          humanAIRatio: 70,
          writingStyle: 'default',
          loading: {
            chapters: false,
            outlines: false,
          },
          chapterNotes: [],
          sessionStartTime: null,
          sessionWordCountStart: 0,
          dailyStats: [],
          saveStatus: 'idle',
          lastSavedAt: null,
          autoSaveEnabled: true,
          autoSaveInterval: 30000,

          // Init

          init: async () => {
            set((state) => {
              state.loading.chapters = true
              state.loading.outlines = true
            })
            try {
              const contentStore = useContentStore.getState()
              const [settings] = await Promise.all([
                writingSettingsApi.get().catch(() => { showWarning('设置加载失败，使用默认值'); return null }),
                contentStore.fetchChapters(),
                contentStore.fetchOutlines(),
              ])
              set((state) => {
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
              showOperationError('初始化写作模块', error)
            } finally {
              set((state) => {
                state.loading.chapters = false
                state.loading.outlines = false
              })
            }
          },

          // Chapter (editor-level)

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
              useContentStore.getState().fetchDrafts(chapterId)
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
                const contentStore = useContentStore.getState()
                const existingDrafts = contentStore.draftVersions.filter(
                  (d) => d.chapter_id === currentChapterId
                )
                await draftApi.create(currentChapterId, {
                  content: currentContent,
                  version_number: existingDrafts.length + 1,
                })
                // Refresh drafts
                const updatedDrafts = await draftApi.list(currentChapterId)
                useContentStore.setState((s) => { s.draftVersions = updatedDrafts })
              }

              // Update chapter in contentStore
              useContentStore.setState((s) => {
                const ch = s.chapters.find((c) => c.id === currentChapterId)
                if (ch) ch.word_count = wordCount
              })

              set((state) => {
                state.saveStatus = 'saved'
                state.lastSavedAt = Date.now()
              })
            } catch (error) {
              showOperationError('保存章节', error)
              set((state) => { state.saveStatus = 'error' })
            }
          },

          // Auto-save

          triggerAutoSave: async () => {
            const { currentChapterId, currentContent, saveStatus } = get()
            if (!currentChapterId || saveStatus === 'saving') return
            if (!currentContent.trim()) return

            set((state) => { state.saveStatus = 'saving' })
            try {
              const wordCount = currentContent.replace(/\s/g, '').length
              await chapterApi.update(currentChapterId, { word_count: wordCount })

              // Also save draft version periodically
              const contentStore = useContentStore.getState()
              const drafts = contentStore.draftVersions.filter(
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
                useContentStore.setState((s) => { s.draftVersions = updatedDrafts })
              }

              // Update chapter in contentStore
              useContentStore.setState((s) => {
                const ch = s.chapters.find((c) => c.id === currentChapterId)
                if (ch) ch.word_count = wordCount
              })

              set((state) => {
                state.saveStatus = 'saved'
                state.lastSavedAt = Date.now()
              })
            } catch (error) {
              showOperationError('自动保存', error)
              set((state) => { state.saveStatus = 'error' })
            }
          },

          setAutoSaveEnabled: (enabled) => { set((s) => { s.autoSaveEnabled = enabled }) },
          setAutoSaveInterval: (intervalMs) => { set((s) => { s.autoSaveInterval = intervalMs }) },

          // Config

          setHumanAIRatio: (ratio) => {
            set((state) => { state.humanAIRatio = ratio })
            writingSettingsApi.update({ human_ai_ratio: ratio / 100 }).catch((err) => {
              showOperationError('同步人机比例', err)
            })
          },

          setWritingStyle: (style) => {
            set((state) => { state.writingStyle = style })
            writingSettingsApi.update({ writing_style: style }).catch((err) => {
              showOperationError('同步写作风格', err)
            })
          },

          setTargetWordCount: (count) => { set((s) => { s.targetWordCount = count }) },
          setChapterTargetWordCount: (count) => { set((s) => { s.chapterTargetWordCount = count }) },
          setDailyTargetWordCount: (count) => { set((s) => { s.dailyTargetWordCount = count }) },
          setEditor: (editor) => { set((s) => { s.editor = editor as unknown as typeof s.editor }) },

          // Notes

          getChapterNote: (chapterId) => {
            return get().chapterNotes.find((n) => n.chapterId === chapterId)
          },

          setChapterNote: async (chapterId, content, category, pinned) => {
            const updateData: Record<string, unknown> = { notes: content }
            if (category !== undefined) updateData.note_category = category
            if (pinned !== undefined) updateData.note_pinned = pinned
            await chapterApi.update(chapterId, updateData)
            set((state) => {
              const existing = state.chapterNotes.find((n) => n.chapterId === chapterId)
              const now = Date.now()
              if (existing) {
                existing.content = content
                existing.updatedAt = now
                if (category !== undefined) existing.category = category
                if (pinned !== undefined) existing.pinned = pinned
              } else {
                state.chapterNotes.push({
                  id: genNoteId(chapterId),
                  chapterId,
                  content,
                  category: category ?? 'note',
                  pinned: pinned ?? false,
                  createdAt: now,
                  updatedAt: now,
                })
              }
            })
          },

          deleteChapterNote: async (chapterId) => {
            await chapterApi.update(chapterId, { notes: '', note_category: 'note', note_pinned: false })
            set((state) => {
              state.chapterNotes = state.chapterNotes.filter((n) => n.chapterId !== chapterId)
            })
          },

          // Session Tracking

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

          // Daily Stats

          getDailyStats: (date) => {
            const targetDate = date || new Date().toISOString().split('T')[0]
            return get().dailyStats.find((d) => d.date === targetDate)
          },
          getTodayWordCount: () => {
            const today = new Date().toISOString().split('T')[0]
            return get().dailyStats.find((d) => d.date === today)?.wordCount || 0
          },

          // Save Status

          setSaveStatus: (status) => { set((s) => { s.saveStatus = status }) },
          markSaved: () => { set((s) => { s.saveStatus = 'saved'; s.lastSavedAt = Date.now() }) },
          markUnsaved: () => { set((s) => { s.saveStatus = 'unsaved' }) },
        }),
        {
          name: 'writer-writing-store-v2',
          storage: createHybridStorage(100 * 1024) as never,
          partialize: (state) => ({
            humanAIRatio: state.humanAIRatio,
            writingStyle: state.writingStyle,
            targetWordCount: state.targetWordCount,
            chapterTargetWordCount: state.chapterTargetWordCount,
            dailyTargetWordCount: state.dailyTargetWordCount,
            chapterNotes: state.chapterNotes,
            dailyStats: state.dailyStats,
            autoSaveEnabled: state.autoSaveEnabled,
            autoSaveInterval: state.autoSaveInterval,
          }),
          version: 3,
        }
      )
    )
  )
)

// Selectors

/** Select the current chapter from contentStore's chapters */
export const selectCurrentChapter = () => {
  const { currentChapterId } = useWritingStore.getState()
  const { chapters } = useContentStore.getState()
  return chapters.find((c) => c.id === currentChapterId)
}

/** Select draft versions for the current chapter */
export const selectDraftVersionsForCurrentChapter = () => {
  const { currentChapterId } = useWritingStore.getState()
  const { draftVersions } = useContentStore.getState()
  return currentChapterId
    ? draftVersions
        .filter((d) => d.chapter_id === currentChapterId)
        .sort((a, b) => b.version_number - a.version_number)
    : []
}

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

/** 三级目标进度选择器 */
export const selectGoalProgress = (
  scope: 'chapter' | 'daily' | 'global'
) => {
  const state = useWritingStore.getState()
  const today = new Date().toISOString().split('T')[0]
  const todayWordCount = state.dailyStats.find((d) => d.date === today)?.wordCount || 0
  const totalWords = state.dailyStats.reduce((sum, d) => sum + d.wordCount, 0)

  switch (scope) {
    case 'chapter':
      return {
        current: state.wordCount,
        target: state.chapterTargetWordCount,
        progress: state.chapterTargetWordCount > 0
          ? Math.min(100, Math.round((state.wordCount / state.chapterTargetWordCount) * 100))
          : 0,
      }
    case 'daily':
      return {
        current: todayWordCount,
        target: state.dailyTargetWordCount,
        progress: state.dailyTargetWordCount > 0
          ? Math.min(100, Math.round((todayWordCount / state.dailyTargetWordCount) * 100))
          : 0,
      }
    case 'global':
      return {
        current: totalWords,
        target: state.targetWordCount,
        progress: state.targetWordCount > 0
          ? Math.min(100, Math.round((totalWords / state.targetWordCount) * 100))
          : 0,
      }
  }
}

/** 清理 writing store 临时状态 */
export function cleanupWritingStore() {
  useWritingStore.setState((state) => {
    state.loading.chapters = false
    state.loading.outlines = false
    state.saveStatus = 'idle'
  })
}

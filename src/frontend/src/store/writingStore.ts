import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Editor } from '@tiptap/react'

export type WritingStyle = 'default' | 'jiangnan' | 'kafka' | 'camus' | 'custom'

export interface DraftVersion {
  id: string
  chapterId: string
  content: string
  versionNumber: number
  createdAt: number
}

export interface PlotThread {
  id: string
  title: string
  description?: string
  status: 'open' | 'revealed' | 'closed'
  createdChapterId: string
  revealChapterId?: string
}

export interface AIInspectionResult {
  id: string
  chapterId: string
  inspectionType: 'consistency' | 'relationship' | 'foreshadowing' | 'suggestion'
  issues: string[]
  suggestions: string[]
  autoFixed: boolean
  createdAt: number
}

interface WritingState {
  // 当前章节
  currentChapterId: string | null
  currentContent: string
  wordCount: number
  targetWordCount: number
  // 章节列表
  chapters: Array<{
    id: string
    title: string
    content: string
    wordCount: number
    status: 'planning' | 'writing' | 'completed'
    lastModified: number
  }>
  // 版本历史
  draftVersions: DraftVersion[]
  // 伏笔追踪
  plotThreads: PlotThread[]
  // AI审查结果
  inspectionResults: AIInspectionResult[]
  // 写作设置
  humanAIRatio: number // 0-100, 人机比例
  writingStyle: WritingStyle
  // Tiptap编辑器实例
  editor: Editor | null
  // OOC/战力警告
  oocWarnings: string[]
  powerImbalanceWarnings: string[]
}

interface WritingActions {
  // 章节操作
  setCurrentChapter: (chapterId: string | null) => void
  updateContent: (content: string) => void
  setChapters: (chapters: WritingState['chapters']) => void
  addChapter: (title: string) => string
  updateChapter: (id: string, updates: Partial<WritingState['chapters'][0]>) => void
  deleteChapter: (id: string) => void
  saveCurrentChapter: () => void

  // 版本历史
  saveDraftVersion: (chapterId: string, content: string) => void
  getDraftVersions: (chapterId: string) => DraftVersion[]

  // 伏笔
  addPlotThread: (thread: Omit<PlotThread, 'id'>) => void
  updatePlotThread: (id: string, updates: Partial<PlotThread>) => void
  closePlotThread: (id: string) => void

  // AI审查
  addInspectionResult: (result: Omit<AIInspectionResult, 'id'>) => void
  clearInspectionResults: (chapterId: string) => void

  // 写作设置
  setHumanAIRatio: (ratio: number) => void
  setWritingStyle: (style: WritingStyle) => void
  setTargetWordCount: (count: number) => void
  // 编辑器
  setEditor: (editor: Editor | null) => void

  // 警告
  setOOCWarnings: (warnings: string[]) => void
  setPowerImbalanceWarnings: (warnings: string[]) => void
  clearWarnings: () => void
}

let versionIdCounter = 0
let plotIdCounter = 0
let inspectionIdCounter = 0
const generateVersionId = () => `ver-${++versionIdCounter}`
const generatePlotId = () => `plot-${++plotIdCounter}`
const generateInspectionId = () => `insp-${++inspectionIdCounter}`

export const useWritingStore = create<WritingState & WritingActions>()(
  persist(
    (set, get) => ({
      // 初始状态
      currentChapterId: null,
      currentContent: '',
      wordCount: 0,
      targetWordCount: 2000,
      chapters: [],
      draftVersions: [],
      plotThreads: [],
      inspectionResults: [],
      humanAIRatio: 70,
      writingStyle: 'default',
      editor: null,
      oocWarnings: [],
      powerImbalanceWarnings: [],

      // 章节操作
      setCurrentChapter: (chapterId) => {
        const chapter = get().chapters.find((c) => c.id === chapterId)
        set({
          currentChapterId: chapterId,
          currentContent: chapter?.content || '',
          wordCount: chapter?.wordCount || 0,
        })
      },
      updateContent: (content) => {
        const wordCount = content.replace(/\s/g, '').length
        set({ currentContent: content, wordCount })
      },
      setChapters: (chapters) => set({ chapters }),
      addChapter: (title) => {
        const id = `ch-${Date.now()}`
        const newChapter = {
          id,
          title,
          content: '',
          wordCount: 0,
          status: 'planning' as const,
          lastModified: Date.now(),
        }
        set((state) => ({ chapters: [...state.chapters, newChapter] }))
        return id
      },
      updateChapter: (id, updates) =>
        set((state) => ({
          chapters: state.chapters.map((c) =>
            c.id === id ? { ...c, ...updates, lastModified: Date.now() } : c
          ),
        })),
      deleteChapter: (id) =>
        set((state) => ({
          chapters: state.chapters.filter((c) => c.id !== id),
          currentChapterId: state.currentChapterId === id ? null : state.currentChapterId,
        })),
      saveCurrentChapter: () => {
        const { currentChapterId, currentContent } = get()
        if (currentChapterId) {
          const wordCount = currentContent.replace(/\s/g, '').length
          set((state) => ({
            chapters: state.chapters.map((c) =>
              c.id === currentChapterId
                ? { ...c, content: currentContent, wordCount, lastModified: Date.now() }
                : c
            ),
          }))
        }
      },

      // 版本历史
      saveDraftVersion: (chapterId, content) => {
        const versions = get().draftVersions.filter((v) => v.chapterId === chapterId)
        const versionNumber = versions.length + 1
        const newVersion: DraftVersion = {
          id: generateVersionId(),
          chapterId,
          content,
          versionNumber,
          createdAt: Date.now(),
        }
        set((state) => ({ draftVersions: [...state.draftVersions, newVersion] }))
      },
      getDraftVersions: (chapterId) => {
        return get().draftVersions.filter((v) => v.chapterId === chapterId)
      },

      // 伏笔
      addPlotThread: (thread) => {
        const newThread: PlotThread = { ...thread, id: generatePlotId() }
        set((state) => ({ plotThreads: [...state.plotThreads, newThread] }))
      },
      updatePlotThread: (id, updates) =>
        set((state) => ({
          plotThreads: state.plotThreads.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      closePlotThread: (id) =>
        set((state) => ({
          plotThreads: state.plotThreads.map((p) =>
            p.id === id ? { ...p, status: 'closed' as const } : p
          ),
        })),

      // AI审查
      addInspectionResult: (result) => {
        const newResult: AIInspectionResult = { ...result, id: generateInspectionId() }
        set((state) => ({ inspectionResults: [...state.inspectionResults, newResult] }))
      },
      clearInspectionResults: (chapterId) =>
        set((state) => ({
          inspectionResults: state.inspectionResults.filter((r) => r.chapterId !== chapterId),
        })),

      // 写作设置
      setHumanAIRatio: (ratio) => set({ humanAIRatio: ratio }),
      setWritingStyle: (style) => set({ writingStyle: style }),
      setTargetWordCount: (count) => set({ targetWordCount: count }),
      setEditor: (editor) => set({ editor }),

      // 警告
      setOOCWarnings: (warnings) => set({ oocWarnings: warnings }),
      setPowerImbalanceWarnings: (warnings) => set({ powerImbalanceWarnings: warnings }),
      clearWarnings: () => set({ oocWarnings: [], powerImbalanceWarnings: [] }),
    }),
    {
      name: 'writer-writing-store',
    }
  )
)

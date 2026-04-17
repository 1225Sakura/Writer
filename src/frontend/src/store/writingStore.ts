import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
import type { Chapter, Outline, IFLine, PlotThread, DraftVersion, AIInspectionResult } from '../api/types'

export type WritingStyle = 'default' | 'jiangnan' | 'kafka' | 'camus' | 'custom'

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

interface WritingState {
	// Current chapter
	currentChapterId: number | null
	currentContent: string
	wordCount: number
	targetWordCount: number
	// Chapter list (synced with backend)
	chapters: Chapter[]
	outlines: Outline[]
	ifLines: IFLine[]
	plotThreads: PlotThread[]
	// Draft versions (synced with backend)
	draftVersions: DraftVersion[]
	// AI inspection results (synced with backend)
	inspectionResults: AIInspectionResult[]
	// Writing settings
	humanAIRatio: number // 0-100, human-AI ratio
	writingStyle: WritingStyle
	// Tiptap editor instance
	editor: Editor | null
	// OOC/power warnings
	oocWarnings: string[]
	powerImbalanceWarnings: string[]
	// Loading states
	loading: {
		chapters: boolean
		outlines: boolean
		ifLines: boolean
		plotThreads: boolean
		drafts: boolean
		ai: boolean
	}
}

interface WritingActions {
	// Initialize - load all data from backend
	init: () => Promise<void>

	// Chapter operations
	setCurrentChapter: (chapterId: number | null) => void
	updateContent: (content: string) => void
	setChapters: (chapters: Chapter[]) => void
	fetchChapters: () => Promise<void>
	createChapter: (data: { outline_id?: number; title?: string; summary?: string; chapter_order?: number; status?: string; word_count?: number }) => Promise<Chapter>
	updateChapter: (id: number, updates: Partial<Chapter>) => Promise<void>
	deleteChapter: (id: number) => Promise<void>
	saveCurrentChapter: () => Promise<void>

	// Outline operations
	fetchOutlines: () => Promise<void>
	createOutline: (data: { title: string; description?: string }) => Promise<Outline>
	updateOutline: (id: number, updates: { title?: string; description?: string }) => Promise<void>
	deleteOutline: (id: number) => Promise<void>

	// Draft operations
	fetchDrafts: (chapterId: number) => Promise<void>
	saveDraftVersion: (chapterId: number, content: string) => Promise<DraftVersion>
	getDraftVersions: (chapterId: number) => DraftVersion[]

	// IF Line operations
	fetchIFLines: (characterId?: number) => Promise<void>
	createIFLine: (data: { title: string; linked_character_id?: number; description?: string; sync_mode?: string }) => Promise<IFLine>
	updateIFLine: (id: number, updates: Partial<IFLine>) => Promise<void>
	deleteIFLine: (id: number) => Promise<void>

	// Plot Thread operations
	fetchPlotThreads: (status?: string) => Promise<void>
	createPlotThread: (data: { title: string; description?: string; status?: string; created_chapter_id?: number; reveal_chapter_id?: number }) => Promise<PlotThread>
	updatePlotThread: (id: number, updates: Partial<PlotThread>) => Promise<void>
	deletePlotThread: (id: number) => Promise<void>

	// AI Inspection operations
	fetchInspections: (chapterId: number) => Promise<void>
	createInspection: (chapterId: number, data: { inspection_type: string; issues_json?: string; suggestions_json?: string }) => Promise<AIInspectionResult>

	// AI Operations
	optimize: (content: string) => Promise<string>
	expand: (content: string) => Promise<string>
	shrink: (content: string) => Promise<string>
	rewrite: (content: string) => Promise<string>
	continue: (content: string) => Promise<string>
	polish: (content: string) => Promise<string>

	// Writing settings
	setHumanAIRatio: (ratio: number) => void
	setWritingStyle: (style: WritingStyle) => void
	setTargetWordCount: (count: number) => void
	// Editor
	setEditor: (editor: Editor | null) => void

	// Warnings
	setOOCWarnings: (warnings: string[]) => void
	setPowerImbalanceWarnings: (warnings: string[]) => void
	clearWarnings: () => void
}

export const useWritingStore = create<WritingState & WritingActions>()(
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

			// Initialize - load all data from backend
			init: async () => {
				set((state) => ({
					loading: { ...state.loading, chapters: true, outlines: true },
				}))
				try {
					const [chapters, outlines] = await Promise.all([
						chapterApi.list(),
						outlineApi.list(),
					])
					set({ chapters, outlines })
				} catch (error) {
					console.error('Failed to initialize writing store:', error)
				} finally {
					set((state) => ({
						loading: { ...state.loading, chapters: false, outlines: false },
					}))
				}
			},

			// Chapter operations
			setCurrentChapter: (chapterId) => {
				set({
					currentChapterId: chapterId,
					currentContent: '',
					wordCount: 0,
				})
				// Fetch drafts for this chapter
				if (chapterId) {
					get().fetchDrafts(chapterId)
				}
			},

			updateContent: (content) => {
				const wordCount = content.replace(/\s/g, '').length
				set({ currentContent: content, wordCount })
			},

			setChapters: (chapters) => set({ chapters }),

			fetchChapters: async () => {
				set((state) => ({ loading: { ...state.loading, chapters: true } }))
				try {
					const chapters = await chapterApi.list()
					set({ chapters })
				} catch (error) {
					console.error('Failed to fetch chapters:', error)
				} finally {
					set((state) => ({ loading: { ...state.loading, chapters: false } }))
				}
			},

			createChapter: async (data) => {
				const chapter = await chapterApi.create({
					...data,
					status: data.status || 'planning',
					word_count: data.word_count || 0,
				})
				set((state) => ({ chapters: [...state.chapters, chapter] }))
				return chapter
			},

			updateChapter: async (id, updates) => {
				await chapterApi.update(id, updates)
				set((state) => ({
					chapters: state.chapters.map((c) =>
						c.id === id ? { ...c, ...updates } : c
					),
				}))
			},

			deleteChapter: async (id) => {
				await chapterApi.delete(id)
				set((state) => ({
					chapters: state.chapters.filter((c) => c.id !== id),
					currentChapterId: state.currentChapterId === id ? null : state.currentChapterId,
				}))
			},

			saveCurrentChapter: async () => {
				const { currentChapterId, currentContent } = get()
				if (currentChapterId) {
					const wordCount = currentContent.replace(/\s/g, '').length
					await chapterApi.update(currentChapterId, { word_count: wordCount })
					set((state) => ({
						chapters: state.chapters.map((c) =>
							c.id === currentChapterId
								? { ...c, content: currentContent, word_count: wordCount }
								: c
						),
					}))
				}
			},

			// Outline operations
			fetchOutlines: async () => {
				set((state) => ({ loading: { ...state.loading, outlines: true } }))
				try {
					const outlines = await outlineApi.list()
					set({ outlines })
				} catch (error) {
					console.error('Failed to fetch outlines:', error)
				} finally {
					set((state) => ({ loading: { ...state.loading, outlines: false } }))
				}
			},

			createOutline: async (data) => {
				const outline = await outlineApi.create(data)
				set((state) => ({ outlines: [...state.outlines, outline] }))
				return outline
			},

			updateOutline: async (id, updates) => {
				await outlineApi.update(id, updates)
				set((state) => ({
					outlines: state.outlines.map((o) =>
						o.id === id ? { ...o, ...updates } : o
					),
				}))
			},

			deleteOutline: async (id) => {
				await outlineApi.delete(id)
				set((state) => ({
					outlines: state.outlines.filter((o) => o.id !== id),
				}))
			},

			// Draft operations
			fetchDrafts: async (chapterId) => {
				set((state) => ({ loading: { ...state.loading, drafts: true } }))
				try {
					const drafts = await draftApi.list(chapterId)
					set({ draftVersions: drafts })
				} catch (error) {
					console.error('Failed to fetch drafts:', error)
				} finally {
					set((state) => ({ loading: { ...state.loading, drafts: false } }))
				}
			},

			saveDraftVersion: async (chapterId, content) => {
				const existingDrafts = get().draftVersions.filter(
					(d) => d.chapter_id === chapterId
				)
				const versionNumber = existingDrafts.length + 1

				const draft = await draftApi.create(chapterId, {
					chapter_id: chapterId,
					content,
					version_number: versionNumber,
				})
				set((state) => ({ draftVersions: [...state.draftVersions, draft] }))
				return draft
			},

			getDraftVersions: (chapterId) => {
				return get().draftVersions.filter((d) => d.chapter_id === chapterId)
			},

			// IF Line operations
			fetchIFLines: async (characterId) => {
				set((state) => ({ loading: { ...state.loading, ifLines: true } }))
				try {
					const ifLines = await ifLineApi.list(0, 50, characterId)
					set({ ifLines })
				} catch (error) {
					console.error('Failed to fetch IF lines:', error)
				} finally {
					set((state) => ({ loading: { ...state.loading, ifLines: false } }))
				}
			},

			createIFLine: async (data) => {
				const ifLine = await ifLineApi.create(data)
				set((state) => ({ ifLines: [...state.ifLines, ifLine] }))
				return ifLine
			},

			updateIFLine: async (id, updates) => {
				await ifLineApi.update(id, updates)
				set((state) => ({
					ifLines: state.ifLines.map((l) =>
						l.id === id ? { ...l, ...updates } : l
					),
				}))
			},

			deleteIFLine: async (id) => {
				await ifLineApi.delete(id)
				set((state) => ({
					ifLines: state.ifLines.filter((l) => l.id !== id),
				}))
			},

			// Plot Thread operations
			fetchPlotThreads: async (status) => {
				set((state) => ({ loading: { ...state.loading, plotThreads: true } }))
				try {
					const plotThreads = await plotThreadApi.list(0, 100, status)
					set({ plotThreads })
				} catch (error) {
					console.error('Failed to fetch plot threads:', error)
				} finally {
					set((state) => ({ loading: { ...state.loading, plotThreads: false } }))
				}
			},

			createPlotThread: async (data) => {
				const plotThread = await plotThreadApi.create(data)
				set((state) => ({ plotThreads: [...state.plotThreads, plotThread] }))
				return plotThread
			},

			updatePlotThread: async (id, updates) => {
				await plotThreadApi.update(id, updates)
				set((state) => ({
					plotThreads: state.plotThreads.map((p) =>
						p.id === id ? { ...p, ...updates } : p
					),
				}))
			},

			deletePlotThread: async (id) => {
				await plotThreadApi.delete(id)
				set((state) => ({
					plotThreads: state.plotThreads.filter((p) => p.id !== id),
				}))
			},

			// AI Inspection operations
			fetchInspections: async (chapterId) => {
				try {
					const inspections = await inspectionApi.list(chapterId)
					set((state) => ({
						inspectionResults: [
							...state.inspectionResults.filter((i) => i.chapter_id !== chapterId),
							...inspections,
						],
					}))
				} catch (error) {
					console.error('Failed to fetch inspections:', error)
				}
			},

			createInspection: async (chapterId, data) => {
				const inspection = await inspectionApi.create(chapterId, data)
				set((state) => ({ inspectionResults: [...state.inspectionResults, inspection] }))
				return inspection
			},

			// AI Operations
			optimize: async (content) => {
				set((state) => ({ loading: { ...state.loading, ai: true } }))
				try {
					return await aiApi.optimize(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					set((state) => ({ loading: { ...state.loading, ai: false } }))
				}
			},

			expand: async (content) => {
				set((state) => ({ loading: { ...state.loading, ai: true } }))
				try {
					return await aiApi.expand(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					set((state) => ({ loading: { ...state.loading, ai: false } }))
				}
			},

			shrink: async (content) => {
				set((state) => ({ loading: { ...state.loading, ai: true } }))
				try {
					return await aiApi.shrink(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					set((state) => ({ loading: { ...state.loading, ai: false } }))
				}
			},

			rewrite: async (content) => {
				set((state) => ({ loading: { ...state.loading, ai: true } }))
				try {
					return await aiApi.rewrite(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					set((state) => ({ loading: { ...state.loading, ai: false } }))
				}
			},

			continue: async (content) => {
				set((state) => ({ loading: { ...state.loading, ai: true } }))
				try {
					return await aiApi.continue(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					set((state) => ({ loading: { ...state.loading, ai: false } }))
				}
			},

			polish: async (content) => {
				set((state) => ({ loading: { ...state.loading, ai: true } }))
				try {
					return await aiApi.polish(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					set((state) => ({ loading: { ...state.loading, ai: false } }))
				}
			},

			// Writing settings
			setHumanAIRatio: (ratio) => set({ humanAIRatio: ratio }),
			setWritingStyle: (style) => set({ writingStyle: style }),
			setTargetWordCount: (count) => set({ targetWordCount: count }),
			setEditor: (editor) => set({ editor }),

			// Warnings
			setOOCWarnings: (warnings) => set({ oocWarnings: warnings }),
			setPowerImbalanceWarnings: (warnings) => set({ powerImbalanceWarnings: warnings }),
			clearWarnings: () => set({ oocWarnings: [], powerImbalanceWarnings: [] }),
		}),
		{
			name: 'writer-writing-store',
			partialize: (state) => ({
				humanAIRatio: state.humanAIRatio,
				writingStyle: state.writingStyle,
				targetWordCount: state.targetWordCount,
			}),
		}
	)
)

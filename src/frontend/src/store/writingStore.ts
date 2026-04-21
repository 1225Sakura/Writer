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
	revevealChapterId?: string
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

// Loading state as separate slices to avoid full object replacements
interface LoadingState {
	chapters: boolean
	outlines: boolean
	ifLines: boolean
	plotThreads: boolean
	drafts: boolean
	ai: boolean
}

interface WritingState {
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
	humanAIRatio: number
	writingStyle: WritingStyle
	// Editor is NOT persisted - it's a TipTap instance
	editor: Editor | null
	oocWarnings: string[]
	powerImbalanceWarnings: string[]
	// Separate loading flags for granular updates
	loading: LoadingState
}

interface WritingActions {
	init: () => Promise<void>
	setCurrentChapter: (chapterId: number | null) => void
	updateContent: (content: string) => void
	setChapters: (chapters: Chapter[]) => void
	fetchChapters: () => Promise<void>
	createChapter: (data: { outline_id?: number; title?: string; summary?: string; chapter_order?: number; status?: string; word_count?: number }) => Promise<Chapter>
	updateChapter: (id: number, updates: Partial<Chapter>) => Promise<void>
	deleteChapter: (id: number) => Promise<void>
	saveCurrentChapter: () => Promise<void>
	fetchOutlines: () => Promise<void>
	createOutline: (data: { title: string; description?: string }) => Promise<Outline>
	updateOutline: (id: number, updates: { title?: string; description?: string }) => Promise<void>
	deleteOutline: (id: number) => Promise<void>
	fetchDrafts: (chapterId: number) => Promise<void>
	saveDraftVersion: (chapterId: number, content: string) => Promise<DraftVersion>
	getDraftVersions: (chapterId: number) => DraftVersion[]
	fetchIFLines: (characterId?: number) => Promise<void>
	createIFLine: (data: { title: string; linked_character_id?: number; description?: string; sync_mode?: string }) => Promise<IFLine>
	updateIFLine: (id: number, updates: Partial<IFLine>) => Promise<void>
	deleteIFLine: (id: number) => Promise<void>
	fetchPlotThreads: (status?: string) => Promise<void>
	createPlotThread: (data: { title: string; description?: string; status?: string; created_chapter_id?: number; reveal_chapter_id?: number }) => Promise<PlotThread>
	updatePlotThread: (id: number, updates: Partial<PlotThread>) => Promise<void>
	deletePlotThread: (id: number) => Promise<void>
	fetchInspections: (chapterId: number) => Promise<void>
	createInspection: (chapterId: number, data: { inspection_type: string; issues_json?: string; suggestions_json?: string }) => Promise<AIInspectionResult>
	optimize: (content: string) => Promise<string>
	expand: (content: string) => Promise<string>
	shrink: (content: string) => Promise<string>
	rewrite: (content: string) => Promise<string>
	continue: (content: string) => Promise<string>
	polish: (content: string) => Promise<string>
	setHumanAIRatio: (ratio: number) => void
	setWritingStyle: (style: WritingStyle) => void
	setTargetWordCount: (count: number) => void
	setEditor: (editor: Editor | null) => void
	setOOCWarnings: (warnings: string[]) => void
	setPowerImbalanceWarnings: (warnings: string[]) => void
	clearWarnings: () => void
}

// Helper to create loading action with proper state merge
const setLoading = (set: (fn: (state: WritingState) => Partial<WritingState>) => void, key: keyof LoadingState, value: boolean) => {
	set((state) => ({
		loading: { ...state.loading, [key]: value }
	}))
}

export const useWritingStore = create<WritingState & WritingActions>()(
	persist(
		(set, get) => ({
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

			init: async () => {
				setLoading(set, 'chapters', true)
				setLoading(set, 'outlines', true)
				try {
					const [chapters, outlines] = await Promise.all([
						chapterApi.list(),
						outlineApi.list(),
					])
					set({ chapters, outlines })
				} catch (error) {
					console.error('Failed to initialize writing store:', error)
				} finally {
					setLoading(set, 'chapters', false)
					setLoading(set, 'outlines', false)
				}
			},

			setCurrentChapter: (chapterId) => {
				set({
					currentChapterId: chapterId,
					currentContent: '',
					wordCount: 0,
				})
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
				setLoading(set, 'chapters', true)
				try {
					const chapters = await chapterApi.list()
					set({ chapters })
				} catch (error) {
					console.error('Failed to fetch chapters:', error)
				} finally {
					setLoading(set, 'chapters', false)
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

			fetchOutlines: async () => {
				setLoading(set, 'outlines', true)
				try {
					const outlines = await outlineApi.list()
					set({ outlines })
				} catch (error) {
					console.error('Failed to fetch outlines:', error)
				} finally {
					setLoading(set, 'outlines', false)
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

			fetchDrafts: async (chapterId) => {
				setLoading(set, 'drafts', true)
				try {
					const drafts = await draftApi.list(chapterId)
					set({ draftVersions: drafts })
				} catch (error) {
					console.error('Failed to fetch drafts:', error)
				} finally {
					setLoading(set, 'drafts', false)
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

			fetchIFLines: async (characterId) => {
				setLoading(set, 'ifLines', true)
				try {
					const ifLines = await ifLineApi.list(0, 50, characterId)
					set({ ifLines })
				} catch (error) {
					console.error('Failed to fetch IF lines:', error)
				} finally {
					setLoading(set, 'ifLines', false)
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

			fetchPlotThreads: async (status) => {
				setLoading(set, 'plotThreads', true)
				try {
					const plotThreads = await plotThreadApi.list(0, 100, status)
					set({ plotThreads })
				} catch (error) {
					console.error('Failed to fetch plot threads:', error)
				} finally {
					setLoading(set, 'plotThreads', false)
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

			optimize: async (content) => {
				setLoading(set, 'ai', true)
				try {
					return await aiApi.optimize(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					setLoading(set, 'ai', false)
				}
			},

			expand: async (content) => {
				setLoading(set, 'ai', true)
				try {
					return await aiApi.expand(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					setLoading(set, 'ai', false)
				}
			},

			shrink: async (content) => {
				setLoading(set, 'ai', true)
				try {
					return await aiApi.shrink(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					setLoading(set, 'ai', false)
				}
			},

			rewrite: async (content) => {
				setLoading(set, 'ai', true)
				try {
					return await aiApi.rewrite(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					setLoading(set, 'ai', false)
				}
			},

			continue: async (content) => {
				setLoading(set, 'ai', true)
				try {
					return await aiApi.continue(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					setLoading(set, 'ai', false)
				}
			},

			polish: async (content) => {
				setLoading(set, 'ai', true)
				try {
					return await aiApi.polish(content, get().currentChapterId ?? undefined, get().humanAIRatio)
				} finally {
					setLoading(set, 'ai', false)
				}
			},

			setHumanAIRatio: (ratio) => set({ humanAIRatio: ratio }),
			setWritingStyle: (style) => set({ writingStyle: style }),
			setTargetWordCount: (count) => set({ targetWordCount: count }),
			setEditor: (editor) => set({ editor }),
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
				// Explicitly exclude editor from persistence
			}),
		}
	)
)

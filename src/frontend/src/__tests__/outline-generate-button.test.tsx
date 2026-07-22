/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OutlineSidebar } from '@/components/writing/OutlineSidebar'

const contentFixtures = vi.hoisted(() => ({
  chapters: [],
  outlines: [{ id: 7, project_id: 42, title: '主线大纲' }],
  plotThreads: [],
  ifLines: [],
}))

const storeMocks = vi.hoisted(() => ({
  generateOutline: vi.fn(),
  setCurrentChapter: vi.fn(),
  fetchPlotThreads: vi.fn(),
  fetchIFLines: vi.fn(),
  createChapter: vi.fn(),
  updateChapter: vi.fn(),
  deleteChapter: vi.fn(),
  updatePlotThread: vi.fn(),
}))

vi.mock('@/store', () => ({
  useWritingStore: () => ({
    currentChapterId: null,
    setCurrentChapter: storeMocks.setCurrentChapter,
  }),
  useContentStore: () => ({
    chapters: contentFixtures.chapters,
    outlines: contentFixtures.outlines,
    plotThreads: contentFixtures.plotThreads,
    ifLines: contentFixtures.ifLines,
    generating: false,
    outlineGenerationError: null,
    generateOutline: storeMocks.generateOutline,
    fetchPlotThreads: storeMocks.fetchPlotThreads,
    fetchIFLines: storeMocks.fetchIFLines,
    createChapter: storeMocks.createChapter,
    updateChapter: storeMocks.updateChapter,
    deleteChapter: storeMocks.deleteChapter,
    updatePlotThread: storeMocks.updatePlotThread,
  }),
  // v0.5 Phase 3 Track C: useUIStore consumed by the IF fork button
  // (feature-flag gated). Track E.5 keeps the gate; default OFF so
  // these tests stay focused on the AI generation controls.
  useUIStore: () => ({
    feature_flags: { IF_UI: false },
    setFeatureFlag: vi.fn(),
  }),
}))

describe('OutlineSidebar AI generation controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeMocks.generateOutline.mockResolvedValue(undefined)
  })

  it('renders the AI generate outline button and chapter count input', () => {
    render(<OutlineSidebar />)

    expect(screen.getByRole('button', { name: 'AI 生成大纲' })).toBeTruthy()
    expect(screen.getByRole('spinbutton', { name: '生成章节数' })).toBeTruthy()
  })

  it('clicking generate forwards the selected chapter count and project context', async () => {
    render(<OutlineSidebar />)

    fireEvent.change(screen.getByRole('spinbutton', { name: '生成章节数' }), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成大纲' }))

    await waitFor(() => {
      expect(storeMocks.generateOutline).toHaveBeenCalledWith({
        chapterCount: 10,
        projectId: 42,
        criteria: { title: '主线大纲' },
      })
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { outlineApi } from '@/api/writing'
import { api } from '@/api/request'

vi.mock('@/api/request', () => ({
  api: {
    post: vi.fn(),
  },
  resolveBaseURL: vi.fn(),
  getApiKey: vi.fn(),
}))

describe('outlineApi.generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.post).mockResolvedValue({ outlineId: 9, chapters: [] })
  })

  it('posts chapter count, project, and criteria to the generation endpoint', async () => {
    await outlineApi.generate({
      chapterCount: 10,
      projectId: 42,
      criteria: { title: '第一卷', tone: '热血' },
    })

    expect(api.post).toHaveBeenCalledWith('/chapters/outlines/generate', {
      chapterCount: 10,
      projectId: 42,
      settingsSnapshot: { title: '第一卷', tone: '热血' },
    })
  })
})

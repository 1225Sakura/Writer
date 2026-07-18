/**
 * M1 mechanism-tier regression: api client must unwrap backend ApiResponse envelope.
 *
 * Backend returns `{success: true, data: <payload>}` (and `{success: true, data: ..., message: "..."}`
 * for some endpoints). The frontend axios layer previously returned `response.data`
 * directly, so callers received the wrapper instead of the payload.
 *
 * The fix: in the request() Promise resolver, unwrap `response.data.data` when present,
 * falling back to `response.data` for endpoints that legitimately return raw JSON.
 *
 * These tests exercise the real request() resolver with a mocked Axios client
 * (no network, no cache side-effects on assertion) so the unwrap behavior is
 * permanent-protected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock axios to control response shape per test
const mockRequest = vi.fn()
const mockInstance = {
  request: mockRequest,
  interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
}

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockInstance),
    isCancel: vi.fn(() => false),
  },
  isCancel: vi.fn(() => false),
  AxiosError: class AxiosError extends Error {},
}))

vi.mock('axios-retry', () => ({ default: vi.fn() }))

vi.mock('@/utils/cache', () => ({
  apiCache: { get: vi.fn(() => null), set: vi.fn(), delete: vi.fn() },
}))

// We import AFTER mocks are registered
import { api } from '@/api/request'

describe('M1 request() envelope unwrap', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })

  it('case 1: unwraps {success, data:{...}} envelope to payload', async () => {
    const payload = { sessions: [{ id: 1, name: 'foo' }] }
    mockRequest.mockResolvedValueOnce({
      data: { success: true, data: payload, message: 'Listed' },
    })

    const result = await api.get<typeof payload>('/chat/sessions')

    expect(result).toEqual(payload)
    expect(result).not.toHaveProperty('success')
    expect(result).not.toHaveProperty('message')
  })

  it('case 2: returns response.data directly when no envelope (legacy/raw endpoints)', async () => {
    const raw = { health: 'ok', version: '1.0.0' }
    mockRequest.mockResolvedValueOnce({ data: raw })

    const result = await api.get<typeof raw>('/health')

    expect(result).toEqual(raw)
  })

  it('case 3: unwraps array payload (e.g. ListSessionsResponse.sessions extracted to bare array consumers)', async () => {
    // Some frontend callers expect a bare array; if the backend returns {data: [...]},
    // unwrap should return the array, not the wrapper.
    const arr = [{ id: 1 }, { id: 2 }]
    mockRequest.mockResolvedValueOnce({
      data: { success: true, data: { sessions: arr } },
    })

    // Simulate a caller that does .then((sessions) => sessions.filter(...))
    const result = await api.get<{ sessions: typeof arr }>('/chat/sessions')
    // The caller will receive the inner object; this documents the API contract.
    expect(result.sessions).toEqual(arr)
  })
})
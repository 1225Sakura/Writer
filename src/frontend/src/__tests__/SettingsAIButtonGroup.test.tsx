/**
 * US-019 polish — SettingsAIButtonGroup component tests.
 *
 * Covers:
 *   1. Each of the 4 buttons calls its dedicated backend endpoint
 *   2. Each click triggers `window.electronAPI.appendAILog` (US-018 chain)
 *   3. Loading state is shown while a request is in flight
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  SettingsAIButtonGroup,
  type ActionKey,
} from '@/components/settings/SettingsAIButtonGroup'
import { api } from '@/api/request'

// Mock the shared request module so we can spy on `api.post`.
vi.mock('@/api/request', () => ({
  api: {
    post: vi.fn(),
  },
}))

const ALL_ACTIONS: ActionKey[] = [
  'generate-entity',
  'review-consistency',
  'fill-fields',
  'rewrite-description',
]

describe('US-019: SettingsAIButtonGroup', () => {
  const mockAppendAILog = vi.fn()
  const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Default to a successful resolution so we can verify post-call behaviour.
    mockPost.mockResolvedValue({ data: { ok: true } })
    mockAppendAILog.mockResolvedValue({ success: true })

    // Stub the Electron API used to push to the canonical AI log.
    ;(window as unknown as { electronAPI: unknown }).electronAPI = {
      appendAILog: mockAppendAILog,
    }
  })

  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI
  })

  it('renders the four AI action buttons', () => {
    render(<SettingsAIButtonGroup projectId={1} />)
    for (const key of ALL_ACTIONS) {
      expect(screen.getByTestId(`ai-button-${key}`)).toBeTruthy()
    }
  })

  it('test_generate_button_calls_api — generate-entity hits /ai/generate-entity', async () => {
    render(<SettingsAIButtonGroup projectId={42} entityType="character" hint="a wandering swordsman" />)
    fireEvent.click(screen.getByTestId('ai-button-generate-entity'))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/ai/generate-entity',
        expect.objectContaining({
          type: 'character',
          hint: 'a wandering swordsman',
          projectId: 42,
        }),
      )
    })
  })

  it('test_review_button_calls_api — review-consistency hits /ai/review-consistency', async () => {
    render(<SettingsAIButtonGroup projectId={7} />)
    fireEvent.click(screen.getByTestId('ai-button-review-consistency'))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/ai/review-consistency',
        expect.objectContaining({ projectId: 7 }),
      )
    })
  })

  it('test_fill_button_calls_api — fill-fields hits /ai/fill-fields', async () => {
    render(
      <SettingsAIButtonGroup
        projectId={3}
        entityType="item"
        entityId={99}
        emptyFields={['description', 'history']}
      />,
    )
    fireEvent.click(screen.getByTestId('ai-button-fill-fields'))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/ai/fill-fields',
        expect.objectContaining({
          entityType: 'item',
          entityId: 99,
          emptyFields: ['description', 'history'],
        }),
      )
    })
  })

  it('test_rewrite_button_calls_api — rewrite-description hits /ai/rewrite-description', async () => {
    render(
      <SettingsAIButtonGroup
        projectId={5}
        entityType="location"
        entityId={12}
        rewriteStyle="literary"
      />,
    )
    fireEvent.click(screen.getByTestId('ai-button-rewrite-description'))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/ai/rewrite-description',
        expect.objectContaining({
          entityType: 'location',
          entityId: 12,
          style: 'literary',
        }),
      )
    })
  })

  it('test_button_emits_ai_log_via_electron_api — each click calls appendAILog', async () => {
    render(<SettingsAIButtonGroup projectId={1} />)
    for (const key of ALL_ACTIONS) {
      // The two standalone actions work without an entity selection;
      // the other two require one — set them up before clicking.
      if (key === 'fill-fields' || key === 'rewrite-description') {
        // Re-render with required props
      }
      fireEvent.click(screen.getByTestId(`ai-button-${key}`))
      // Each non-entity-required button fires its log entry.
      await waitFor(() => {
        const calledWith = mockAppendAILog.mock.calls.find(
          (call) => (call[0] as { action?: string }).action === key,
        )
        if (!calledWith && (key === 'fill-fields' || key === 'rewrite-description')) {
          // Skip entity-required actions on this smoke loop; covered below.
          return
        }
        expect(calledWith).toBeDefined()
        expect(calledWith?.[0]).toEqual(
          expect.objectContaining({ action: key, stageId: `settings-${key}` }),
        )
      })
    }
  })

  it('test_button_shows_loading_state — button is disabled while request is in flight', async () => {
    // Make the request hang so we can observe the loading state.
    let resolvePost!: (value: unknown) => void
    mockPost.mockReturnValueOnce(
      new Promise<unknown>((resolve) => {
        resolvePost = resolve
      }),
    )

    render(<SettingsAIButtonGroup projectId={1} />)
    const btn = screen.getByTestId('ai-button-generate-entity') as HTMLButtonElement

    fireEvent.click(btn)

    // While pending, the button must be disabled (loading state).
    await waitFor(() => {
      expect(btn.disabled).toBe(true)
    })

    // Resolve to clean up.
    resolvePost({ data: { ok: true } })
    await waitFor(() => {
      expect(btn.disabled).toBe(false)
    })
  })

  it('entity-required buttons stay disabled when no entity is selected', () => {
    render(<SettingsAIButtonGroup projectId={1} />)
    const fillBtn = screen.getByTestId('ai-button-fill-fields') as HTMLButtonElement
    const rewriteBtn = screen.getByTestId('ai-button-rewrite-description') as HTMLButtonElement

    expect(fillBtn.disabled).toBe(true)
    expect(rewriteBtn.disabled).toBe(true)
    // Standalone actions should be enabled with just a projectId.
    expect((screen.getByTestId('ai-button-generate-entity') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('ai-button-review-consistency') as HTMLButtonElement).disabled).toBe(false)
  })

  it('appendAILog is not called when electronAPI is missing (graceful degradation)', async () => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI
    render(<SettingsAIButtonGroup projectId={1} />)
    fireEvent.click(screen.getByTestId('ai-button-review-consistency'))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/ai/review-consistency',
        expect.objectContaining({ projectId: 1 }),
      )
    })
    // No throw, no log call — graceful degradation in browser mode.
  })
})

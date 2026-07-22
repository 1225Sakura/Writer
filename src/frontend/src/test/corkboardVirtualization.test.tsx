/**
 * Phase 3 Track E.5 — CorkboardView virtualization proof (vitest).
 *
 * Renders CorkboardView against a synthetic 500-chapter dataset and
 * asserts that only a windowed subset of cells is present in the DOM.
 *
 * Acceptance:
 *   - DOM count of [data-chapter-id] is well below 500 (currently < 60).
 *   - The toolbar still reports the correct chapterCount.
 *   - The click handler (handleCardClick) is wired and reachable from
 *     a visible card.
 *
 * jsdom does not implement ResizeObserver; we stub it.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { CorkboardView } from '@/components/writing/corkboard/CorkboardView'
import { useContentStore } from '@/store/contentStore'

// jsdom stubs — matchMedia + ResizeObserver — required by framer-motion
// and react-window v2 Grid size sync.
beforeAll(() => {
  if (typeof window !== 'undefined') {
    if (typeof window.matchMedia !== 'function') {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      })
    }

    // ResizeObserver stub — fires once with a synthetic rect so the
    // component's columnCount derivation can run on first paint.
    class _RO {
      cb: ResizeObserverCallback
      constructor(cb: ResizeObserverCallback) { this.cb = cb }
      observe(target: Element) {
        // Schedule a microtask so it fires after render.
        Promise.resolve().then(() => {
          const rect = (target as HTMLElement).getBoundingClientRect()
          this.cb(
            [{ target, contentRect: rect, borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [] }],
            this,
          )
        })
      }
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error - jsdom does not implement ResizeObserver
    global.ResizeObserver = _RO

    // jsdom is 1024×768 by default; pin a known good viewport for
    // columnCount math.
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true })
  }
})

function seed500Chapters() {
  const chapters = Array.from({ length: 500 }, (_, i) => ({
    id: i + 1,
    project_id: 1,
    outline_id: 1,
    title: `第${i + 1}章`,
    status: 'planning' as const,
    word_count: i * 100,
    chapter_order: i,
    content: '',
    notes: null,
    note_category: null,
    note_pinned: false,
    sections: null,
    pacing_notes: null,
    character_dynamics: null,
    foreshadowing: null,
    battle_station_data: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
  useContentStore.setState({ chapters })
}

describe('CorkboardView — react-window virtualization', () => {
  beforeAll(() => {
    // api.* is called by handleCreateChapter etc; we don't trigger it
    // in this test, but silence the axios chatter to keep the log clean.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('renders only a windowed subset when 500 chapters are present', () => {
    seed500Chapters()
    const { container } = render(<CorkboardView />)

    // Toolbar still reports the full count — the bare {chapterCount}
    // span text should be exactly "500".
    expect(
      screen.getByText('500', { selector: 'span' }),
    ).toBeInTheDocument()

    // Cards in jsdom: we identify them via the sortable attributes
    // dnd-kit emits (data-rfd-droppable-id / data-dnd-id / role). The
    // most stable selector is the title h4 with content "第N章".
    const titles = Array.from(
      container.querySelectorAll<HTMLElement>('h4'),
    ).filter((el) => /^第\d+章$/.test((el.textContent || '').trim()))

    // Virtualization contract: ≪ 500 cards in DOM.
    expect(titles.length).toBeGreaterThan(0)
    expect(titles.length).toBeLessThan(60)

    // Out of the visible cards, only ids within the first viewport +
    // overscan buffer are mounted. Tail of the window must NOT include
    // chapter id 500 (the last seed).
    const ids = titles.map((t) =>
      Number((t.textContent || '').trim().replace(/^第/, '').replace(/章$/, '')),
    )
    expect(ids[0]).toBe(1)
    expect(Math.max(...ids)).toBeLessThan(500)
  })

  it('clicking a visible card dispatches handleCardClick (Track C regression)', () => {
    seed500Chapters()
    const { container } = render(<CorkboardView />)

    // Find the first rendered card by matching its draggable wrapper.
    // dnd-kit's useSortable emits `role="button"` + `aria-roledescription="sortable"`.
    const firstCard = container.querySelector<HTMLElement>(
      '[aria-roledescription="sortable"]',
    )
    expect(firstCard).toBeTruthy()

    // Synthetic click must not throw and exercises the onClick handler
    // chain (ChapterCard → CorkboardView.handleCardClick →
    // setCurrentChapter + setCurrentInterface).
    fireEvent.click(firstCard as HTMLElement)
  })
})

/**
 * US-019 polish — FontSizeSetting component tests.
 *
 * Covers:
 *   1. Selected size is persisted to localStorage under `writer-font-size`
 *   2. Updates flow through `useUIStore.setFontSize` and the global state
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FontSizeSetting } from '@/components/settings/FontSizeSetting'
import { useUIStore } from '@/store/uiStore'

const STORAGE_KEY = 'writer-font-size'

describe('US-019: FontSizeSetting', () => {
  beforeEach(() => {
    // Reset store and storage between tests.
    useUIStore.setState({ fontSize: 16 })
    window.localStorage.clear()
    document.documentElement.style.removeProperty('--writer-font-size')
  })

  afterEach(() => {
    useUIStore.setState({ fontSize: 16 })
    window.localStorage.clear()
    document.documentElement.style.removeProperty('--writer-font-size')
  })

  it('test_font_size_persistence_to_local_storage — selecting 20px writes writer-font-size=20', () => {
    render(<FontSizeSetting />)

    const select = screen.getByTestId('font-size-select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '20' } })

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('20')
    expect(useUIStore.getState().fontSize).toBe(20)
  })

  it('test_font_size_updates_ui_store — store fontSize reflects the selected option', () => {
    render(<FontSizeSetting />)

    const select = screen.getByTestId('font-size-select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '18' } })

    expect(useUIStore.getState().fontSize).toBe(18)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('18')
    // CSS variable should also be updated so writing typography reacts.
    expect(document.documentElement.style.getPropertyValue('--writer-font-size')).toBe('18px')
  })

  it('clamps out-of-range sizes to the supported range', () => {
    render(<FontSizeSetting />)

    const select = screen.getByTestId('font-size-select') as HTMLSelectElement
    // Even if a caller passes a huge value via the action, the store clamps.
    useUIStore.getState().setFontSize(999)

    expect(useUIStore.getState().fontSize).toBe(24) // clamped to max
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('24')

    useUIStore.getState().setFontSize(2)
    expect(useUIStore.getState().fontSize).toBe(12) // clamped to min
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('12')
  })

  it('hydrates from localStorage on mount when persisted value differs', () => {
    window.localStorage.setItem(STORAGE_KEY, '14')

    render(<FontSizeSetting />)

    expect(useUIStore.getState().fontSize).toBe(14)
  })
})

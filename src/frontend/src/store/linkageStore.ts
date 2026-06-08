// ============================================
// Linkage Store — Panel cross-linkage & event bus
// ============================================

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// ============================================
// Types
// ============================================

/** Entity reference used for cross-panel linkage */
export interface EntityRef {
  type: string
  id: number
  /** Optional display name, used for text-based paragraph search */
  name?: string
}

/** Event types emitted by the linkage event bus */
export type LinkageEventType = 'entity-selected' | 'entity-highlight' | 'entity-jump'

/** Event payload for entity-selected */
export interface EntitySelectedEvent {
  entity: EntityRef
  source: string
}

/** Event payload for entity-highlight */
export interface EntityHighlightEvent {
  panels: string[]
  entity: EntityRef
}

/** Event payload for entity-jump */
export interface EntityJumpEvent {
  entity: EntityRef
  source: string
  /** Optional 0-based paragraph index for direct lookup via data-paragraph-id */
  paragraphIndex?: number
}

/** Union of all event payloads */
export type LinkageEventPayload =
  | { type: 'entity-selected'; data: EntitySelectedEvent }
  | { type: 'entity-highlight'; data: EntityHighlightEvent }
  | { type: 'entity-jump'; data: EntityJumpEvent }

/** Listener callback */
type LinkageListener = (payload: LinkageEventPayload) => void

interface LinkageState {
  /** Currently selected entity (null = nothing selected) */
  selectedEntity: EntityRef | null
  /** Panel IDs that should show highlight effects */
  highlightedPanels: string[]
}

interface LinkageActions {
  /** Select an entity and emit entity-selected event */
  selectEntity: (type: string, id: number, source?: string) => void
  /** Clear current selection and highlighted panels */
  clearSelection: () => void
  /** Jump to an entity (navigate + select) and emit entity-jump event */
  jumpToEntity: (type: string, id: number, source?: string, options?: { name?: string; paragraphIndex?: number }) => void
  /** Set highlighted panels directly */
  setHighlightedPanels: (panels: string[]) => void
}

// ============================================
// Event Bus (custom, no external deps)
// ============================================

/** Throttle threshold in ms — prevents event storms */
const THROTTLE_MS = 100
/** Debounce threshold in ms — batches rapid panel updates */
const DEBOUNCE_MS = 150

class LinkageEventBus {
  private listeners = new Map<LinkageEventType, Set<LinkageListener>>()
  private lastEmitTime = new Map<LinkageEventType, number>()
  private debounceTimers = new Map<LinkageEventType, ReturnType<typeof setTimeout>>()

  /** Subscribe to a linkage event. Returns unsubscribe function. */
  on(event: LinkageEventType, listener: LinkageListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    return () => {
      this.listeners.get(event)?.delete(listener)
    }
  }

  /** Emit a linkage event with throttle (100ms) + debounce (150ms) for panel updates. */
  emit(payload: LinkageEventPayload): void {
    const { type } = payload
    const now = Date.now()
    const lastTime = this.lastEmitTime.get(type) ?? 0

    // Throttle: skip if emitted within THROTTLE_MS
    if (now - lastTime < THROTTLE_MS) {
      // For throttled events, schedule a debounced fallback so the final event is not lost
      this.scheduleDebounce(type, payload)
      return
    }

    this.lastEmitTime.set(type, now)
    this.dispatch(type, payload)
  }

  /** Remove all listeners */
  clear(): void {
    this.listeners.clear()
    this.lastEmitTime.clear()
    this.debounceTimers.forEach((timer) => {
      clearTimeout(timer)
    })
    this.debounceTimers.clear()
  }

  private dispatch(type: LinkageEventType, payload: LinkageEventPayload): void {
    const set = this.listeners.get(type)
    if (!set) return
    set.forEach((listener) => {
      try {
        listener(payload)
      } catch (_err) {
        // Swallow listener errors to avoid breaking the bus
      }
    })
  }

  private scheduleDebounce(type: LinkageEventType, payload: LinkageEventPayload): void {
    // Clear previous debounce timer for this event type
    const existing = this.debounceTimers.get(type)
    if (existing !== undefined) {
      clearTimeout(existing)
    }
    this.debounceTimers.set(
      type,
      setTimeout(() => {
        this.debounceTimers.delete(type)
        this.lastEmitTime.set(type, Date.now())
        this.dispatch(type, payload)
      }, DEBOUNCE_MS),
    )
  }
}

/** Singleton event bus instance */
export const linkageEventBus = new LinkageEventBus()

// ============================================
// Panel-to-entity highlight mapping
// ============================================

/** Given an entity type, return the panel IDs that should highlight */
function getHighlightPanels(entityType: string): string[] {
  switch (entityType) {
    case 'character':
      return ['settings-character', 'writing-collaboration', 'graph']
    case 'item':
      return ['settings-item', 'writing-ai']
    case 'location':
      return ['settings-location', 'graph']
    case 'faction':
      return ['settings-faction', 'graph']
    case 'rule':
      return ['settings-rule']
    case 'outline':
      return ['settings-outline', 'writing-outline']
    case 'chapter':
      return ['writing-editor', 'writing-outline']
    case 'ifline':
      return ['settings-ifline', 'writing-collaboration']
    case 'foreshadowing':
      return ['writing-ai', 'settings-outline']
    default:
      return []
  }
}

// ============================================
// Store
// ============================================

export const useLinkageStore = create<LinkageState & LinkageActions>()(
  subscribeWithSelector(
    immer((set, _get) => ({
      // Initial state
      selectedEntity: null,
      highlightedPanels: [],

      // ----------------------------------------
      // Actions
      // ----------------------------------------

      selectEntity: (type, id, source = 'unknown') => {
        const entity: EntityRef = { type, id }
        set((state) => {
          state.selectedEntity = entity
          state.highlightedPanels = getHighlightPanels(type)
        })
        linkageEventBus.emit({
          type: 'entity-selected',
          data: { entity, source },
        })
        // Also emit highlight event for panels
        linkageEventBus.emit({
          type: 'entity-highlight',
          data: { panels: getHighlightPanels(type), entity },
        })
      },

      clearSelection: () => {
        set((state) => {
          state.selectedEntity = null
          state.highlightedPanels = []
        })
      },

      jumpToEntity: (type, id, source = 'unknown', options) => {
        const entity: EntityRef = { type, id, name: options?.name }
        set((state) => {
          state.selectedEntity = entity
          state.highlightedPanels = getHighlightPanels(type)
        })
        linkageEventBus.emit({
          type: 'entity-jump',
          data: { entity, source, paragraphIndex: options?.paragraphIndex },
        })
      },

      setHighlightedPanels: (panels) => {
        set((state) => {
          state.highlightedPanels = panels
        })
      },
    })),
  ),
)

// ============================================
// Selectors
// ============================================

/** Select current entity reference */
export const selectSelectedEntity = (state: LinkageState) => state.selectedEntity

/** Select highlighted panel IDs */
export const selectHighlightedPanels = (state: LinkageState) => state.highlightedPanels

/** Check if a specific panel is highlighted */
export const selectIsPanelHighlighted = (panelId: string) =>
  (state: LinkageState) => state.highlightedPanels.includes(panelId)

/** Check if a specific entity is currently selected */
export const selectIsEntitySelected = (type: string, id: number) =>
  (state: LinkageState) =>
    state.selectedEntity?.type === type && state.selectedEntity?.id === id

/** Cleanup: clear event bus listeners (call on app teardown) */
export function cleanupLinkageStore(): void {
  linkageEventBus.clear()
}

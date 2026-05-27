import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { entityApi } from '../api/chat'
import { showOperationError } from '../utils/toastHelper'
import type { ExtractedEntityLocal, EntityExtractionState, ChatMessageLocal } from './chatStore'

// Re-export types
export type { ExtractedEntityLocal, EntityExtractionState }

// ============================================
// Types
// ============================================

interface ChatEntityState {
  extractedEntities: ExtractedEntityLocal[]
  extractionState: EntityExtractionState
  extractionProgress: number
  isLoading: boolean
  error: string | null
}

interface ChatEntityActions {
  loadExtractedEntities: (sessionId: number) => Promise<void>
  addExtractedEntity: (entity: Omit<ExtractedEntityLocal, 'id'>) => void
  updateExtractedEntity: (id: string, updates: Partial<ExtractedEntityLocal>) => void
  removeExtractedEntity: (id: string) => void
  confirmEntity: (id: string) => Promise<void>
  batchConfirmEntities: (ids: string[]) => Promise<void>
  extractEntitiesFromMessage: (message: ChatMessageLocal) => void
  setExtractionState: (state: EntityExtractionState) => void
  setExtractedEntities: (entities: ExtractedEntityLocal[]) => void
  linkEntityToMessage: (entityId: string, messageId: string) => void
}

// ============================================
// ID Generator
// ============================================

let entityIdCounter = 0

if (typeof window !== 'undefined') {
  const stored = sessionStorage.getItem('chat-entity-counter')
  if (stored) entityIdCounter = parseInt(stored, 10)
}

const genEntityId = () => {
  const id = `entity-${Date.now()}-${++entityIdCounter}`
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('chat-entity-counter', String(entityIdCounter))
  }
  return id
}

// ============================================
// Store
// ============================================

export const useChatEntityStore = create<ChatEntityState & ChatEntityActions>()(
  immer(
    subscribeWithSelector(
      (set, get) => ({
        extractedEntities: [],
        extractionState: 'idle',
        extractionProgress: 0,
        isLoading: false,
        error: null,

        loadExtractedEntities: async (sessionId) => {
          set((state) => { state.isLoading = true })
          try {
            const entities = await entityApi.list(sessionId)
            set((state) => {
              state.extractedEntities = entities.map((e) => ({
                id: String(e.id),
                type: e.type as ExtractedEntityLocal['type'],
                name: e.name,
                description: e.description,
                confirmed: Boolean(e.confirmed),
              }))
              state.isLoading = false
            })
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message
              state.isLoading = false
            })
            showOperationError('加载提取实体', error)
          }
        },

        addExtractedEntity: (entity) => {
          const newEntity: ExtractedEntityLocal = {
            ...entity,
            id: genEntityId(),
          }
          set((state) => { state.extractedEntities.push(newEntity) })
        },

        updateExtractedEntity: (id, updates) => {
          set((state) => {
            const entity = state.extractedEntities.find((e) => e.id === id)
            if (entity) {
              Object.assign(entity, updates)
            }
          })
        },

        removeExtractedEntity: (id) => {
          set((state) => {
            state.extractedEntities = state.extractedEntities.filter((e) => e.id !== id)
          })
        },

        confirmEntity: async (id) => {
          try {
            await entityApi.confirm(Number(id), true)
            set((state) => {
              const entity = state.extractedEntities.find((e) => e.id === id)
              if (entity) entity.confirmed = true
            })
          } catch (error) {
            set((state) => { state.error = (error as Error).message })
            showOperationError('确认实体', error)
          }
        },

        batchConfirmEntities: async (ids) => {
          set((state) => { state.extractionState = 'confirming' })
          try {
            await Promise.all(
              ids.map((id) => entityApi.confirm(Number(id), true))
            )
            set((state) => {
              ids.forEach((id) => {
                const entity = state.extractedEntities.find((e) => e.id === id)
                if (entity) entity.confirmed = true
              })
              state.extractionState = 'completed'
              state.extractionProgress = 100
            })
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message
              state.extractionState = 'error'
            })
            showOperationError('批量确认实体', error)
          }
        },

        extractEntitiesFromMessage: (message) => {
          set((state) => {
            state.extractionState = 'extracting'
            state.extractionProgress = 0
          })

          const entityPatterns: { type: ExtractedEntityLocal['type']; regex: RegExp }[] = [
            { type: 'character', regex: /["']([^"']+?)["'](?:\s*[，,]\s*.*?角色|.*?主角|.*?人物)/g },
            { type: 'location', regex: /([一-龥]{2,}(?:大陆|城|国|岛|山|森林|海))/g },
            { type: 'faction', regex: /([一-龥]{2,}(?:门|派|宗|教|盟|会|族))/g },
            { type: 'item', regex: /([一-龥]{2,}(?:剑|刀|法宝|秘籍|丹药))/g },
          ]

          const foundEntities: ExtractedEntityLocal[] = []
          const existingNames = new Set(get().extractedEntities.map((e) => e.name))

          entityPatterns.forEach(({ type, regex }) => {
            let match: RegExpExecArray | null
            while ((match = regex.exec(message.content)) !== null) {
              const name = match[1]
              if (name && !existingNames.has(name)) {
                existingNames.add(name)
                foundEntities.push({
                  id: genEntityId(),
                  type,
                  name,
                  description: `从对话中提取的${type === 'character' ? '角色' : type === 'location' ? '地点' : type === 'faction' ? '势力' : '物品'}`,
                  confirmed: false,
                  sourceMessageId: message.id,
                })
              }
            }
          })

          set((state) => {
            if (foundEntities.length > 0) {
              state.extractedEntities.push(...foundEntities)
            }
            state.extractionState = foundEntities.length > 0 ? 'reviewing' : 'completed'
            state.extractionProgress = 100
          })
        },

        setExtractionState: (extractionState) => {
          set((state) => { state.extractionState = extractionState })
        },

        setExtractedEntities: (entities) => {
          set((state) => { state.extractedEntities = entities })
        },

        linkEntityToMessage: (entityId, messageId) => {
          set((state) => {
            const entity = state.extractedEntities.find((e) => e.id === entityId)
            if (entity) {
              entity.sourceMessageId = messageId
            }
          })
        },
      })
    )
  )
)

// ============================================
// Selectors
// ============================================

export const selectConfirmedEntities = (state: ChatEntityState) =>
  state.extractedEntities.filter((e) => e.confirmed)

export const selectPendingEntities = (state: ChatEntityState) =>
  state.extractedEntities.filter((e) => !e.confirmed)

export const selectEntitiesByType = (type: ExtractedEntityLocal['type']) => (state: ChatEntityState) =>
  state.extractedEntities.filter((e) => e.type === type)
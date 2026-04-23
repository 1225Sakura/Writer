import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { sessionApi, messageApi, entityApi } from '../api/chat'
import type { ChatSession, ExtractedEntity } from '../api/types'
import { createHybridStorage } from './utils/indexedDBStorage'

// ============================================
// Types
// ============================================

export interface ChatMessageLocal {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  editedAt?: number
  entities?: ExtractedEntityLocal[]
  pending?: boolean
  failed?: boolean
}

export interface ExtractedEntityLocal {
  id: string
  type: 'world' | 'character' | 'item' | 'location' | 'faction' | 'rule' | 'ifline'
  name: string
  description?: string
  confirmed: boolean
  sourceMessageId?: string
}

export type EntityExtractionState =
  | 'idle'
  | 'extracting'
  | 'reviewing'
  | 'confirming'
  | 'completed'
  | 'error'

export interface MessageCache {
  messages: Record<number, ChatMessageLocal[]>
  cachedAt: Record<number, number>
}

interface ChatState {
  sessionId: number | null
  sessions: ChatSession[]
  messages: ChatMessageLocal[]
  extractedEntities: ExtractedEntityLocal[]
  isStreaming: boolean
  currentStreamContent: string
  streamAbortController: AbortController | null
  isLoading: boolean
  error: string | null
  extractionState: EntityExtractionState
  extractionProgress: number
  messageCache: MessageCache
  lastActiveSessionId: number | null
}

interface ChatActions {
  createSession: () => Promise<void>
  loadSessions: () => Promise<void>
  switchSession: (sessionId: number) => Promise<void>
  clearSession: () => void
  deleteSession: (sessionId: number) => Promise<void>
  sendMessage: (content: string, options?: { currentCategory?: string }) => Promise<void>
  loadMessages: () => Promise<void>
  editMessage: (id: string, newContent: string) => void
  deleteMessage: (id: string) => void
  retryMessage: (id: string) => Promise<void>
  updateStreamingContent: (content: string) => void
  finishStreaming: () => void
  abortStreaming: () => void
  loadExtractedEntities: () => Promise<void>
  addExtractedEntity: (entity: Omit<ExtractedEntityLocal, 'id'>) => void
  updateExtractedEntity: (id: string, updates: Partial<ExtractedEntityLocal>) => void
  removeExtractedEntity: (id: string) => void
  confirmEntity: (id: string) => Promise<void>
  batchConfirmEntities: (ids: string[]) => Promise<void>
  extractEntitiesFromMessage: (messageId: string) => Promise<void>
  setExtractionState: (state: EntityExtractionState) => void
  exportToOutline: () => { title: string; entries: { type: string; name: string; description?: string }[] }
  clearMessageCache: () => void
  getCachedMessages: (sessionId: number) => ChatMessageLocal[] | undefined
}

// ============================================
// ID Generators
// ============================================

let messageIdCounter = 0
let entityIdCounter = 0

if (typeof window !== 'undefined') {
  const storedMsg = sessionStorage.getItem('chat-message-counter')
  const storedEnt = sessionStorage.getItem('chat-entity-counter')
  if (storedMsg) messageIdCounter = parseInt(storedMsg, 10)
  if (storedEnt) entityIdCounter = parseInt(storedEnt, 10)
}

const genMessageId = () => {
  const id = `msg-${Date.now()}-${++messageIdCounter}`
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('chat-message-counter', String(messageIdCounter))
  }
  return id
}

const genEntityId = () => {
  const id = `entity-${Date.now()}-${++entityIdCounter}`
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('chat-entity-counter', String(entityIdCounter))
  }
  return id
}

// ============================================
// Hybrid Storage Cache Helpers
// ============================================

const CACHE_KEY = 'writer-chat-message-cache'
const cacheStorage = createHybridStorage(100 * 1024)

async function saveCacheToStorage(cache: MessageCache) {
  if (typeof window === 'undefined') return
  try {
    await cacheStorage.setItem(CACHE_KEY, { state: cache, version: 0 })
  } catch (e) {
    console.warn('Chat cache storage full, clearing old entries')
    const entries = Object.entries(cache.cachedAt).sort((a, b) => a[1] - b[1])
    const toRemove = entries.slice(0, Math.floor(entries.length / 2))
    toRemove.forEach(([sid]) => {
      delete cache.messages[Number(sid)]
      delete cache.cachedAt[Number(sid)]
    })
    try {
      await cacheStorage.setItem(CACHE_KEY, { state: cache, version: 0 })
    } catch {
      // Still full, give up
    }
  }
}

// ============================================
// Store
// ============================================

export const useChatStore = create<ChatState & ChatActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          sessionId: null,
          sessions: [],
          messages: [],
          extractedEntities: [],
          isStreaming: false,
          currentStreamContent: '',
          streamAbortController: null,
          isLoading: false,
          error: null,
          extractionState: 'idle',
          extractionProgress: 0,
          messageCache: { messages: {}, cachedAt: {} },
          lastActiveSessionId: null,

          createSession: async () => {
            set((state) => {
              state.isLoading = true
              state.error = null
            })
            try {
              const session = await sessionApi.create()
              set((state) => {
                state.sessionId = session.id
                state.lastActiveSessionId = session.id
                state.messages = []
                state.extractedEntities = []
                state.sessions.unshift(session)
                state.isLoading = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },

          loadSessions: async () => {
            set((state) => { state.isLoading = true })
            try {
              const sessions = await sessionApi.list()
              set((state) => {
                state.sessions = sessions
                state.isLoading = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },

          switchSession: async (sessionId) => {
            const { messageCache, lastActiveSessionId } = get()
            if (lastActiveSessionId !== null && lastActiveSessionId !== sessionId) {
              const currentMessages = get().messages
              if (currentMessages.length > 0) {
                set((state) => {
                  state.messageCache.messages[lastActiveSessionId] = currentMessages
                  state.messageCache.cachedAt[lastActiveSessionId] = Date.now()
                })
                await saveCacheToStorage(get().messageCache)
              }
            }
            set((state) => {
              state.sessionId = sessionId
              state.lastActiveSessionId = sessionId
              state.isLoading = true
              state.error = null
            })
            const cached = messageCache.messages[sessionId]
            if (cached) {
              set((state) => { state.messages = cached })
            }
            try {
              const [backendMessages, entities] = await Promise.all([
                messageApi.list(sessionId),
                entityApi.list(sessionId).catch(() => [] as ExtractedEntity[]),
              ])
              const messages: ChatMessageLocal[] = backendMessages.map((m) => ({
                id: String(m.id),
                role: m.role as 'user' | 'assistant',
                content: m.content,
                createdAt: new Date(m.created_at).getTime(),
              }))
              const extractedEntities: ExtractedEntityLocal[] = entities.map((e) => ({
                id: String(e.id),
                type: e.type as ExtractedEntityLocal['type'],
                name: e.name,
                description: e.description,
                confirmed: Boolean(e.confirmed),
              }))
              set((state) => {
                state.messages = messages
                state.extractedEntities = extractedEntities
                state.isLoading = false
                state.messageCache.messages[sessionId] = messages
                state.messageCache.cachedAt[sessionId] = Date.now()
              })
              await saveCacheToStorage(get().messageCache)
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },

          clearSession: () => {
            const { sessionId, messages } = get()
            if (sessionId !== null && messages.length > 0) {
              set((state) => {
                state.messageCache.messages[sessionId] = messages
                state.messageCache.cachedAt[sessionId] = Date.now()
              })
              saveCacheToStorage(get().messageCache)
            }
            set((state) => {
              state.sessionId = null
              state.messages = []
              state.extractedEntities = []
              state.isStreaming = false
              state.currentStreamContent = ''
              state.error = null
            })
          },

          deleteSession: async (sessionId) => {
            try {
              await sessionApi.delete(sessionId)
              set((state) => {
                state.sessions = state.sessions.filter((s) => s.id !== sessionId)
                delete state.messageCache.messages[sessionId]
                delete state.messageCache.cachedAt[sessionId]
                if (state.sessionId === sessionId) {
                  state.sessionId = null
                  state.messages = []
                }
              })
              await saveCacheToStorage(get().messageCache)
            } catch (error) {
              set((state) => { state.error = (error as Error).message })
            }
          },

          sendMessage: async (content, options = {}) => {
            const { sessionId, extractedEntities } = get()
            if (!sessionId) return

            const userMessageId = genMessageId()
            set((state) => {
              state.messages.push({
                id: userMessageId,
                role: 'user',
                content,
                createdAt: Date.now(),
                pending: false,
              })
              state.isStreaming = true
              state.currentStreamContent = ''
              state.error = null
            })

            const abortController = new AbortController()
            set((state) => { state.streamAbortController = abortController })

            try {
              // Build collected_settings from confirmed entities
              const confirmedEntities = extractedEntities.filter((e) => e.confirmed)
              const collectedSettings: Record<string, string | number | boolean | null> = {}
              confirmedEntities.forEach((e) => {
                const key = e.type === 'world' ? 'worldview' : e.type === 'character' ? 'protagonist' : e.type
                if (!collectedSettings[key]) {
                  collectedSettings[key] = e.name
                }
              })

              // Determine current category from extraction state
              const currentCategory = options.currentCategory ||
                (confirmedEntities.length === 0 ? 'genre' :
                 !collectedSettings['worldview'] ? 'worldview' :
                 !collectedSettings['protagonist'] ? 'protagonist' :
                 !collectedSettings['power_system'] ? 'power_system' :
                 'plot_direction')

              const response = await messageApi.send(
                sessionId,
                {
                  content,
                  collected_settings: Object.keys(collectedSettings).length > 0 ? collectedSettings : undefined,
                  current_category: currentCategory,
                },
                { signal: abortController.signal }
              )

              const assistantMessage: ChatMessageLocal = {
                id: genMessageId(),
                role: 'assistant',
                content: response.ai_message.content,
                createdAt: new Date(response.ai_message.created_at).getTime(),
              }

              set((state) => {
                state.messages.push(assistantMessage)
                state.currentStreamContent = ''
                state.isStreaming = false
                state.streamAbortController = null
                state.messageCache.messages[sessionId] = state.messages
                state.messageCache.cachedAt[sessionId] = Date.now()
              })
              await saveCacheToStorage(get().messageCache)
            } catch (error) {
              set((state) => {
                const msg = state.messages.find((m) => m.id === userMessageId)
                if (msg) msg.failed = true
                state.error = (error as Error).message
                state.isStreaming = false
                state.currentStreamContent = ''
                state.streamAbortController = null
              })
            }
          },

          retryMessage: async (id) => {
            const { messages } = get()
            const msg = messages.find((m) => m.id === id)
            if (!msg || msg.role !== 'user') return
            set((state) => {
              const m = state.messages.find((x) => x.id === id)
              if (m) {
                m.failed = false
                m.pending = false
              }
            })
            await get().sendMessage(msg.content)
          },

          loadMessages: async () => {
            const { sessionId } = get()
            if (!sessionId) return
            set((state) => { state.isLoading = true })
            try {
              const backendMessages = await messageApi.list(sessionId)
              const messages: ChatMessageLocal[] = backendMessages.map((m) => ({
                id: String(m.id),
                role: m.role as 'user' | 'assistant',
                content: m.content,
                createdAt: new Date(m.created_at).getTime(),
              }))
              set((state) => {
                state.messages = messages
                state.isLoading = false
                state.messageCache.messages[sessionId] = messages
                state.messageCache.cachedAt[sessionId] = Date.now()
              })
              await saveCacheToStorage(get().messageCache)
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },

          editMessage: (id, newContent) => {
            set((state) => {
              const msg = state.messages.find((m) => m.id === id)
              if (msg) {
                msg.content = newContent
                msg.editedAt = Date.now()
              }
            })
          },

          deleteMessage: (id) => {
            set((state) => {
              state.messages = state.messages.filter((m) => m.id !== id)
              state.extractedEntities = state.extractedEntities.filter(
                (e) => e.sourceMessageId !== id
              )
            })
          },

          updateStreamingContent: (content) => {
            set((state) => { state.currentStreamContent = content })
          },

          finishStreaming: () => {
            const { currentStreamContent, sessionId } = get()
            if (!currentStreamContent) return
            const newMessage: ChatMessageLocal = {
              id: genMessageId(),
              role: 'assistant',
              content: currentStreamContent,
              createdAt: Date.now(),
            }
            set((state) => {
              state.messages.push(newMessage)
              state.currentStreamContent = ''
              state.isStreaming = false
              state.streamAbortController = null
              if (sessionId !== null) {
                state.messageCache.messages[sessionId] = state.messages
                state.messageCache.cachedAt[sessionId] = Date.now()
              }
            })
            saveCacheToStorage(get().messageCache)
          },

          abortStreaming: () => {
            const { streamAbortController } = get()
            if (streamAbortController) {
              streamAbortController.abort()
            }
            set((state) => {
              state.isStreaming = false
              state.currentStreamContent = ''
              state.streamAbortController = null
            })
          },

          loadExtractedEntities: async () => {
            const { sessionId } = get()
            if (!sessionId) return
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
            }
          },

          extractEntitiesFromMessage: async (messageId) => {
            const { messages } = get()
            const message = messages.find((m) => m.id === messageId)
            if (!message) return
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
                    sourceMessageId: messageId,
                  })
                }
              }
            })
            set((state) => {
              if (foundEntities.length > 0) {
                state.extractedEntities.push(...foundEntities)
                const msg = state.messages.find((m) => m.id === messageId)
                if (msg) {
                  if (!msg.entities) msg.entities = []
                  msg.entities.push(...foundEntities)
                }
              }
              state.extractionState = foundEntities.length > 0 ? 'reviewing' : 'completed'
              state.extractionProgress = 100
            })
          },

          setExtractionState: (extractionState) => {
            set((state) => { state.extractionState = extractionState })
          },

          exportToOutline: () => {
            const { messages, extractedEntities } = get()
            const confirmedEntities = extractedEntities.filter((e) => e.confirmed)
            const plotPoints = messages
              .filter((m) => m.role === 'user')
              .map((m) => m.content)
              .filter((c) => c.length > 10)
              .slice(0, 5)
            const entries = [
              ...confirmedEntities.map((e) => ({
                type: e.type,
                name: e.name,
                description: e.description,
              })),
              ...plotPoints.map((content, i) => ({
                type: 'plot_point',
                name: `情节要点 ${i + 1}`,
                description: content.slice(0, 100),
              })),
            ]
            const title = plotPoints[0]?.slice(0, 20) || '未命名故事'
            return { title, entries }
          },

          clearMessageCache: () => {
            set((state) => {
              state.messageCache = { messages: {}, cachedAt: {} }
            })
            if (typeof window !== 'undefined') {
              cacheStorage.removeItem(CACHE_KEY)
            }
          },

          getCachedMessages: (sessionId) => {
            return get().messageCache.messages[sessionId]
          },
        }),
        {
          name: 'writer-chat-store-v2',
          storage: createHybridStorage(50 * 1024) as never,
          partialize: (state) => ({
            sessionId: state.sessionId,
            lastActiveSessionId: state.lastActiveSessionId,
            extractedEntities: state.extractedEntities,
            extractionState: state.extractionState,
            messageCache: state.messageCache,
          }),
          version: 2,
        }
      )
    )
  )
)

// ============================================
// Selectors (with shallow comparison for performance)
// ============================================

export const selectConfirmedEntities = (state: ChatState) =>
  state.extractedEntities.filter((e) => e.confirmed)

export const selectPendingEntities = (state: ChatState) =>
  state.extractedEntities.filter((e) => !e.confirmed)

export const selectMessageCount = (state: ChatState) => state.messages.length

export const selectIsEmptySession = (state: ChatState) =>
  state.messages.length === 0

export const selectStreamingState = (state: ChatState) => ({
  isStreaming: state.isStreaming,
  currentStreamContent: state.currentStreamContent,
})

export const selectLoadingError = (state: ChatState) => ({
  isLoading: state.isLoading,
  error: state.error,
})

export const selectEntitiesByType = (type: ExtractedEntityLocal['type']) => (state: ChatState) =>
  state.extractedEntities.filter((e) => e.type === type)

export function cleanupChatStore() {
  useChatStore.setState({
    isStreaming: false,
    currentStreamContent: '',
    streamAbortController: null,
    isLoading: false,
    error: null,
  })
}

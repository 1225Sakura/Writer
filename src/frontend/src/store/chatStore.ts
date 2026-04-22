import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { sessionApi, messageApi, entityApi } from '../api/chat'
import type { ChatSession, ExtractedEntity } from '../api/types'

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
  /** 本地缓存标记 - 未同步到后端 */
  pending?: boolean
  /** 发送失败标记 */
  failed?: boolean
}

export interface ExtractedEntityLocal {
  id: string
  type: 'world' | 'character' | 'item' | 'location' | 'faction' | 'rule' | 'ifline'
  name: string
  description?: string
  confirmed: boolean
  /** 提取来源消息ID */
  sourceMessageId?: string
}

/** 实体提取状态机 */
export type EntityExtractionState =
  | 'idle'
  | 'extracting'
  | 'reviewing'
  | 'confirming'
  | 'completed'
  | 'error'

export interface MessageCache {
  /** 会话ID -> 消息列表 */
  messages: Record<number, ChatMessageLocal[]>
  /** 缓存时间戳 */
  cachedAt: Record<number, number>
}

interface ChatState {
  // Core
  sessionId: number | null
  sessions: ChatSession[]
  messages: ChatMessageLocal[]
  extractedEntities: ExtractedEntityLocal[]

  // Streaming
  isStreaming: boolean
  currentStreamContent: string
  streamAbortController: AbortController | null

  // Loading & Error
  isLoading: boolean
  error: string | null

  // Entity extraction state machine
  extractionState: EntityExtractionState
  extractionProgress: number

  // Message cache
  messageCache: MessageCache

  // Session recovery
  lastActiveSessionId: number | null
}

interface ChatActions {
  // Session management
  createSession: () => Promise<void>
  loadSessions: () => Promise<void>
  switchSession: (sessionId: number) => Promise<void>
  clearSession: () => void
  deleteSession: (sessionId: number) => Promise<void>

  // Messaging
  sendMessage: (content: string) => Promise<void>
  loadMessages: () => Promise<void>
  editMessage: (id: string, newContent: string) => void
  deleteMessage: (id: string) => void
  retryMessage: (id: string) => Promise<void>

  // Streaming
  updateStreamingContent: (content: string) => void
  finishStreaming: () => void
  abortStreaming: () => void

  // Entity extraction
  loadExtractedEntities: () => Promise<void>
  addExtractedEntity: (entity: Omit<ExtractedEntityLocal, 'id'>) => void
  updateExtractedEntity: (id: string, updates: Partial<ExtractedEntityLocal>) => void
  removeExtractedEntity: (id: string) => void
  confirmEntity: (id: string) => Promise<void>
  batchConfirmEntities: (ids: string[]) => Promise<void>
  extractEntitiesFromMessage: (messageId: string) => Promise<void>
  setExtractionState: (state: EntityExtractionState) => void

  // Export
  exportToOutline: () => { title: string; entries: { type: string; name: string; description?: string }[] }

  // Cache management
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
// Local Storage Cache Helpers
// ============================================

const CACHE_KEY = 'writer-chat-message-cache'
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

function loadCacheFromStorage(): MessageCache {
  if (typeof window === 'undefined') return { messages: {}, cachedAt: {} }
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { messages: {}, cachedAt: {} }
    const parsed = JSON.parse(raw) as MessageCache
    // Clean expired entries
    const now = Date.now()
    const cleaned: MessageCache = { messages: {}, cachedAt: {} }
    Object.entries(parsed.cachedAt).forEach(([sid, ts]) => {
      if (now - ts < CACHE_TTL) {
        const id = Number(sid)
        cleaned.messages[id] = parsed.messages[id]
        cleaned.cachedAt[id] = ts
      }
    })
    return cleaned
  } catch {
    return { messages: {}, cachedAt: {} }
  }
}

function saveCacheToStorage(cache: MessageCache) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (e) {
    // Storage full - clear old entries
    console.warn('Chat cache storage full, clearing old entries')
    const entries = Object.entries(cache.cachedAt).sort((a, b) => a[1] - b[1])
    const toRemove = entries.slice(0, Math.floor(entries.length / 2))
    toRemove.forEach(([sid]) => {
      delete cache.messages[Number(sid)]
      delete cache.cachedAt[Number(sid)]
    })
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
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
          // Initial state
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
          messageCache: loadCacheFromStorage(),
          lastActiveSessionId: null,

          // ----------------------------------------
          // Session Management
          // ----------------------------------------

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

            // Save current messages to cache before switching
            if (lastActiveSessionId !== null && lastActiveSessionId !== sessionId) {
              const currentMessages = get().messages
              if (currentMessages.length > 0) {
                set((state) => {
                  state.messageCache.messages[lastActiveSessionId] = currentMessages
                  state.messageCache.cachedAt[lastActiveSessionId] = Date.now()
                })
                saveCacheToStorage(get().messageCache)
              }
            }

            set((state) => {
              state.sessionId = sessionId
              state.lastActiveSessionId = sessionId
              state.isLoading = true
              state.error = null
            })

            // Try cache first for instant UI
            const cached = messageCache.messages[sessionId]
            if (cached) {
              set((state) => { state.messages = cached })
            }

            // Then load fresh from backend
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
                // Update cache
                state.messageCache.messages[sessionId] = messages
                state.messageCache.cachedAt[sessionId] = Date.now()
              })
              saveCacheToStorage(get().messageCache)
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },

          clearSession: () => {
            const { sessionId, messages } = get()
            // Cache before clearing
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
              saveCacheToStorage(get().messageCache)
            } catch (error) {
              set((state) => { state.error = (error as Error).message })
            }
          },

          // ----------------------------------------
          // Messaging
          // ----------------------------------------

          sendMessage: async (content) => {
            const { sessionId } = get()
            if (!sessionId) return

            const userMessageId = genMessageId()
            const userMessage: ChatMessageLocal = {
              id: userMessageId,
              role: 'user',
              content,
              createdAt: Date.now(),
              pending: false,
            }

            set((state) => {
              state.messages.push(userMessage)
              state.isStreaming = true
              state.currentStreamContent = ''
              state.error = null
            })

            const abortController = new AbortController()
            set((state) => { state.streamAbortController = abortController })

            try {
              const response = await messageApi.send(sessionId, { content })

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
                // Update cache
                state.messageCache.messages[sessionId] = state.messages
                state.messageCache.cachedAt[sessionId] = Date.now()
              })
              saveCacheToStorage(get().messageCache)
            } catch (error) {
              // Mark user message as failed
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
              saveCacheToStorage(get().messageCache)
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
              // Also remove associated entities
              state.extractedEntities = state.extractedEntities.filter(
                (e) => e.sourceMessageId !== id
              )
            })
          },

          // ----------------------------------------
          // Streaming
          // ----------------------------------------

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

          // ----------------------------------------
          // Entity Extraction
          // ----------------------------------------

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

            // Simple heuristic extraction - in production this would call an API
            const entityPatterns: { type: ExtractedEntityLocal['type']; regex: RegExp }[] = [
              { type: 'character', regex: /["']([^"']+?)["'](?:\s*[，,]\s*.*?角色|.*?主角|.*?人物)/g },
              { type: 'location', regex: /([\u4e00-\u9fa5]{2,}(?:大陆|城|国|岛|山|森林|海))/g },
              { type: 'faction', regex: /([\u4e00-\u9fa5]{2,}(?:门|派|宗|教|盟|会|族))/g },
              { type: 'item', regex: /([\u4e00-\u9fa5]{2,}(?:剑|刀|法宝|秘籍|丹药))/g },
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

          // ----------------------------------------
          // Export
          // ----------------------------------------

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

          // ----------------------------------------
          // Cache Management
          // ----------------------------------------

          clearMessageCache: () => {
            set((state) => {
              state.messageCache = { messages: {}, cachedAt: {} }
            })
            if (typeof window !== 'undefined') {
              localStorage.removeItem(CACHE_KEY)
            }
          },

          getCachedMessages: (sessionId) => {
            return get().messageCache.messages[sessionId]
          },
        }),
        {
          name: 'writer-chat-store-v2',
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
// Selectors (for performance)
// ============================================

export const selectConfirmedEntities = (state: ChatState) =>
  state.extractedEntities.filter((e) => e.confirmed)

export const selectPendingEntities = (state: ChatState) =>
  state.extractedEntities.filter((e) => !e.confirmed)

export const selectMessageCount = (state: ChatState) => state.messages.length

export const selectIsEmptySession = (state: ChatState) =>
  state.messages.length === 0

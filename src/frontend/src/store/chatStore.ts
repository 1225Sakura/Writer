import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  sessionApi,
  messageApi,
  entityApi,
  migrateChatToSettings as migrateChatToSettingsApi,
  type MigrateToSettingsResult,
} from '../api/chat'
import { aiReviewApi } from '../api/aiReview'
import type { ChatSession, ExtractedEntity } from '../api/types'
import { createHybridStorage } from './utils/indexedDBStorage'
import { useUIStore } from './uiStore'
import { showApiError, showOperationError, showSuccess } from '@/utils/toastHelper'
import type { ApiError } from '@/api/request'
import type { WritingStats, WritingGoal } from '../services/writingStatsService'
import { createSnapshot, listSnapshots, rollbackToSnapshot, diffSnapshots as diffSnapshotService, type VersionSnapshot, type EntityDiffItem } from '../services/versionService'
import {
  calculateTotalChars,
  calculateTodayChars,
  calculateStreak,
  getTodayString,
  updateActiveDates,
} from '../services/writingStatsService'

// ============================================
// Types
// ============================================

export interface Attachment {
  name: string
  type: string
  size: number
  content: string
}

export interface ChatMessageLocal {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  editedAt?: number
  entities?: ExtractedEntityLocal[]
  pending?: boolean
  failed?: boolean
  rating?: 'up' | 'down'
  attachments?: Attachment[]
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
  errorCode: string | null
  lastError: ApiError | null
  extractionState: EntityExtractionState
  extractionProgress: number
  messageCache: MessageCache
  lastActiveSessionId: number | null
  pendingInput: string
  // Writing stats and goals
  writingStats: WritingStats
  writingGoal: WritingGoal
  activeDates: string[]
  // Version snapshots (index only — full data in IndexedDB)
  snapshotIndex: VersionSnapshot[]
  // Branch conversation
  branches: Record<string, ChatMessageLocal[]>
  activeBranchId: string | null
  // US-004: Auto-advance counter — increments on each sendMessage call.
  // When turnCount reaches the threshold (default 3), the chat interface
  // auto-switches to the settings editor via the cross-store reference.
  turnCount: number
}

interface ChatActions {
  createSession: () => Promise<void>
  loadSessions: () => Promise<void>
  switchSession: (sessionId: number) => Promise<void>
  clearSession: () => void
  deleteSession: (sessionId: number) => Promise<void>
  renameSession: (sessionId: number, title: string) => Promise<void>
  archiveSession: (sessionId: number) => Promise<void>
  unarchiveSession: (sessionId: number) => Promise<void>
  pinSession: (sessionId: number) => Promise<void>
  unpinSession: (sessionId: number) => Promise<void>
  sendMessage: (content: string, options?: { currentCategory?: string; attachments?: Attachment[] }) => Promise<void>
  loadMessages: () => Promise<void>
  editMessage: (id: string, newContent: string) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
  retryMessage: (id: string) => Promise<void>
  regenerateMessage: (id: string) => Promise<void>
  rateMessage: (id: string, rating: 'up' | 'down') => Promise<void>
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
  exportToOutline: () => { title: string; entries: { type: ExtractedEntityLocal['type'] | 'plot_point'; name: string; description?: string }[] }
  clearMessageCache: () => void
  getCachedMessages: (sessionId: number) => ChatMessageLocal[] | undefined
  setPendingInput: (text: string) => void
  // US-007: chat → 6 entity migration
  migrateChatToSettings: (
    sessionId: number,
    projectId: number,
    targetCategories: ExtractedEntityLocal['type'][],
  ) => Promise<MigrateToSettingsResult>
  // Writing stats actions
  updateWritingStats: () => void
  setDailyGoal: (target: number) => void
  calculateAndUpdateStreak: () => void
  // Version snapshot actions
  createSnapshotAction: () => void
  loadSnapshots: () => Promise<void>
  rollbackSnapshot: (snapshotId: string) => Promise<void>
  diffSnapshotsAction: (oldId: string, newId: string) => EntityDiffItem[]
  // Branch conversation actions
  createBranch: (sourceMessageId: string) => void
  switchBranch: (branchId: string | null) => void
  deleteBranch: (branchId: string) => void
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
  } catch {
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
          errorCode: null,
          lastError: null,
          extractionState: 'idle',
          extractionProgress: 0,
          messageCache: { messages: {}, cachedAt: {} },
          lastActiveSessionId: null,
  pendingInput: '',
          // Writing stats initial state
          writingStats: {
            totalChars: 0,
            todayChars: 0,
            sessionChars: 0,
            avgMessageChars: 0,
            streakDays: 0,
          },
          writingGoal: {
            dailyTarget: 2000,
            currentProgress: 0,
            lastActiveDate: '',
          },
          activeDates: [],
          snapshotIndex: [],
          branches: {},
          activeBranchId: null,
          turnCount: 0,

          createSession: async () => {
            set((state) => {
              state.isLoading = true
              state.error = null
              state.errorCode = null
              state.lastError = null
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
              showSuccess('会话创建成功')
            } catch (error) {
              const apiErr = error as ApiError
              set((state) => {
                state.error = apiErr.message || '创建会话失败'
                state.errorCode = apiErr.code || 'UNKNOWN_ERROR'
                state.lastError = apiErr
                state.isLoading = false
              })
              showApiError(error, '创建会话失败')
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
                rating: m.rating as 'up' | 'down' | undefined,
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

          renameSession: async (sessionId, title) => {
            try {
              const updated = await sessionApi.update(sessionId, { title })
              set((state) => {
                const idx = state.sessions.findIndex((s) => s.id === sessionId)
                if (idx !== -1) {
                  state.sessions[idx].title = updated.title
                }
              })
            } catch (error) {
              set((state) => { state.error = (error as Error).message })
            }
          },

          archiveSession: async (sessionId) => {
            try {
              await sessionApi.update(sessionId, { archived: true })
              set((state) => {
                const idx = state.sessions.findIndex((s) => s.id === sessionId)
                if (idx !== -1) {
                  state.sessions[idx].archived = true
                }
              })
            } catch (error) {
              set((state) => { state.error = (error as Error).message })
            }
          },

          unarchiveSession: async (sessionId) => {
            try {
              await sessionApi.update(sessionId, { archived: false })
              set((state) => {
                const idx = state.sessions.findIndex((s) => s.id === sessionId)
                if (idx !== -1) {
                  state.sessions[idx].archived = false
                }
              })
            } catch (error) {
              set((state) => { state.error = (error as Error).message })
            }
          },

          pinSession: async (sessionId) => {
            try {
              await sessionApi.update(sessionId, { pinned: true })
              set((state) => {
                const idx = state.sessions.findIndex((s) => s.id === sessionId)
                if (idx !== -1) {
                  state.sessions[idx].pinned = true
                }
              })
            } catch (error) {
              set((state) => { state.error = (error as Error).message })
            }
          },

          unpinSession: async (sessionId) => {
            try {
              await sessionApi.update(sessionId, { pinned: false })
              set((state) => {
                const idx = state.sessions.findIndex((s) => s.id === sessionId)
                if (idx !== -1) {
                  state.sessions[idx].pinned = false
                }
              })
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
                attachments: options.attachments,
              })
              state.isStreaming = true
              state.currentStreamContent = ''
              state.error = null
            })

            // US-004: Increment turn counter and auto-advance to settings
            // when threshold is reached. Cross-store via useUIStore.getState()
            // matches the pattern used in uiStore.ts cleanupUIStore().
            set((state) => {
              state.turnCount = (state.turnCount ?? 0) + 1
            })
            if (get().turnCount >= 3) {
              useUIStore.getState().setCurrentInterface('settings')
            }

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

              // Parse #entity tags from message content and attach matched entities
              const entityTagRegex = /#([一-龥a-zA-Z0-9_]+)/g
              let tagMatch: RegExpExecArray | null
              while ((tagMatch = entityTagRegex.exec(content)) !== null) {
                const tagName = tagMatch[1]
                const matchedEntity = extractedEntities.find((e) => e.name === tagName)
                if (matchedEntity) {
                  const mentionKey = `mention_${matchedEntity.type}_${matchedEntity.name}`
                  collectedSettings[mentionKey] = matchedEntity.description || matchedEntity.name
                }
              }

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

              // Async update writing stats (non-blocking)
              if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => {
                  get().updateWritingStats()
                  get().calculateAndUpdateStreak()
                })
              } else {
                setTimeout(() => {
                  get().updateWritingStats()
                  get().calculateAndUpdateStreak()
                }, 0)
              }
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

          regenerateMessage: async (id) => {
            const { messages } = get()
            const msgIndex = messages.findIndex((m) => m.id === id)
            if (msgIndex === -1 || messages[msgIndex].role !== 'assistant') return

            // Find the preceding user message
            let userContent: string | null = null
            for (let i = msgIndex - 1; i >= 0; i--) {
              if (messages[i].role === 'user') {
                userContent = messages[i].content
                break
              }
            }
            if (!userContent) return

            // Remove the assistant message and resend
            set((state) => {
              state.messages = state.messages.filter((m) => m.id !== id)
            })
            await get().sendMessage(userContent)
          },

          rateMessage: async (id, rating) => {
            const { messages } = get()
            const msg = messages.find((m) => m.id === id)
            if (!msg || msg.role !== 'assistant') return

            // Toggle: if same rating, clear it
            const newRating = msg.rating === rating ? undefined : rating

            // Update local state immediately
            set((state) => {
              const m = state.messages.find((x) => x.id === id)
              if (m) m.rating = newRating
            })

            // Persist to backend (only for messages with numeric IDs from server)
            const numericId = Number(id)
            if (!isNaN(numericId)) {
              try {
                await messageApi.rate(numericId, newRating ?? null)
              } catch (error) {
                set((state) => {
                  state.error = (error as Error).message
                })
              }
            }
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
                rating: m.rating as 'up' | 'down' | undefined,
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

          editMessage: async (id, newContent) => {
            // Update local state immediately
            set((state) => {
              const msg = state.messages.find((m) => m.id === id)
              if (msg) {
                msg.content = newContent
                msg.editedAt = Date.now()
              }
            })
            // Persist to backend (only for messages with numeric IDs from server)
            const numericId = Number(id)
            if (!isNaN(numericId)) {
              try {
                await messageApi.edit(numericId, newContent)
              } catch (error) {
                set((state) => {
                  state.error = (error as Error).message
                })
              }
            }
          },

          deleteMessage: async (id) => {
            // Update local state immediately
            set((state) => {
              state.messages = state.messages.filter((m) => m.id !== id)
              state.extractedEntities = state.extractedEntities.filter(
                (e) => e.sourceMessageId !== id
              )
            })
            // Persist to backend (only for messages with numeric IDs from server)
            const numericId = Number(id)
            if (!isNaN(numericId)) {
              try {
                await messageApi.delete(numericId)
              } catch (error) {
                set((state) => {
                  state.error = (error as Error).message
                })
              }
            }
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
              await entityApi.confirm(id, true)
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
                ids.map((id) => entityApi.confirm(id, true))
              )
              set((state) => {
                ids.forEach((id) => {
                  const entity = state.extractedEntities.find((e) => e.id === id)
                  if (entity) entity.confirmed = true
                })
                state.extractionState = 'completed'
                state.extractionProgress = 100
              })
              // Trigger async snapshot after batch confirm
              get().createSnapshotAction()
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
            const validTypes = new Set<ExtractedEntityLocal['type']>(['world', 'character', 'item', 'location', 'faction', 'rule', 'ifline'])
            const existingNames = new Set(get().extractedEntities.map((e) => e.name))
            const foundEntities: ExtractedEntityLocal[] = []
            try {
              const { entities } = await aiReviewApi.extractEntities([{ role: message.role, content: message.content }])
              for (const e of entities) {
                if (e.name && !existingNames.has(e.name) && validTypes.has(e.type as ExtractedEntityLocal['type'])) {
                  existingNames.add(e.name)
                  foundEntities.push({
                    id: genEntityId(),
                    type: e.type as ExtractedEntityLocal['type'],
                    name: e.name,
                    description: e.description,
                    confirmed: false,
                    sourceMessageId: messageId,
                  })
                }
              }
            } catch (extractError) {
              showOperationError('实体提取', extractError)
            }
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
                type: 'plot_point' as const,
                name: `情节要点 ${i + 1}`,
                description: content.slice(0, 100),
              })),
            ]
            const title = plotPoints[0]?.slice(0, 20) || '未命名故事'
            // Trigger async snapshot after outline export
            get().createSnapshotAction()
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

          setPendingInput: (text) => {
            set((state) => {
              state.pendingInput = text
            })
          },

          // US-007: migrate a finished chat session into project settings.
          migrateChatToSettings: async (sessionId, projectId, targetCategories) => {
            set((state) => {
              state.extractionState = 'confirming'
              state.extractionProgress = 0
              state.error = null
            })
            try {
              const result = await migrateChatToSettingsApi(
                sessionId,
                projectId,
                targetCategories,
              )
              set((state) => {
                if (result.created && result.created.length > 0) {
                  const confirmedNames = new Set(
                    state.extractedEntities.map((e) => e.name),
                  )
                  for (const row of result.created) {
                    if (!confirmedNames.has(row.name)) {
                      state.extractedEntities.push({
                        id: genEntityId(),
                        type: row.type as ExtractedEntityLocal['type'],
                        name: row.name,
                        confirmed: true,
                      })
                      confirmedNames.add(row.name)
                    }
                  }
                }
                state.extractionState = 'completed'
                state.extractionProgress = 100
              })
              const createdCount = result.created?.length ?? 0
              const skippedCount = result.skipped?.length ?? 0
              const errorCount = result.errors?.length ?? 0
              const summary = `迁移完成：新建 ${createdCount}，跳过 ${skippedCount}，失败 ${errorCount}`
              if (result.partial || errorCount > 0) {
                showOperationError('迁移对话到设定', new Error(summary))
              } else if (createdCount > 0) {
                showSuccess(summary)
              }
              return result
            } catch (error) {
              const apiError = error as ApiError
              set((state) => {
                state.error = apiError?.message ?? 'migrate failed'
                state.extractionState = 'error'
                state.extractionProgress = 0
              })
              showOperationError('迁移对话到设定', error)
              throw error
            }
          },

          // ============================================
          // Writing Stats Actions
          // ============================================

          updateWritingStats: () => {
            const { messages, activeDates } = get()
            const totalChars = calculateTotalChars(messages)
            const todayChars = calculateTodayChars(messages)
            const avgMessageChars = messages.length > 0 ? Math.round(totalChars / messages.length) : 0
            const streakDays = calculateStreak(activeDates)

            set((state) => {
              state.writingStats = {
                totalChars,
                todayChars,
                sessionChars: totalChars,
                avgMessageChars,
                streakDays,
              }
              state.writingGoal.currentProgress = todayChars
            })
          },

          setDailyGoal: (target) => {
            set((state) => {
              state.writingGoal.dailyTarget = Math.max(0, target)
            })
          },

          calculateAndUpdateStreak: () => {
            const { activeDates, writingGoal } = get()
            const today = getTodayString()

            if (writingGoal.lastActiveDate !== today) {
              const newActiveDates = updateActiveDates(activeDates, today)
              const streakDays = calculateStreak(newActiveDates)
              set((state) => {
                state.activeDates = newActiveDates
                state.writingStats.streakDays = streakDays
                state.writingGoal.lastActiveDate = today
              })
            }
          },

          // ============================================
          // Version Snapshot Actions
          // ============================================

          createSnapshotAction: () => {
            const { sessionId, extractedEntities, messages } = get()
            if (!sessionId) return
            // Async via setTimeout(0) to not block
            setTimeout(async () => {
              try {
                const snap = await createSnapshot(sessionId, extractedEntities, messages.length)
                set((state) => {
                  state.snapshotIndex.push(snap)
                })
              } catch {
                // silent fail for snapshots
              }
            }, 0)
          },

          loadSnapshots: async () => {
            const { sessionId } = get()
            if (!sessionId) return
            try {
              const snapshots = await listSnapshots(sessionId)
              set((state) => {
                state.snapshotIndex = snapshots
              })
            } catch {
              // silent
            }
          },

          rollbackSnapshot: async (snapshotId) => {
            const { sessionId } = get()
            if (!sessionId) return
            try {
              const entities = await rollbackToSnapshot(sessionId, snapshotId)
              if (entities) {
                set((state) => {
                  state.extractedEntities = entities
                })
              }
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
              })
            }
          },

          diffSnapshotsAction: (oldId, newId) => {
            const { snapshotIndex } = get()
            const oldSnap = snapshotIndex.find((s) => s.id === oldId)
            const newSnap = snapshotIndex.find((s) => s.id === newId)
            if (!oldSnap || !newSnap) return []
            return diffSnapshotService(oldSnap.entities, newSnap.entities)
          },

          // ============================================
          // Branch Conversation Actions
          // ============================================

          createBranch: (sourceMessageId) => {
            const { messages, activeBranchId } = get()
            // Use the current message list (main or active branch)
            const currentMessages = activeBranchId
              ? get().branches[activeBranchId] ?? messages
              : messages
            const sourceIndex = currentMessages.findIndex((m) => m.id === sourceMessageId)
            if (sourceIndex === -1) return

            const branchId = `branch-${sourceMessageId}-${Date.now()}`
            const branchMessages = currentMessages.slice(sourceIndex).map((m) => ({
              ...m,
              id: `${branchId}-${m.id}`,
            }))

            set((state) => {
              state.branches[branchId] = branchMessages
              state.activeBranchId = branchId
              state.messages = branchMessages
            })
          },

          switchBranch: (branchId) => {
            set((state) => {
              if (branchId === null) {
                // Switch back to main branch — reload from cache or clear
                state.activeBranchId = null
                const cached = state.sessionId !== null
                  ? state.messageCache.messages[state.sessionId]
                  : undefined
                state.messages = cached ?? []
              } else {
                const branch = state.branches[branchId]
                if (branch) {
                  state.activeBranchId = branchId
                  state.messages = branch
                }
              }
            })
          },

          deleteBranch: (branchId) => {
            set((state) => {
              delete state.branches[branchId]
              if (state.activeBranchId === branchId) {
                state.activeBranchId = null
                const cached = state.sessionId !== null
                  ? state.messageCache.messages[state.sessionId]
                  : undefined
                state.messages = cached ?? []
              }
            })
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
            writingGoal: state.writingGoal,
            activeDates: state.activeDates,
            branches: state.branches,
            activeBranchId: state.activeBranchId,
          }),
          version: 3,
          migrate: (persistedState: any, version: number) => {
            if (version === 2) {
              // Migrate from v2 to v3: add writing stats fields
              return {
                ...persistedState,
                writingGoal: {
                  dailyTarget: 2000,
                  currentProgress: 0,
                  lastActiveDate: '',
                },
                activeDates: [],
              }
            }
            return persistedState
          },
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

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { messageApi } from '../api/chat'
import { showOperationError } from '../utils/toastHelper'
import type { ChatMessageLocal, MessageCache } from './chatStore'
import { createHybridStorage } from './utils/indexedDBStorage'

// Re-export types for external usage
export type { ChatMessageLocal, MessageCache }

// ============================================
// Types
// ============================================

interface MessageState {
  messages: ChatMessageLocal[]
  isStreaming: boolean
  currentStreamContent: string
  streamAbortController: AbortController | null
  isLoading: boolean
  error: string | null
  messageCache: MessageCache
}

interface MessageActions {
  sendMessage: (sessionId: number, content: string) => Promise<void>
  loadMessages: (sessionId: number) => Promise<void>
  editMessage: (id: string, newContent: string) => void
  deleteMessage: (id: string) => void
  retryMessage: (id: string, sendFn: (content: string) => Promise<void>) => Promise<void>
  updateStreamingContent: (content: string) => void
  finishStreaming: () => ChatMessageLocal | null
  abortStreaming: () => void
  setMessages: (messages: ChatMessageLocal[]) => void
  addMessage: (message: ChatMessageLocal) => void
  clearMessageCache: () => void
  getCachedMessages: (sessionId: number) => ChatMessageLocal[] | undefined
  updateCacheForSession: (sessionId: number, messages: ChatMessageLocal[]) => void
}

// ============================================
// ID Generator
// ============================================

let messageIdCounter = 0

if (typeof window !== 'undefined') {
  const stored = sessionStorage.getItem('chat-message-counter')
  if (stored) messageIdCounter = parseInt(stored, 10)
}

const genMessageId = () => {
  const id = `msg-${Date.now()}-${++messageIdCounter}`
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('chat-message-counter', String(messageIdCounter))
  }
  return id
}

// ============================================
// Cache Helpers
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

export const useMessageStore = create<MessageState & MessageActions>()(
  immer(
    subscribeWithSelector(
      (set, get) => ({
        messages: [],
        isStreaming: false,
        currentStreamContent: '',
        streamAbortController: null,
        isLoading: false,
        error: null,
        messageCache: { messages: {}, cachedAt: {} },

        sendMessage: async (sessionId, content) => {
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
              state.messageCache.messages[sessionId] = state.messages
              state.messageCache.cachedAt[sessionId] = Date.now()
            })
            saveCacheToStorage(get().messageCache)
          } catch (error) {
            set((state) => {
              const msg = state.messages.find((m) => m.id === userMessageId)
              if (msg) msg.failed = true
              state.error = (error as Error).message
              state.isStreaming = false
              state.currentStreamContent = ''
              state.streamAbortController = null
            })
            showOperationError('发送消息', error)
          }
        },

        loadMessages: async (sessionId) => {
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
            showOperationError('加载消息列表', error)
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
          })
        },

        retryMessage: async (id, sendFn) => {
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

          await sendFn(msg.content)
        },

        updateStreamingContent: (content) => {
          set((state) => { state.currentStreamContent = content })
        },

        finishStreaming: () => {
          const { currentStreamContent } = get()
          if (!currentStreamContent) return null

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
          })
          return newMessage
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

        setMessages: (messages) => {
          set((state) => { state.messages = messages })
        },

        addMessage: (message) => {
          set((state) => { state.messages.push(message) })
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

        updateCacheForSession: (sessionId, messages) => {
          set((state) => {
            state.messageCache.messages[sessionId] = messages
            state.messageCache.cachedAt[sessionId] = Date.now()
          })
          saveCacheToStorage(get().messageCache)
        },
      })
    )
  )
)

// ============================================
// Selectors
// ============================================

export const selectMessageCount = (state: MessageState) => state.messages.length

export const selectIsEmptySession = (state: MessageState) => state.messages.length === 0

export const selectUserMessages = (state: MessageState) =>
  state.messages.filter((m) => m.role === 'user')

export const selectAssistantMessages = (state: MessageState) =>
  state.messages.filter((m) => m.role === 'assistant')
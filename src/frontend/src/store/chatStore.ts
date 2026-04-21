import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sessionApi, messageApi, entityApi } from '../api/chat'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export interface ExtractedEntity {
  id: string
  type: 'world' | 'character' | 'item' | 'location' | 'faction' | 'rule' | 'ifline'
  name: string
  description?: string
  confirmed: boolean
}

interface ChatState {
  sessionId: number | null
  messages: ChatMessage[]
  extractedEntities: ExtractedEntity[]
  isStreaming: boolean
  currentStreamContent: string
  isLoading: boolean
  error: string | null
}

interface ChatActions {
  createSession: () => Promise<void>
  clearSession: () => void
  loadSessions: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  loadMessages: () => Promise<void>
  updateStreamingContent: (content: string) => void
  finishStreaming: () => void
  loadExtractedEntities: () => Promise<void>
  addExtractedEntity: (entity: Omit<ExtractedEntity, 'id'>) => void
  updateExtractedEntity: (id: string, updates: Partial<ExtractedEntity>) => void
  removeExtractedEntity: (id: string) => void
  confirmEntity: (id: string) => Promise<void>
}

// Id counters persisted in session storage to avoid collisions on refresh
let messageIdCounter = 0
let entityIdCounter = 0

if (typeof window !== 'undefined') {
  const stored = sessionStorage.getItem('chat-message-counter')
  if (stored) messageIdCounter = parseInt(stored, 10)
}

export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    (set, get) => ({
    sessionId: null,
    messages: [],
    extractedEntities: [],
    isStreaming: false,
    currentStreamContent: '',
    isLoading: false,
    error: null,

    createSession: async () => {
      set({ isLoading: true, error: null })
      try {
        const session = await sessionApi.create()
        set({ sessionId: session.id, messages: [], extractedEntities: [], isLoading: false })
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false })
      }
    },

    clearSession: () => set({ sessionId: null, messages: [], extractedEntities: [] }),

    loadSessions: async () => {
      set({ isLoading: true, error: null })
      try {
        await sessionApi.list()
        set({ isLoading: false })
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false })
      }
    },

    sendMessage: async (content: string) => {
      const { sessionId } = get()
      if (!sessionId) return

      const userMessage: ChatMessage = {
        id: `msg-${++messageIdCounter}`,
        role: 'user',
        content,
        createdAt: Date.now(),
      }
      set((state) => ({ messages: [...state.messages, userMessage], isStreaming: true, error: null }))

      try {
        const { stream } = await messageApi.send(sessionId, content)

        const reader = stream.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        set({ currentStreamContent: '' })

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          set({ currentStreamContent: buffer })
        }

        const assistantMessage: ChatMessage = {
          id: `msg-${++messageIdCounter}`,
          role: 'assistant',
          content: buffer,
          createdAt: Date.now(),
        }
        set((state) => ({
          messages: [...state.messages, assistantMessage],
          currentStreamContent: '',
          isStreaming: false,
        }))
      } catch (error) {
        set({ error: (error as Error).message, isStreaming: false, currentStreamContent: '' })
      }
    },

    loadMessages: async () => {
      const { sessionId } = get()
      if (!sessionId) return

      set({ isLoading: true, error: null })
      try {
        const backendMessages = await messageApi.list(sessionId)
        const messages: ChatMessage[] = backendMessages.map((m) => ({
          id: String(m.id),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          createdAt: new Date(m.created_at).getTime(),
        }))
        set({ messages, isLoading: false })
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false })
      }
    },

    updateStreamingContent: (content) => set({ currentStreamContent: content }),

    finishStreaming: () => {
      const { currentStreamContent, messages } = get()
      if (currentStreamContent) {
        const newMessage: ChatMessage = {
          id: `msg-${++messageIdCounter}`,
          role: 'assistant',
          content: currentStreamContent,
          createdAt: Date.now(),
        }
        set({ messages: [...messages, newMessage], currentStreamContent: '', isStreaming: false })
      }
    },

    loadExtractedEntities: async () => {
      const { sessionId } = get()
      if (!sessionId) return

      set({ isLoading: true, error: null })
      try {
        const entities = await entityApi.getExtracted(sessionId)
        const extractedEntities: ExtractedEntity[] = entities.map((e) => ({
          id: String(e.id),
          type: e.type as ExtractedEntity['type'],
          name: e.name,
          description: e.description,
          confirmed: Boolean(e.confirmed),
        }))
        set({ extractedEntities, isLoading: false })
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false })
      }
    },

    addExtractedEntity: (entity) => {
      const newEntity: ExtractedEntity = {
        ...entity,
        id: `entity-${++entityIdCounter}`,
      }
      set((state) => ({ extractedEntities: [...state.extractedEntities, newEntity] }))
    },

    updateExtractedEntity: (id, updates) =>
      set((state) => ({
        extractedEntities: state.extractedEntities.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      })),

    removeExtractedEntity: (id) =>
      set((state) => ({
        extractedEntities: state.extractedEntities.filter((e) => e.id !== id),
      })),

    confirmEntity: async (id: string) => {
      const { sessionId } = get()
      if (!sessionId) return

      try {
        await entityApi.confirm(sessionId, Number(id))
        set((state) => ({
          extractedEntities: state.extractedEntities.map((e) =>
            e.id === id ? { ...e, confirmed: true } : e
          ),
        }))
      } catch (error) {
        set({ error: (error as Error).message })
      }
    },
  }),
    {
      name: 'writer-chat-store',
      partialize: (state) => ({
        sessionId: state.sessionId,
        // Don't persist messages - too large, reload from backend
      }),
    }
  )
)

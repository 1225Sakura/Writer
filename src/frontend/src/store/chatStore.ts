import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sessionApi, messageApi, entityApi } from '../api/chat'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  editedAt?: number
  entities?: ExtractedEntity[]
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
  // Message editing
  editMessage: (id: string, newContent: string) => void
  deleteMessage: (id: string) => void
  // Entity extraction visualization
  extractEntitiesFromMessage: (messageId: string) => void
  // Export to outline
  exportToOutline: () => { title: string; entries: { type: string; name: string; description?: string }[] }
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

    editMessage: (id: string, newContent: string) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === id ? { ...m, content: newContent, editedAt: Date.now() } : m
        ),
      }))
    },

    deleteMessage: (id: string) => {
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== id),
      }))
    },

    extractEntitiesFromMessage: (messageId: string) => {
      const { messages, extractedEntities } = get()
      const message = messages.find((m) => m.id === messageId)
      if (!message) return

      // Simple heuristic extraction - in production this would call an API
      const entityPatterns: { type: ExtractedEntity['type']; regex: RegExp }[] = [
        { type: 'character', regex: /[\"']([^\"']+?)[\"'](?:\s*[，,]\s*.*?角色|.*?主角|.*?人物)/g },
        { type: 'location', regex: /([\u4e00-\u9fa5]{2,}(?:大陆|城|国|岛|山|森林|海))/g },
        { type: 'faction', regex: /([\u4e00-\u9fa5]{2,}(?:门|派|宗|教|盟|会|族))/g },
        { type: 'item', regex: /([\u4e00-\u9fa5]{2,}(?:剑|刀|法宝|秘籍|丹药))/g },
      ]

      const foundEntities: ExtractedEntity[] = []
      entityPatterns.forEach(({ type, regex }) => {
        let match
        while ((match = regex.exec(message.content)) !== null) {
          const name = match[1]
          if (name && !extractedEntities.some((e) => e.name === name)) {
            foundEntities.push({
              id: `entity-${++entityIdCounter}`,
              type,
              name,
              description: `从对话中提取的${type === 'character' ? '角色' : type === 'location' ? '地点' : type === 'faction' ? '势力' : '物品'}`,
              confirmed: false,
            })
          }
        }
      })

      if (foundEntities.length > 0) {
        set((state) => ({
          extractedEntities: [...state.extractedEntities, ...foundEntities],
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, entities: foundEntities } : m
          ),
        }))
      }
    },

    exportToOutline: () => {
      const { messages, extractedEntities } = get()
      const confirmedEntities = extractedEntities.filter((e) => e.confirmed)

      // Extract key plot points from user messages
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

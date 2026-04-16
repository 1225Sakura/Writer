import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  // 聊天会话
  sessionId: string | null
  messages: ChatMessage[]
  extractedEntities: ExtractedEntity[]
  // 状态
  isStreaming: boolean
  currentStreamContent: string
}

interface ChatActions {
  // 会话管理
  createSession: () => void
  clearSession: () => void
  // 消息管理
  addMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'>) => void
  updateStreamingContent: (content: string) => void
  finishStreaming: () => void
  // 实体管理
  addExtractedEntity: (entity: Omit<ExtractedEntity, 'id'>) => void
  updateExtractedEntity: (id: string, updates: Partial<ExtractedEntity>) => void
  removeExtractedEntity: (id: string) => void
  confirmEntity: (id: string) => void
}

let messageIdCounter = 0
let entityIdCounter = 0

export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    (set, get) => ({
      // 初始状态
      sessionId: null,
      messages: [],
      extractedEntities: [],
      isStreaming: false,
      currentStreamContent: '',

      // 会话管理
      createSession: () => {
        const sessionId = `session-${Date.now()}`
        set({ sessionId, messages: [], extractedEntities: [] })
      },
      clearSession: () => set({ sessionId: null, messages: [], extractedEntities: [] }),

      // 消息管理
      addMessage: (message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: `msg-${++messageIdCounter}`,
          createdAt: Date.now(),
        }
        set((state) => ({ messages: [...state.messages, newMessage] }))
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

      // 实体管理
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
      confirmEntity: (id) =>
        set((state) => ({
          extractedEntities: state.extractedEntities.map((e) =>
            e.id === id ? { ...e, confirmed: true } : e
          ),
        })),
    }),
    {
      name: 'writer-chat-store',
    }
  )
)

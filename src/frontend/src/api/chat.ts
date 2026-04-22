import type {
  ChatSession,
  ChatMessage,
  ExtractedEntity,
  ChatSendRequest,
  ChatSendResponse,
  SessionSummaryResponse,
  EntityFilters,
  PaginationParams,
} from "./types"
import { api, apiClient } from "./request"

// ============================================
// Chat Sessions
// ============================================

export const sessionApi = {
  /** Create a new chat session for collecting novel settings. */
  create: async (): Promise<ChatSession> => {
    return api.post<ChatSession>("/chat/sessions")
  },

  /** List all chat sessions with pagination. */
  list: async (params: PaginationParams = {}): Promise<ChatSession[]> => {
    const { skip = 0, limit = 50 } = params
    return api.get<ChatSession[]>("/chat/sessions", { skip, limit })
  },

  /** Get a specific chat session by ID. */
  get: async (sessionId: number): Promise<ChatSession> => {
    return api.get<ChatSession>(`/chat/sessions/${sessionId}`)
  },

  /** Delete a chat session and all its messages. */
  delete: async (sessionId: number): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/chat/sessions/${sessionId}`)
  },

  /** Get a text summary of all collected settings from a session. */
  getSummary: async (sessionId: number): Promise<SessionSummaryResponse> => {
    return api.get<SessionSummaryResponse>(`/chat/sessions/${sessionId}/summary`)
  },
}

// ============================================
// Chat Messages
// ============================================

export const messageApi = {
  /**
   * Send a user message and get an AI-generated reply.
   * This is the primary chat endpoint that drives the setting collection process.
   */
  send: async (
    sessionId: number,
    data: ChatSendRequest
  ): Promise<ChatSendResponse> => {
    return api.post<ChatSendResponse>(`/chat/sessions/${sessionId}/send`, data)
  },

  /**
   * Add a raw message to a chat session (stores without AI reply).
   * For AI auto-reply, use the `send` method instead.
   */
  create: async (
    sessionId: number,
    data: { role: "user" | "assistant" | "system"; content: string }
  ): Promise<ChatMessage> => {
    return api.post<ChatMessage>(`/chat/sessions/${sessionId}/messages`, data)
  },

  /** Get all messages for a chat session. */
  list: async (
    sessionId: number,
    params: PaginationParams = {}
  ): Promise<ChatMessage[]> => {
    const { skip = 0, limit = 100 } = params
    return api.get<ChatMessage[]>(
      `/chat/sessions/${sessionId}/messages`,
      { skip, limit }
    )
  },
}

// ============================================
// Extracted Entities
// ============================================

export const entityApi = {
  /** Get extracted entities from a chat session. */
  list: async (
    sessionId: number,
    filters?: EntityFilters
  ): Promise<ExtractedEntity[]> => {
    return api.get<ExtractedEntity[]>(
      `/chat/sessions/${sessionId}/entities`,
      filters as Record<string, unknown> || {}
    )
  },

  /** Confirm or unconfirm an extracted entity. */
  confirm: async (
    entityId: number,
    confirmed: boolean = true
  ): Promise<{ message: string }> => {
    return api.patch<{ message: string }>(
      `/chat/entities/${entityId}/confirm`,
      { confirmed }
    )
  },
}

// ============================================
// Streaming helpers
// ============================================

export interface StreamCallbacks {
  onChunk?: (text: string) => void
  onDone?: () => void
  onError?: (error: Error) => void
}

/**
 * Read a streaming response and yield decoded text chunks.
 */
export async function* streamReader(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      yield buffer
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Consume a streaming response with callbacks.
 */
export async function consumeStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: StreamCallbacks = {}
): Promise<string> {
  const { onChunk, onDone, onError } = callbacks
  let fullText = ""

  try {
    for await (const chunk of streamReader(stream)) {
      fullText = chunk
      onChunk?.(chunk)
    }
    onDone?.()
    return fullText
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    onError?.(err)
    throw err
  }
}

// ============================================
// Legacy streaming helper (kept for backwards compatibility)
// ============================================

export async function* streamChat(
  stream: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void
): AsyncGenerator<string> {
  for await (const chunk of streamReader(stream)) {
    onChunk(chunk)
    yield chunk
  }
}

// Export all chat APIs
export default {
  session: sessionApi,
  message: messageApi,
  entity: entityApi,
  streamReader,
  consumeStream,
  streamChat,
}

// Alias for convenience
export const chatApi = {
  session: sessionApi,
  message: messageApi,
  entity: entityApi,
  streamReader,
  consumeStream,
  streamChat,
}

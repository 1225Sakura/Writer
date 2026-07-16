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
import { api } from "./request"

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

  /** Update a chat session (title, archived, pinned, etc). */
  update: async (sessionId: number, data: { title?: string; archived?: boolean; pinned?: boolean }): Promise<ChatSession> => {
    return api.patch<ChatSession>(`/chat/sessions/${sessionId}`, data)
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
    data: ChatSendRequest,
    options?: { signal?: AbortSignal }
  ): Promise<ChatSendResponse> => {
    return api.post<ChatSendResponse>(`/chat/sessions/${sessionId}/send`, data, options)
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

  /** Update a message's content. */
  edit: async (
    messageId: number,
    content: string
  ): Promise<ChatMessage> => {
    return api.patch<ChatMessage>(`/chat/messages/${messageId}`, { content })
  },

  /** Delete a message. */
  delete: async (messageId: number): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/chat/messages/${messageId}`)
  },

  /** Rate a message (up, down, or null to clear). */
  rate: async (
    messageId: number,
    rating: 'up' | 'down' | null
  ): Promise<ChatMessage> => {
    return api.patch<ChatMessage>(`/chat/messages/${messageId}/rating`, { rating })
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
    entityId: string,
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
  onProgress?: (percent: number) => void
  onDone?: () => void
  onError?: (error: Error) => void
}

/** Parsed SSE event */
interface SSEEvent {
  event: string
  data: string
}

/**
 * Read an SSE streaming response and yield parsed events.
 */
export async function* sseStreamReader(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete events (separated by double newline)
      let eventEnd: number
      while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
        const eventText = buffer.slice(0, eventEnd)
        buffer = buffer.slice(eventEnd + 2)

        const lines = eventText.split('\n')
        let eventName = 'message'
        let data = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7)
          } else if (line.startsWith('data: ')) {
            data = line.slice(6)
          }
        }

        yield { event: eventName, data }
      }
    }

    // Process any remaining data
    if (buffer.trim()) {
      const lines = buffer.split('\n')
      let eventName = 'message'
      let data = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventName = line.slice(7)
        } else if (line.startsWith('data: ')) {
          data = line.slice(6)
        }
      }
      if (data) {
        yield { event: eventName, data }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Consume an SSE streaming response with callbacks.
 * Handles progress events, text chunks, errors, and completion.
 */
export async function consumeStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: StreamCallbacks = {}
): Promise<string> {
  const { onChunk, onProgress, onDone, onError } = callbacks
  let fullText = ''

  try {
    for await (const sseEvent of sseStreamReader(stream)) {
      switch (sseEvent.event) {
        case 'chunk': {
          fullText += sseEvent.data
          onChunk?.(fullText)
          break
        }
        case 'progress': {
          try {
            const parsed = JSON.parse(sseEvent.data)
            if (typeof parsed.percent === 'number') {
              onProgress?.(parsed.percent)
            }
          } catch {
            // Ignore malformed progress events
          }
          break
        }
        case 'done': {
          onDone?.()
          break
        }
        case 'error': {
          try {
            const parsed = JSON.parse(sseEvent.data)
            throw new Error(parsed.message || 'AI generation failed')
          } catch (e) {
            if (e instanceof Error && e.message !== 'AI generation failed') {
              throw e
            }
            throw new Error(sseEvent.data || 'AI generation failed')
          }
        }
      }
    }

    // If no explicit done event, call onDone
    onDone?.()

    // Validate result
    if (!fullText.trim()) {
      throw new Error('AI返回了空内容，请重试')
    }

    return fullText
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    onError?.(err)
    throw err
  }
}

// ============================================
// Legacy streaming helpers (kept for backwards compatibility)
// ============================================

/**
 * Read a streaming response and yield decoded text chunks.
 * @deprecated Use `sseStreamReader` for SSE streams instead.
 */
export async function* streamReader(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      yield decoder.decode(value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
}

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

/**
 * US-007: Migrate chat session into project settings entities.
 *
 * POST /api/v1/chat/sessions/{sessionId}/migrate-to-settings
 */
export interface MigratedEntity {
  type: string
  id: number
  name: string
}

export interface SkippedEntity {
  type: string
  name: string
  reason: string
}

export interface MigrationError {
  type: string
  name: string
  error: string
}

export interface MigrateToSettingsResult {
  created: MigratedEntity[]
  skipped: SkippedEntity[]
  partial: boolean
  errors: MigrationError[]
}

export const migrateChatToSettings = async (
  sessionId: number,
  projectId: number,
  targetCategories: string[],
): Promise<MigrateToSettingsResult> => {
  const data = await api.post<{
    success?: boolean
    data?: MigrateToSettingsResult
  }>(`/chat/sessions/${sessionId}/migrate-to-settings`, {
    projectId,
    targetCategories,
  })
  if (data && typeof data === 'object' && 'data' in data && data.data) {
    return data.data
  }
  return data as unknown as MigrateToSettingsResult
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

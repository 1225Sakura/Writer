import type { ChatSession, ChatMessage, ExtractedEntity } from "./types";
import { apiClient, api } from "./request";

// ============================================
// Chat Sessions
// ============================================

export const sessionApi = {
	create: async (): Promise<ChatSession> => {
		return api.post<ChatSession>("/chat/sessions");
	},

	list: async (skip = 0, limit = 50): Promise<ChatSession[]> => {
		return api.get<ChatSession[]>("/chat/sessions", { skip, limit });
	},

	get: async (sessionId: number): Promise<ChatSession> => {
		return api.get<ChatSession>(`/chat/sessions/${sessionId}`);
	},

	delete: async (sessionId: number): Promise<void> => {
		return api.delete(`/chat/sessions/${sessionId}`);
	},
};

// ============================================
// Chat Messages
// ============================================

export const messageApi = {
	send: async (
		sessionId: number,
		content: string
	): Promise<{ stream: ReadableStream<Uint8Array>; headers: Record<string, string> }> => {
		const response = await apiClient.post(`/chat/sessions/${sessionId}/messages`, null, {
			params: { content },
			responseType: "stream",
		});
		return {
			stream: response.data,
			headers: response.headers as Record<string, string>,
		};
	},

	list: async (sessionId: number, skip = 0, limit = 100): Promise<ChatMessage[]> => {
		return api.get<ChatMessage[]>(
			`/chat/sessions/${sessionId}/messages`,
			{ skip, limit }
		);
	},
};

// ============================================
// Extracted Entities
// ============================================

export const entityApi = {
	getExtracted: async (sessionId: number): Promise<ExtractedEntity[]> => {
		return api.get<ExtractedEntity[]>(
			`/chat/sessions/${sessionId}/entities`
		);
	},

	confirm: async (sessionId: number, entityId: number): Promise<ExtractedEntity> => {
		return api.post<ExtractedEntity>(
			`/chat/sessions/${sessionId}/entities/${entityId}/confirm`
		);
	},
};

// ============================================
// Streaming helpers
// ============================================

export async function* streamChat(
	stream: ReadableStream<Uint8Array>,
	onChunk: (text: string) => void
): AsyncGenerator<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			onChunk(buffer);
			yield buffer;
		}
	} finally {
		reader.releaseLock();
	}
}

// Export all chat APIs
export default {
	session: sessionApi,
	message: messageApi,
	entity: entityApi,
	streamChat,
};

// Alias for convenience
export const chatApi = {
	session: sessionApi,
	message: messageApi,
	entity: entityApi,
	streamChat,
};

import type {
	Outline,
	Chapter,
	DraftVersion,
	IFLine,
	PlotThread,
	AIInspectionResult,
} from "./types";
import { api, apiClient } from "./request";

// ============================================
// Outlines
// ============================================

export const outlineApi = {
	list: async (skip = 0, limit = 50): Promise<Outline[]> => {
		return api.get<Outline[]>("/chapters/outlines", { skip, limit });
	},

	create: async (data: { title: string; description?: string }): Promise<Outline> => {
		return api.post<Outline>("/chapters/outlines", data);
	},

	update: async (
		outlineId: number,
		data: { title?: string; description?: string }
	): Promise<Outline> => {
		return api.patch<Outline>(`/chapters/outlines/${outlineId}`, data);
	},

	delete: async (outlineId: number): Promise<void> => {
		return api.delete(`/chapters/outlines/${outlineId}`);
	},
};

// ============================================
// Chapters
// ============================================

export const chapterApi = {
	list: async (
		skip = 0,
		limit = 100,
		filters?: { outline_id?: number; status?: string }
	): Promise<Chapter[]> => {
		return api.get<Chapter[]>("/chapters/", { skip, limit, ...filters });
	},

	create: async (data: {
		outline_id?: number;
		title?: string;
		summary?: string;
		status?: string;
		word_count?: number;
		chapter_order?: number;
	}): Promise<Chapter> => {
		return api.post<Chapter>("/chapters/", data);
	},

	getById: async (chapterId: number): Promise<Chapter> => {
		return api.get<Chapter>(`/chapters/${chapterId}`);
	},

	update: async (
		chapterId: number,
		data: {
			outline_id?: number;
			title?: string;
			summary?: string;
			status?: string;
			word_count?: number;
			chapter_order?: number;
		}
	): Promise<Chapter> => {
		return api.patch<Chapter>(`/chapters/${chapterId}`, data);
	},

	delete: async (chapterId: number): Promise<void> => {
		return api.delete(`/chapters/${chapterId}`);
	},
};

// ============================================
// Drafts
// ============================================

export const draftApi = {
	list: async (chapterId: number, skip = 0, limit = 20): Promise<DraftVersion[]> => {
		return api.get<DraftVersion[]>(`/chapters/${chapterId}/drafts`, { skip, limit });
	},

	create: async (
		chapterId: number,
		data: { chapter_id: number; content: string; version_number: number }
	): Promise<DraftVersion> => {
		return api.post<DraftVersion>(`/chapters/${chapterId}/drafts`, data);
	},

	getVersion: async (
		chapterId: number,
		versionNumber: number
	): Promise<DraftVersion> => {
		return api.get<DraftVersion>(`/chapters/${chapterId}/drafts/${versionNumber}`);
	},
};

// ============================================
// IF Lines
// ============================================

export const ifLineApi = {
	list: async (
		skip = 0,
		limit = 50,
		characterId?: number
	): Promise<IFLine[]> => {
		return api.get<IFLine[]>("/chapters/if-lines", { skip, limit, character_id: characterId });
	},

	create: async (data: {
		title: string;
		linked_character_id?: number;
		description?: string;
		sync_mode?: string;
	}): Promise<IFLine> => {
		return api.post<IFLine>("/chapters/if-lines", data);
	},

	update: async (
		ifLineId: number,
		data: {
			title?: string;
			linked_character_id?: number;
			description?: string;
			sync_mode?: string;
		}
	): Promise<IFLine> => {
		return api.patch<IFLine>(`/chapters/if-lines/${ifLineId}`, data);
	},

	delete: async (ifLineId: number): Promise<void> => {
		return api.delete(`/chapters/if-lines/${ifLineId}`);
	},
};

// ============================================
// Plot Threads
// ============================================

export const plotThreadApi = {
	list: async (
		skip = 0,
		limit = 100,
		status?: string
	): Promise<PlotThread[]> => {
		return api.get<PlotThread[]>("/chapters/plot-threads", { skip, limit, status });
	},

	create: async (data: {
		title: string;
		description?: string;
		status?: string;
		created_chapter_id?: number;
		reveal_chapter_id?: number;
	}): Promise<PlotThread> => {
		return api.post<PlotThread>("/chapters/plot-threads", data);
	},

	update: async (
		plotThreadId: number,
		data: {
			title?: string;
			description?: string;
			status?: string;
			created_chapter_id?: number;
			reveal_chapter_id?: number;
		}
	): Promise<PlotThread> => {
		return api.patch<PlotThread>(`/chapters/plot-threads/${plotThreadId}`, data);
	},

	delete: async (plotThreadId: number): Promise<void> => {
		return api.delete(`/chapters/plot-threads/${plotThreadId}`);
	},
};

// ============================================
// AI Inspections
// ============================================

export const inspectionApi = {
	list: async (
		chapterId: number,
		skip = 0,
		limit = 20
	): Promise<AIInspectionResult[]> => {
		return api.get<AIInspectionResult[]>(`/chapters/${chapterId}/inspections`, { skip, limit });
	},

	create: async (
		chapterId: number,
		data: {
			inspection_type: string;
			issues_json?: string;
			suggestions_json?: string;
		}
	): Promise<AIInspectionResult> => {
		return api.post<AIInspectionResult>(
			`/chapters/${chapterId}/inspections`,
			{
				inspection_type: data.inspection_type,
				issues_json: data.issues_json,
				suggestions_json: data.suggestions_json,
			}
		);
	},
};

// ============================================
// AI Operations
// ============================================

export type AIOperationType =
	| "continue"
	| "expand"
	| "condense"
	| "rewrite"
	| "polish"
	| "optimize";

export interface AIGenerateRequest {
	prompt: string;
	operation: AIOperationType;
	chapter_id?: number;
	human_ai_ratio?: number;
	style?: string;
}

export interface AIGenerateResponse {
	operation: string;
	"human-ai-ratio": string;
	style: string;
}

export const aiApi = {
	generate: async (
		data: AIGenerateRequest
	): Promise<{ stream: ReadableStream<Uint8Array>; headers: AIGenerateResponse }> => {
		const response = await apiClient.post(`/ai/generate`, data, {
			responseType: "stream",
		});
		return {
			stream: response.data,
			headers: {
				operation: response.headers["x-operation"] as string,
				"human-ai-ratio": response.headers["x-human-ai-ratio"] as string,
				style: response.headers["x-style"] as string,
			},
		};
	},

	optimize: async (
		content: string,
		chapterId?: number,
		humanAiRatio?: number
	): Promise<string> => {
		const response = await aiApi.generate({
			prompt: content,
			operation: "optimize",
			chapter_id: chapterId,
			human_ai_ratio: humanAiRatio,
		});
		return new Response(response.stream).text();
	},

	expand: async (
		content: string,
		chapterId?: number,
		humanAiRatio?: number
	): Promise<string> => {
		const response = await aiApi.generate({
			prompt: content,
			operation: "expand",
			chapter_id: chapterId,
			human_ai_ratio: humanAiRatio,
		});
		return new Response(response.stream).text();
	},

	shrink: async (
		content: string,
		chapterId?: number,
		humanAiRatio?: number
	): Promise<string> => {
		const response = await aiApi.generate({
			prompt: content,
			operation: "condense",
			chapter_id: chapterId,
			human_ai_ratio: humanAiRatio,
		});
		return new Response(response.stream).text();
	},

	rewrite: async (
		content: string,
		chapterId?: number,
		humanAiRatio?: number
	): Promise<string> => {
		const response = await aiApi.generate({
			prompt: content,
			operation: "rewrite",
			chapter_id: chapterId,
			human_ai_ratio: humanAiRatio,
		});
		return new Response(response.stream).text();
	},

	continue: async (
		content: string,
		chapterId?: number,
		humanAiRatio?: number
	): Promise<string> => {
		const response = await aiApi.generate({
			prompt: content,
			operation: "continue",
			chapter_id: chapterId,
			human_ai_ratio: humanAiRatio,
		});
		return new Response(response.stream).text();
	},

	polish: async (
		content: string,
		chapterId?: number,
		humanAiRatio?: number
	): Promise<string> => {
		const response = await aiApi.generate({
			prompt: content,
			operation: "polish",
			chapter_id: chapterId,
			human_ai_ratio: humanAiRatio,
		});
		return new Response(response.stream).text();
	},
};

// Export all APIs
export default {
	outline: outlineApi,
	chapter: chapterApi,
	draft: draftApi,
	ifLine: ifLineApi,
	plotThread: plotThreadApi,
	inspection: inspectionApi,
	ai: aiApi,
};

// ============================================
// Re-export types from shared types module
// ============================================

// Re-export all shared types
export type {
	Character,
	Item,
	Location,
	Faction,
	WorldSetting,
	Rule,
	Outline,
	Chapter,
	IFLine,
	ChatSession,
	ChatMessage,
	ExtractedEntity,
	DraftVersion,
	PlotThread,
	AIInspectionResult,
	WritingSettings,
	ApiResponse,
	PaginatedResponse,
	EntityType,
} from "@/shared/types";

// Re-export with 'Api' suffix to avoid naming conflicts
export type {
	Character as ApiCharacter,
	Chapter as ApiChapter,
	Outline as ApiOutline,
	IFLine as ApiIFLine,
	DraftVersion as ApiDraftVersion,
	PlotThread as ApiPlotThread,
	AIInspectionResult as ApiAIInspectionResult,
	WritingSettings as ApiWritingSettings,
	ChatSession as ApiChatSession,
	ChatMessage as ApiChatMessage,
	ExtractedEntity as ApiExtractedEntity,
	Item as ApiItem,
	Location as ApiLocation,
	Faction as ApiFaction,
	WorldSetting as ApiWorldSetting,
	Rule as ApiRule,
} from "@/shared/types";

// ============================================
// Writing Style Enum
// ============================================

export type WritingStyleType =
	| "default"
	| "jiangnan"
	| "kafka"
	| "camus"
	| "custom";

// ============================================
// API-specific types (not in shared)
// ============================================

export interface CharacterRelationship {
	id: number;
	character_id: number;
	target_id: number;
	type: 'family' | 'friend' | 'enemy' | 'master' | 'disciple' | 'rival' | 'romantic' | 'other';
	description?: string;
}

export interface CharacterStoryline {
	id: number;
	character_id: number;
	title: string;
	arc?: string;
	progress: number;
}

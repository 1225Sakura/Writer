// Core request utilities
export * from "./request"
export * from "./types"

// Auth API
export {
  fetchApiKey,
  refreshApiKey,
  getAuthStatus,
  initAuth,
  getStoredApiKey,
  clearApiKey,
  type AuthStatus,
  type AuthKeyResponse,
} from "./auth"

// Chat API
export {
  chatApi,
  sessionApi,
  messageApi,
  entityApi,
  streamChat,
} from "./chat"
export { default as chatApiDefault } from "./chat"

// Settings API
export {
  characterApi,
  relationshipApi,
  storylineApi,
  itemApi,
  locationApi,
  factionApi,
  worldSettingApi,
  ruleApi,
  outlineApi,
  chapterApi,
  ifLineApi,
  aiGenerateApi,
} from "./settings"

// Writing API
export {
  outlineApi as writingOutlineApi,
  chapterApi as writingChapterApi,
  draftApi,
  ifLineApi as writingIfLineApi,
  plotThreadApi,
  inspectionApi,
  aiApi,
  type AIOperationType,
  type AIGenerateRequest,
  type AIGenerateResponse,
} from "./writing"

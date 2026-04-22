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

// Agents API
export {
  agentsApi,
  analyzeStyle,
  runReview,
  runPlot,
  listCheckers,
  runChecker,
  runAllCheckers,
  type StyleAnalysisRequest,
  type StyleAnalysisResponse,
  type ReviewRequest,
  type ReviewResponse,
  type PlotRequest,
  type PlotResponse,
  type CheckerInfo,
  type CheckerListResponse,
  type CheckerRunRequest,
  type CheckerRunResponse,
  type PipelineRequest,
  type PipelineResponse,
} from "./agents"

// Workflows API
export {
  workflowsApi,
  listWorkflows,
  executeWorkflow,
  getWorkflowStatus,
  listExecutions,
  getExecutionLogs,
  type WorkflowInfo,
  type WorkflowListResponse,
  type ExecuteWorkflowRequest,
  type ExecuteWorkflowResponse,
  type WorkflowStatusResponse,
  type ExecutionSummary,
  type ExecutionListResponse,
  type AgentLogEntry,
  type ExecutionLogsResponse,
} from "./workflows"

// System API (health, stats, cache, AI provider)
export {
  systemApi,
  getHealth,
  getReadiness,
  getLiveness,
  getProjectStats,
  getPreloadStatus,
  getAIProviderHealth,
  triggerFailover,
  type HealthResponse,
  type ReadinessResponse,
  type LivenessResponse,
  type ProjectStatsResponse,
  type PreloadStatusResponse,
  type AIHealthResponse,
  type FailoverRequest,
  type FailoverResponse,
} from "./system"

// Metrics API
export {
  metricsApi,
  getMetrics,
  getMetricsHistory,
  type MetricsResponse,
  type MetricsHistoryResponse,
  type MetricsSummary,
  type MetricsHistoryPoint,
} from "./metrics"

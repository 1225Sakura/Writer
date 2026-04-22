/**
 * Workflows API - Frontend wrappers for workflow execution endpoints.
 *
 * Covers:
 * - List workflows (/workflows)
 * - Execute workflow (/workflows/{name}/execute)
 * - Get execution status (/workflows/{name}/status/{execution_id})
 * - List executions (/workflows/executions)
 * - Get execution logs (/workflows/executions/{execution_id}/logs)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowStage {
  name: string
  agent: string
  description?: string
}

export interface WorkflowInfo {
  name: string
  description: string
  stage_count: number
  stages: WorkflowStage[]
}

export interface WorkflowListResponse {
  workflows: WorkflowInfo[]
}

export interface ExecuteWorkflowRequest {
  context?: Record<string, unknown>
}

export interface ExecuteWorkflowResponse {
  execution_id: string
  workflow_name: string
  status: string
  message: string
}

export interface WorkflowStatusResponse {
  execution_id: string
  workflow_name: string
  status: string
  stage_results: Record<string, unknown>
  input_data: Record<string, unknown>
}

export interface ExecutionSummary {
  execution_id: string
  workflow_name: string
  status: string
  stage_count: number
  started_at?: string
  completed_at?: string
}

export interface ExecutionListResponse {
  executions: ExecutionSummary[]
}

export interface AgentLogEntry {
  id: number
  agent_name: string
  stage_name: string
  status: string
  result_json?: string
  started_at?: string
  completed_at?: string
}

export interface ExecutionLogsResponse {
  workflow_execution_id: number
  logs: AgentLogEntry[]
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * List all available workflows and their configurations.
 */
export const listWorkflows = (): Promise<WorkflowListResponse> =>
  api.get<WorkflowListResponse>("/workflows")

/**
 * Execute a named workflow.
 */
export const executeWorkflow = (
  name: string,
  request: ExecuteWorkflowRequest = {}
): Promise<ExecuteWorkflowResponse> =>
  api.post<ExecuteWorkflowResponse>(`/workflows/${encodeURIComponent(name)}/execute`, request)

/**
 * Get the status of a workflow execution.
 */
export const getWorkflowStatus = (
  name: string,
  executionId: string
): Promise<WorkflowStatusResponse> =>
  api.get<WorkflowStatusResponse>(
    `/workflows/${encodeURIComponent(name)}/status/${encodeURIComponent(executionId)}`
  )

/**
 * List workflow executions (optionally filtered by workflow name).
 */
export const listExecutions = (
  workflowName?: string
): Promise<ExecutionListResponse> =>
  api.get<ExecutionListResponse>("/workflows/executions", workflowName ? { workflow_name: workflowName } : undefined)

/**
 * Get agent execution logs for a workflow execution.
 */
export const getExecutionLogs = (
  executionId: number
): Promise<ExecutionLogsResponse> =>
  api.get<ExecutionLogsResponse>(`/workflows/executions/${executionId}/logs`)

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const workflowsApi = {
  listWorkflows,
  executeWorkflow,
  getWorkflowStatus,
  listExecutions,
  getExecutionLogs,
}

export default workflowsApi

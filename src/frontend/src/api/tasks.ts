/**
 * Tasks API - Frontend wrappers for background task endpoints.
 *
 * Covers:
 * - Submit task (/tasks)
 * - Get task status (/tasks/{task_id})
 * - List tasks (/tasks)
 * - Cancel task (/tasks/{task_id})
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskType = "ai_generate" | "export_project" | "batch_operation" | "cleanup"
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface TaskResponse {
  id: string
  type: TaskType
  status: TaskStatus
  payload?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  retries: number
  created_at?: string
  updated_at?: string
}

export interface TaskListResponse {
  tasks: TaskResponse[]
  total: number
  limit: number
  offset: number
}

export interface TaskSubmitResponse {
  task_id: string
  status: TaskStatus
  message: string
}

export interface TaskCancelResponse {
  success: boolean
  message: string
}

export interface SubmitTaskRequest {
  type: TaskType
  payload?: Record<string, unknown>
  task_id?: string
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Submit a new background task.
 */
export const submitTask = (
  request: SubmitTaskRequest
): Promise<TaskSubmitResponse> =>
  api.post<TaskSubmitResponse>("/tasks", request)

/**
 * Get task status and result by ID.
 */
export const getTask = (taskId: string): Promise<TaskResponse> =>
  api.get<TaskResponse>(`/tasks/${encodeURIComponent(taskId)}`)

/**
 * List background tasks with optional filtering.
 */
export const listTasks = (params?: {
  status?: TaskStatus
  type?: TaskType
  limit?: number
  offset?: number
}): Promise<TaskListResponse> =>
  api.get<TaskListResponse>("/tasks", params as Record<string, unknown>)

/**
 * Cancel a pending background task.
 */
export const cancelTask = (taskId: string): Promise<TaskCancelResponse> =>
  api.delete<TaskCancelResponse>(`/tasks/${encodeURIComponent(taskId)}`)

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const tasksApi = {
  submitTask,
  getTask,
  listTasks,
  cancelTask,
}

export default tasksApi

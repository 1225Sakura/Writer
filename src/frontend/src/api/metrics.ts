/**
 * Metrics API - Frontend wrappers for performance monitoring endpoints.
 *
 * Covers:
 * - Current metrics summary (/metrics)
 * - Time-series history (/metrics/history)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LatencyHistogram {
  p50: number
  p95: number
  p99: number
}

export interface AIMetrics {
  total_calls: number
  failed_calls: number
  success_rate: number
  avg_latency_ms: number
  degraded: boolean
}

export interface DatabaseMetrics {
  total_queries: number
  slow_queries: number
  avg_query_time_ms: number
}

export interface MetricsSummary {
  request_count: number
  avg_latency_ms: number
  latency_histogram: LatencyHistogram
  ai: AIMetrics
  database: DatabaseMetrics
  active_websocket_connections: number
}

export interface MetricsResponse {
  window_seconds: number
  summary: MetricsSummary
}

export interface MetricsHistoryPoint {
  timestamp: string
  request_count: number
  avg_latency_ms: number
  ai_calls: number
  ai_failures: number
  db_queries: number
  db_slow_queries: number
}

export interface MetricsHistoryResponse {
  minutes: number
  points: MetricsHistoryPoint[]
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Get current performance metrics summary.
 * @param windowSeconds Time window for aggregation (10-3600s, default 60s)
 */
export const getMetrics = (
  windowSeconds: number = 60
): Promise<MetricsResponse> =>
  api.get<MetricsResponse>("/metrics", { window_seconds: windowSeconds })

/**
 * Get time-series metrics history.
 * @param minutes Number of minutes of history (1-60, default 5)
 */
export const getMetricsHistory = (
  minutes: number = 5
): Promise<MetricsHistoryResponse> =>
  api.get<MetricsHistoryResponse>("/metrics/history", { minutes })

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const metricsApi = {
  getMetrics,
  getMetricsHistory,
}

export default metricsApi

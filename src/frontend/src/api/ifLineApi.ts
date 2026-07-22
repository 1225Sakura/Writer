/**
 * IF-Line vertical-slice API client (v0.5 patch Phase 0a.5).
 *
 * Contract: docs/architecture/if-api-schema-v1.md
 *
 * This module wraps the frozen POST /api/v1/if-lines/{id}/fork endpoint
 * and a minimal project IF-Line listing. Both helpers attach the
 * required Idempotency-Key header on fork and surface typed errors.
 */
import { api, getApiKey, resolveBaseURL } from './request'

export interface ForkIFLineRequest {
  /** UUID or int matching the path parameter. */
  if_line_id: string
  /** Optional anchor chapter (UUID or int). */
  source_chapter_id?: string
  /** Human-readable branch label (1–120 chars). */
  label?: string
}

export interface ForkIFLineConflict {
  chapter_id: string
  type: string
  message: string
}

export interface ForkIFLineResponseData {
  forked_if_line_id: string
  forked_chapter_id: string
  conflicts: ForkIFLineConflict[]
}

/** Generate a fresh UUID v4 idempotency key. Uses crypto when available. */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: RFC4122-ish v4 string. Good enough for client-side dedupe.
  const rand = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${rand(8)}-${rand(4)}-4${rand(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${rand(3)}-${rand(12)}`
}

export interface IFLineSummary {
  id: number | string
  project_id?: number
  name?: string
  parent_line_id?: number | string | null
  fork_chapter_id?: number | string | null
  created_at?: string
}

/**
 * Fork an IF-Line via the vertical-slice endpoint.
 *
 * Sends a fresh Idempotency-Key per call. On 200 returns the typed
 * response data (already unwrapped from the backend envelope).
 */
export async function forkIFLine(
  ifLineId: string,
  payload: { source_chapter_id?: string; label?: string } = {},
  options: { idempotencyKey?: string; signal?: AbortSignal } = {}
): Promise<ForkIFLineResponseData> {
  const idempotencyKey = options.idempotencyKey ?? generateIdempotencyKey()
  // We attach the header via a raw fetch through the resolved base URL +
  // api key so we can pin the Idempotency-Key without forking the axios
  // request interface. Falling back to `api.post` if the raw path fails.
  const baseURL = await resolveBaseURL()
  const apiKey = await getApiKey()

  const url = `${baseURL}/if-lines/${encodeURIComponent(ifLineId)}/fork`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  }
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  const body: ForkIFLineRequest = {
    if_line_id: String(ifLineId),
    ...(payload.source_chapter_id !== undefined ? { source_chapter_id: payload.source_chapter_id } : {}),
    ...(payload.label !== undefined ? { label: payload.label } : {}),
  }

  const fetchInit: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    ...(options.signal ? { signal: options.signal } : {}),
  }

  let response: Response
  try {
    response = await fetch(url, fetchInit)
  } catch (err) {
    // Network failure — translate to a shape the request layer would
    // produce so callers see a uniform error.
    throw {
      code: 'NETWORK_ERROR',
      message: '网络连接失败，请检查您的网络设置',
      originalError: err,
    }
  }

  const text = await response.text()
  let parsed: unknown
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = { raw: text }
  }

  if (!response.ok) {
    const envelope = parsed as { error?: { code?: string; message?: string }; detail?: string; message?: string }
    throw {
      code: envelope?.error?.code ?? 'SERVER_ERROR',
      message: envelope?.error?.message ?? envelope?.detail ?? envelope?.message ?? `HTTP ${response.status}`,
      statusCode: response.status,
      originalError: parsed,
    }
  }

  const envelope = parsed as { success?: boolean; data?: ForkIFLineResponseData }
  if (!envelope.success || !envelope.data) {
    throw {
      code: 'UNKNOWN_ERROR',
      message: 'Backend returned success=false or missing data',
      originalError: parsed,
    }
  }
  return envelope.data
}

/**
 * List IF-Lines for a project (minimal vertical slice).
 *
 * Hits GET /api/v1/projects/{project_id}/if-lines. The backend does not
 * yet expose this endpoint (only /if-lines/{id}/fork is in this
 * slice), so on 404 we degrade gracefully to an empty array — callers
 * should not treat an empty list as a fatal error during the migration
 * window.
 */
export async function getIFLines(projectId: string | number): Promise<IFLineSummary[]> {
  try {
    return await api.get<IFLineSummary[]>(`/projects/${projectId}/if-lines`)
  } catch (err) {
    const e = err as { statusCode?: number; code?: string }
    if (e?.statusCode === 404 || e?.code === 'NOT_FOUND') {
      return []
    }
    throw err
  }
}

export const ifLineApi = {
  forkIFLine,
  getIFLines,
  generateIdempotencyKey,
}

export default ifLineApi
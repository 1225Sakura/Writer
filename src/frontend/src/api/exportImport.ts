/**
 * Export/Import API - Frontend wrappers for project data export and import.
 *
 * Covers:
 * - Export project data (/project/export)
 * - Export as JSON file (/project/export/json)
 * - Export as YAML file (/project/export/yaml)
 * - Export as ZIP archive (/project/export/zip)
 * - Import from JSON (/project/import)
 * - Import from YAML (/project/import/yaml)
 * - Import from ZIP (/project/import/zip)
 */

import { api, getApiKey } from "./request"
import { getBackendUrl } from "./electron"
import type { ExportDataResponse, ImportSummaryResponse } from "./types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportProjectOptions {
  incremental?: boolean
  since?: string
}

export interface ExportZipOptions {
  format?: "json" | "yaml"
}

export interface ImportProjectRequest {
  data: ExportDataResponse
  mode?: "merge" | "replace"
}

export interface ImportYamlRequest {
  yaml_data: string
  mode?: string
  validate?: boolean
  conflict_resolution?: string
}

export interface ImportZipRequest {
  mode?: string
}

export interface ImportProjectResponse {
  success: boolean
  summary: Record<string, unknown>
  validation_passed: boolean
  conflicts_count: number
}

// Re-export for consumers that need the type
export type { ImportSummaryResponse }

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Export all project data as JSON. */
export const exportProject = (
  options: ExportProjectOptions = {}
): Promise<ExportDataResponse> =>
  api.get<ExportDataResponse>("/project/export", {
    incremental: options.incremental,
    since: options.since,
  } as Record<string, unknown>)

// v0.4 P0-Sec6: blob methods use getBackendUrl() + Authorization header
async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = await getBackendUrl()
  const apiKey = await getApiKey()
  const headers = new Headers(init.headers)
  if (apiKey) headers.set("X-API-Key", apiKey)
  const response = await fetch(`${base}${path}`, { ...init, headers })
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }
  return response
}

/** Export project as JSON file download. Returns blob URL. */
export const exportAsJson = async (): Promise<Blob> => {
  const response = await authedFetch("/api/v1/project/export/json", {
    method: "GET",
    headers: { Accept: "application/json" },
  })
  return response.blob()
}

/** Export project as YAML file download. Returns blob. */
export const exportAsYaml = async (): Promise<Blob> => {
  const response = await authedFetch("/api/v1/project/export/yaml", {
    method: "GET",
    headers: { Accept: "application/x-yaml" },
  })
  return response.blob()
}

/** Export project as ZIP archive download. Returns blob. */
export const exportAsZip = async (
  options: ExportZipOptions = {}
): Promise<Blob> => {
  const response = await authedFetch(
    `/api/v1/project/export/zip?format=${options.format || "json"}`,
    {
      method: "GET",
      headers: { Accept: "application/zip" },
    }
  )
  return response.blob()
}

/** Import project data from JSON. */
export const importProject = (
  request: ImportProjectRequest
): Promise<ImportProjectResponse> =>
  api.post<ImportProjectResponse>("/project/import", {
    data: request.data,
    mode: request.mode || "merge",
  })

/** Import project data from YAML string. */
export const importFromYaml = (
  request: ImportYamlRequest
): Promise<ImportProjectResponse> =>
  api.post<ImportProjectResponse>("/project/import/yaml", request)

/** Import project data from ZIP archive. */
export const importFromZip = async (
  zipData: Blob,
  request: ImportZipRequest = {}
): Promise<ImportProjectResponse> => {
  const base = await getBackendUrl()
  const apiKey = await getApiKey()
  const formData = new FormData()
  formData.append("zip_data", zipData)
  formData.append("mode", request.mode || "merge")
  const headers: Record<string, string> = {}
  if (apiKey) headers["X-API-Key"] = apiKey
  const response = await fetch(`${base}/api/v1/project/import/zip`, {
    method: "POST",
    headers,
    body: formData,
  })
  if (!response.ok) {
    throw new Error(`Import ZIP failed: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<ImportProjectResponse>
}

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const exportImportApi = {
  exportProject,
  exportAsJson,
  exportAsYaml,
  exportAsZip,
  importProject,
  importFromYaml,
  importFromZip,
}

export default exportImportApi

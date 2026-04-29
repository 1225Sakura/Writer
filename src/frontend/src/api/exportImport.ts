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

import { api } from "./request"
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

/** Export project as JSON file download. Returns blob URL. */
export const exportAsJson = async (): Promise<Blob> => {
  const response = await fetch(`/api/v1/project/export/json`, {
    method: "GET",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`)
  }
  return response.blob()
}

/** Export project as YAML file download. Returns blob. */
export const exportAsYaml = async (): Promise<Blob> => {
  const response = await fetch(`/api/v1/project/export/yaml`, {
    method: "GET",
    headers: { Accept: "application/x-yaml" },
  })
  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`)
  }
  return response.blob()
}

/** Export project as ZIP archive download. Returns blob. */
export const exportAsZip = async (
  options: ExportZipOptions = {}
): Promise<Blob> => {
  const response = await fetch(
    `/api/v1/project/export/zip?format=${options.format || "json"}`,
    {
      method: "GET",
      headers: { Accept: "application/zip" },
    }
  )
  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`)
  }
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
export const importFromZip = (
  zipData: Blob,
  request: ImportZipRequest = {}
): Promise<ImportProjectResponse> => {
  const formData = new FormData()
  formData.append("zip_data", zipData)
  formData.append("mode", request.mode || "merge")
  return api.post<ImportProjectResponse>("/project/import/zip", formData)
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

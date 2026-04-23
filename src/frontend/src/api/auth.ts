// Auth API - Local API key management for desktop app
import { getApiClient } from './request'

export interface AuthStatus {
  enabled: boolean
  key_configured: boolean
  auth_type: string
  skip_localhost: boolean
}

export interface AuthKeyResponse {
  api_key: string
  message: string
}

/**
 * Fetch the local API key from the backend.
 * For desktop apps, this is called once on app startup.
 */
export async function fetchApiKey(): Promise<string> {
  const client = await getApiClient()
  const response = await client.post<AuthKeyResponse>('/auth/key')
  const { api_key } = response.data
  localStorage.setItem('writer_api_key', api_key)
  return api_key
}

/**
 * Refresh the API key (invalidates the old one).
 */
export async function refreshApiKey(): Promise<string> {
  const client = await getApiClient()
  const response = await client.post<AuthKeyResponse>('/auth/key/refresh')
  const { api_key } = response.data
  localStorage.setItem('writer_api_key', api_key)
  return api_key
}

/**
 * Check auth status from the backend.
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const client = await getApiClient()
  const response = await client.get<AuthStatus>('/auth/status')
  return response.data
}

/**
 * Initialize auth: fetch and store the API key.
 * Call this once when the app starts.
 */
export async function initAuth(): Promise<void> {
  // Check if we already have a key
  const existingKey = localStorage.getItem('writer_api_key')
  if (existingKey) {
    // Key exists, verify it works by checking auth status
    try {
      await getAuthStatus()
      return
    } catch {
      // Key may be invalid, fetch a new one
      localStorage.removeItem('writer_api_key')
    }
  }
  // Fetch new key
  await fetchApiKey()
}

/**
 * Get the stored API key.
 */
export function getStoredApiKey(): string | null {
  return localStorage.getItem('writer_api_key')
}

/**
 * Clear the stored API key.
 */
export function clearApiKey(): void {
  localStorage.removeItem('writer_api_key')
}

/**
 * Electron Desktop API Integration
 *
 * This module provides the API base URL configuration for the Electron desktop app.
 * In production, the frontend gets the backend URL from the main process via IPC
 * instead of hardcoding localhost. In development (Vite dev server), it falls back
 * to the Vite proxy configuration.
 */

// ============================================
// Environment Detection
// ============================================

/** True when running inside Electron (main or renderer). */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI;
};

/** True when running in a browser (not Electron). */
export const isBrowser = (): boolean => !isElectron();

/** Get the electron API object or null. */
const getElectronAPI = () => {
  return window.electronAPI ?? null;
};

// ============================================
// Backend URL Resolution
// ============================================

let cachedBackendUrl: string | null = null;

/**
 * Get the backend API base URL.
 *
 * In Electron: queries the main process for the dynamically assigned URL.
 * In browser/Vite dev: uses the Vite proxy or env variable.
 */
export async function getBackendUrl(): Promise<string> {
  if (cachedBackendUrl) {
    return cachedBackendUrl;
  }

  const api = getElectronAPI();
  if (api) {
    const url = await api.getBackendUrl();
    cachedBackendUrl = `${url}/api/v1`;
    return cachedBackendUrl;
  }

  // Browser / Vite dev mode: use env or default
  const base =
    (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8000';
  cachedBackendUrl = `${base}/api/v1`;
  return cachedBackendUrl;
}

/**
 * Get backend status from the main process.
 * Returns null when not running in Electron.
 */
export async function getBackendStatus(): Promise<{
  running: boolean;
  healthy: boolean;
  port: number;
  pid: number | null;
} | null> {
  const api = getElectronAPI();
  if (!api) return null;
  return api.getBackendStatus();
}

/**
 * Manually restart the backend service.
 * Only available in Electron.
 */
export async function restartBackend(): Promise<{
  success: boolean;
  error?: string;
}> {
  const api = getElectronAPI();
  if (!api) {
    return { success: false, error: 'Not running in Electron' };
  }
  return api.restartBackend();
}

/**
 * Clear the cached backend URL (e.g. after backend restart).
 */
export function clearBackendUrlCache(): void {
  cachedBackendUrl = null;
}

// ============================================
// API Key (Desktop Auth)
// ============================================

/**
 * Get the API key from Electron's secure storage.
 * Falls back to localStorage in browser mode.
 */
export async function getApiKey(): Promise<string | null> {
  const api = getElectronAPI();
  if (api) {
    return api.getApiKey();
  }
  return localStorage.getItem('writer_api_key');
}

/**
 * Set the API key in Electron's secure storage.
 * Falls back to localStorage in browser mode.
 */
export async function setApiKey(key: string): Promise<void> {
  const api = getElectronAPI();
  if (api) {
    await api.setApiKey(key);
  } else {
    localStorage.setItem('writer_api_key', key);
  }
}

// ============================================
// App Info
// ============================================

export interface AppInfo {
  version: string;
  name: string;
  isDev: boolean;
  platform: string;
}

/**
 * Get application info from the main process.
 */
export async function getAppInfo(): Promise<AppInfo | null> {
  const api = getElectronAPI();
  if (!api) return null;
  return api.getAppInfo();
}

// ============================================
// Dialog Options (mirrors Electron types without importing Electron namespace)
// ============================================

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  message?: string;
  nameFieldLabel?: string;
  showsTagField?: boolean;
  properties?: Array<
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'treatPackageAsDirectory'
    | 'showOverwriteConfirmation'
    | 'dontAddToRecent'
  >;
  securityScopedBookmarks?: boolean;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
    | 'treatPackageAsDirectory'
    | 'dontAddToRecent'
  >;
  message?: string;
  securityScopedBookmarks?: boolean;
}

// ============================================
// File Operations (Electron only)
// ============================================

export async function showSaveDialog(
  options: SaveDialogOptions
): Promise<string | null> {
  const api = getElectronAPI();
  if (!api) return null;
  return api.showSaveDialog(options as unknown as Parameters<typeof api.showSaveDialog>[0]);
}

export async function showOpenDialog(
  options: OpenDialogOptions
): Promise<string[] | null> {
  const api = getElectronAPI();
  if (!api) return null;
  return api.showOpenDialog(options as unknown as Parameters<typeof api.showOpenDialog>[0]);
}

export async function readFile(filePath: string): Promise<string> {
  const api = getElectronAPI();
  if (!api) {
    throw new Error('File operations only available in Electron');
  }
  return api.readFile(filePath);
}

export async function writeFile(filePath: string, content: string): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) {
    throw new Error('File operations only available in Electron');
  }
  return api.writeFile(filePath, content);
}

// ============================================
// External Links
// ============================================

export async function openExternal(url: string): Promise<void> {
  const api = getElectronAPI();
  if (api) {
    await api.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// ============================================
// Window Controls (Electron only)
// ============================================

export function minimizeWindow(): void {
  const api = getElectronAPI();
  if (api) api.minimizeWindow();
}

export function maximizeWindow(): void {
  const api = getElectronAPI();
  if (api) api.maximizeWindow();
}

export function closeWindow(): void {
  const api = getElectronAPI();
  if (api) api.closeWindow();
}

export async function isMaximized(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  return api.isMaximized();
}

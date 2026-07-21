/**
 * Electron Preload Script
 * Exposes secure IPC bridge to renderer process via contextBridge.
 *
 * Security rules:
 * - Never expose ipcRenderer directly
 * - Never expose Node.js APIs directly
 * - All IPC channels are whitelisted and typed
 * - process.platform is read at preload time and exposed as a string value
 */

import { contextBridge, ipcRenderer } from 'electron';

// Read platform at preload time and expose as a plain string
// This avoids exposing the Node.js process object to the renderer
const PLATFORM = process.platform;

// Whitelisted IPC channel names for type safety and auditability
const IPC_CHANNELS = {
  backend: {
    getBackendUrl: 'get-backend-url',
    getBackendStatus: 'get-backend-status',
    restartBackend: 'restart-backend',
  },
  auth: {
    getApiKey: 'get-api-key',
    setApiKey: 'set-api-key',
  },
  shell: {
    openExternal: 'open-external',
  },
  dialog: {
    showSaveDialog: 'show-save-dialog',
    showOpenDialog: 'show-open-dialog',
  },
  file: {
    readFile: 'read-file',
    writeFile: 'write-file',
  },
  app: {
    getAppInfo: 'get-app-info',
  },
  window: {
    minimizeWindow: 'minimize-window',
    maximizeWindow: 'maximize-window',
    closeWindow: 'close-window',
    isMaximized: 'is-maximized',
  },
  aiLog: {
    append: 'ai-log:append',
  },
} as const;

// Expose the secure API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Backend
  getBackendUrl: () => ipcRenderer.invoke(IPC_CHANNELS.backend.getBackendUrl),
  getBackendStatus: () => ipcRenderer.invoke(IPC_CHANNELS.backend.getBackendStatus),
  restartBackend: () => ipcRenderer.invoke(IPC_CHANNELS.backend.restartBackend),

  // Auth - API key management for local desktop auth
  getApiKey: () => ipcRenderer.invoke(IPC_CHANNELS.auth.getApiKey),
  setApiKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.auth.setApiKey, key),

  // External links
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.shell.openExternal, url),

  // File dialogs
  showSaveDialog: (options: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.dialog.showSaveDialog, options),
  showOpenDialog: (options: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.dialog.showOpenDialog, options),

  // File operations — token-based (v0.4 P0-Sec3 hardening)
  // Renderer must obtain a token via showSaveDialog/showOpenDialog first
  // Arbitrary paths no longer accepted — prevents CWE-22 Path Traversal
  readFileByToken: (token: string) => ipcRenderer.invoke(IPC_CHANNELS.file.readFile, token),
  writeFileByToken: (token: string, content: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.file.writeFile, token, content),

  // App info
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.app.getAppInfo),

  // Window controls
  minimizeWindow: () => ipcRenderer.send(IPC_CHANNELS.window.minimizeWindow),
  maximizeWindow: () => ipcRenderer.send(IPC_CHANNELS.window.maximizeWindow),
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.window.closeWindow),
  isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.window.isMaximized),

  // Platform info (static string, not live process reference)
  platform: PLATFORM,

  // AI log
  appendAILog: (payload: object) => ipcRenderer.invoke(IPC_CHANNELS.aiLog.append, payload),
});

// Type declaration for renderer process
declare global {
  interface Window {
    electronAPI: {
      getBackendUrl: () => Promise<string>;
      getBackendStatus: () => Promise<{
        running: boolean;
        healthy: boolean;
        port: number;
        pid: number | null;
      }>;
      restartBackend: () => Promise<{ success: boolean; error?: string }>;
      getApiKey: () => Promise<string | null>;
      setApiKey: (key: string) => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<string | null>;
      showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<string[] | null>;
      readFileByToken: (token: string) => Promise<string>;
      writeFileByToken: (token: string, content: string) => Promise<boolean>;
      getAppInfo: () => Promise<{ version: string; name: string; isDev: boolean; platform: string }>;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      isMaximized: () => Promise<boolean>;
      platform: NodeJS.Platform;
      appendAILog: (payload: object) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

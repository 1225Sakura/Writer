/// <reference types="vite/client" />

// Electron API type augmentation (mirrors electron/preload.ts declarations)
// This makes window.electronAPI available in the frontend TypeScript
interface ElectronAPI {
  getBackendUrl: () => Promise<string>
  getBackendStatus: () => Promise<{
    running: boolean
    healthy: boolean
    port: number
    pid: number | null
  }>
  restartBackend: () => Promise<{ success: boolean; error?: string }>
  getApiKey: () => Promise<string | null>
  setApiKey: (key: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  showSaveDialog: (options: import('electron').SaveDialogOptions) => Promise<string | null>
  showOpenDialog: (options: import('electron').OpenDialogOptions) => Promise<string[] | null>
  readFile: (filePath: string) => Promise<string>
  writeFile: (filePath: string, content: string) => Promise<boolean>
  getAppInfo: () => Promise<{ version: string; name: string; isDev: boolean; platform: string }>
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isMaximized: () => Promise<boolean>
  appendAILog: (payload: object) => Promise<{ success: boolean; error?: string }>
  platform: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}


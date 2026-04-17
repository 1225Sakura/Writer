/**
 * Electron Preload Script
 * Exposes secure IPC bridge to renderer process via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Backend
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),

  // External links
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // File dialogs
  showSaveDialog: (options: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('show-open-dialog', options),

  // File operations
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),

  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),

  // Platform info
  platform: process.platform,
});

// Type declaration for renderer process
declare global {
  interface Window {
    electronAPI: {
      getBackendUrl: () => Promise<string>;
      openExternal: (url: string) => Promise<void>;
      showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<string | null>;
      showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<string[] | null>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      getAppInfo: () => Promise<{ version: string; name: string; isDev: boolean }>;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      isMaximized: () => Promise<boolean>;
      platform: NodeJS.Platform;
    };
  }
}

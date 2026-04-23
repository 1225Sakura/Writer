"use strict";
/**
 * Electron Preload Script
 * Exposes secure IPC bridge to renderer process via contextBridge.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Backend
    getBackendUrl: () => electron_1.ipcRenderer.invoke('get-backend-url'),
    // Auth - API key management for local desktop auth
    getApiKey: () => electron_1.ipcRenderer.invoke('get-api-key'),
    setApiKey: (key) => electron_1.ipcRenderer.invoke('set-api-key', key),
    // External links
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
    // File dialogs
    showSaveDialog: (options) => electron_1.ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => electron_1.ipcRenderer.invoke('show-open-dialog', options),
    // File operations
    readFile: (filePath) => electron_1.ipcRenderer.invoke('read-file', filePath),
    writeFile: (filePath, content) => electron_1.ipcRenderer.invoke('write-file', filePath, content),
    // App info
    getAppInfo: () => electron_1.ipcRenderer.invoke('get-app-info'),
    // Window controls
    minimizeWindow: () => electron_1.ipcRenderer.send('minimize-window'),
    maximizeWindow: () => electron_1.ipcRenderer.send('maximize-window'),
    closeWindow: () => electron_1.ipcRenderer.send('close-window'),
    isMaximized: () => electron_1.ipcRenderer.invoke('is-maximized'),
    // Platform info
    platform: process.platform,
});
//# sourceMappingURL=preload.js.map
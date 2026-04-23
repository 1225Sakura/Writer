"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
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
};
// Expose the secure API to the renderer
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Backend
    getBackendUrl: () => electron_1.ipcRenderer.invoke(IPC_CHANNELS.backend.getBackendUrl),
    getBackendStatus: () => electron_1.ipcRenderer.invoke(IPC_CHANNELS.backend.getBackendStatus),
    restartBackend: () => electron_1.ipcRenderer.invoke(IPC_CHANNELS.backend.restartBackend),
    // Auth - API key management for local desktop auth
    getApiKey: () => electron_1.ipcRenderer.invoke(IPC_CHANNELS.auth.getApiKey),
    setApiKey: (key) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.auth.setApiKey, key),
    // External links
    openExternal: (url) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.shell.openExternal, url),
    // File dialogs
    showSaveDialog: (options) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.dialog.showSaveDialog, options),
    showOpenDialog: (options) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.dialog.showOpenDialog, options),
    // File operations
    readFile: (filePath) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.file.readFile, filePath),
    writeFile: (filePath, content) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.file.writeFile, filePath, content),
    // App info
    getAppInfo: () => electron_1.ipcRenderer.invoke(IPC_CHANNELS.app.getAppInfo),
    // Window controls
    minimizeWindow: () => electron_1.ipcRenderer.send(IPC_CHANNELS.window.minimizeWindow),
    maximizeWindow: () => electron_1.ipcRenderer.send(IPC_CHANNELS.window.maximizeWindow),
    closeWindow: () => electron_1.ipcRenderer.send(IPC_CHANNELS.window.closeWindow),
    isMaximized: () => electron_1.ipcRenderer.invoke(IPC_CHANNELS.window.isMaximized),
    // Platform info (static string, not live process reference)
    platform: PLATFORM,
});
//# sourceMappingURL=preload.js.map
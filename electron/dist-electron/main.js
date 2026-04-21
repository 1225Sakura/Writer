"use strict";
/**
 * Electron Main Process
 * Handles window management, IPC communication, and Python backend process management.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
// Configuration
const BACKEND_PORT = 8000;
const BACKEND_HOST = 'localhost';
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
// Window reference
let mainWindow = null;
let backendProcess = null;
/**
 * Start the Python backend process
 */
function startBackend() {
    return new Promise((resolve, reject) => {
        const backendPath = isDev
            ? path_1.default.join(__dirname, '..', 'src', 'backend')
            : path_1.default.join(process.resourcesPath, 'backend');
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        // Start uvicorn server
        backendProcess = (0, child_process_1.spawn)(pythonCmd, [
            '-m', 'uvicorn',
            'main:app',
            '--host', BACKEND_HOST,
            '--port', BACKEND_PORT.toString(),
        ], {
            cwd: backendPath,
            env: { ...process.env, PYTHONPATH: backendPath },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        backendProcess.on('error', (err) => {
            console.error('[Electron] Backend process error:', err);
            reject(err);
        });
        backendProcess.on('exit', (code) => {
            console.log(`[Electron] Backend process exited with code ${code}`);
            backendProcess = null;
        });
        // Wait for backend to be ready
        waitForBackend(BACKEND_PORT, 30000)
            .then(() => {
            console.log('[Electron] Backend is ready');
            resolve();
        })
            .catch((err) => {
            console.error('[Electron] Backend failed to start:', err);
            reject(err);
        });
    });
}
/**
 * Wait for backend to be ready by polling health endpoint
 */
function waitForBackend(port, timeout) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const pollInterval = 500;
        const check = () => {
            const req = http_1.default.get(`http://${BACKEND_HOST}:${port}/api/v1/health`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                }
                else {
                    setTimeout(check, pollInterval);
                }
            });
            req.on('error', () => {
                if (Date.now() - startTime > timeout) {
                    reject(new Error('Backend timeout'));
                }
                else {
                    setTimeout(check, pollInterval);
                }
            });
        };
        check();
    });
}
/**
 * Stop the Python backend process
 */
function stopBackend() {
    if (backendProcess) {
        if (process.platform === 'win32') {
            (0, child_process_1.spawn)('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t']);
        }
        else {
            backendProcess.kill('SIGTERM');
        }
        backendProcess = null;
    }
}
/**
 * Create the main application window
 */
async function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        title: 'Writer - 自动化写作软件',
        backgroundColor: '#1a1a2e',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
    });
    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    // Load the app
    if (isDev) {
        // Development: use Vite dev server
        await mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        // Production: use built files
        await mainWindow.loadFile(path_1.default.join(__dirname, '..', 'dist', 'index.html'));
    }
}
/**
 * Register IPC handlers for renderer process communication
 */
function registerIpcHandlers() {
    // Get backend URL for API calls
    electron_1.ipcMain.handle('get-backend-url', () => {
        return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
    });
    // Open external URL in browser
    electron_1.ipcMain.handle('open-external', (_, url) => {
        return electron_1.shell.openExternal(url);
    });
    // Show save dialog for export
    electron_1.ipcMain.handle('show-save-dialog', async (_, options) => {
        if (!mainWindow)
            return null;
        const result = await electron_1.dialog.showSaveDialog(mainWindow, options);
        return result.canceled ? null : result.filePath;
    });
    // Show open dialog for import
    electron_1.ipcMain.handle('show-open-dialog', async (_, options) => {
        if (!mainWindow)
            return null;
        const result = await electron_1.dialog.showOpenDialog(mainWindow, options);
        return result.canceled ? null : result.filePaths;
    });
    // Read file (for import)
    electron_1.ipcMain.handle('read-file', async (_, filePath) => {
        return fs_1.default.promises.readFile(filePath, 'utf-8');
    });
    // Write file (for export)
    electron_1.ipcMain.handle('write-file', async (_, filePath, content) => {
        await fs_1.default.promises.writeFile(filePath, content, 'utf-8');
        return true;
    });
    // App info
    electron_1.ipcMain.handle('get-app-info', () => {
        return {
            version: electron_1.app.getVersion(),
            name: electron_1.app.getName(),
            isDev,
        };
    });
    // Window controls
    electron_1.ipcMain.on('minimize-window', () => {
        mainWindow?.minimize();
    });
    electron_1.ipcMain.on('maximize-window', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow?.maximize();
        }
    });
    electron_1.ipcMain.on('close-window', () => {
        mainWindow?.close();
    });
    electron_1.ipcMain.handle('is-maximized', () => {
        return mainWindow?.isMaximized() ?? false;
    });
}
// App lifecycle
electron_1.app.whenReady().then(async () => {
    console.log('[Electron] App ready');
    registerIpcHandlers();
    try {
        await startBackend();
        await createWindow();
    }
    catch (err) {
        console.error('[Electron] Failed to start:', err);
        electron_1.dialog.showErrorBox('启动失败', '无法启动后端服务，请检查Python环境');
        electron_1.app.quit();
    }
    electron_1.app.on('activate', async () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            await createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    stopBackend();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    stopBackend();
});
//# sourceMappingURL=main.js.map
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
// In-memory API key storage (persists for app lifetime)
let cachedApiKey = null;
/**
 * Find the correct Python executable.
 * Prefers project venv, then falls back to system python.
 */
function findPython() {
    const candidates = [];
    if (process.platform === 'win32') {
        if (!isDev) {
            // Packaged mode: use bundled venv
            const bundledVenv = path_1.default.join(process.resourcesPath, 'python_venv', 'Scripts', 'python.exe');
            candidates.push(bundledVenv);
        }
        // Dev mode or fallback
        candidates.push(
        // Project venv (dev mode)
        path_1.default.join(__dirname, '..', '..', '..', 'src', 'backend', '.venv', 'Scripts', 'python.exe'), path_1.default.join(__dirname, '..', '..', '..', '.venv', 'Scripts', 'python.exe'), 
        // Python Launcher for Windows (most reliable on Win)
        'py', 
        // Direct python commands
        'python', 'python3');
    }
    else {
        if (!isDev) {
            const bundledVenv = path_1.default.join(process.resourcesPath, 'python_venv', 'bin', 'python');
            candidates.push(bundledVenv);
        }
        candidates.push(path_1.default.join(__dirname, '..', '..', '..', 'src', 'backend', '.venv', 'bin', 'python'), path_1.default.join(__dirname, '..', '..', '..', '.venv', 'bin', 'python'), 'python3', 'python');
    }
    for (const cmd of candidates) {
        try {
            fs_1.default.accessSync(cmd, fs_1.default.constants.X_OK);
            return cmd;
        }
        catch {
            // not found or not executable, try next
        }
    }
    return candidates[candidates.length - 1]; // fallback
}
/**
 * Start the Python backend process
 */
function startBackend() {
    return new Promise((resolve, reject) => {
        const backendPath = isDev
            ? path_1.default.join(__dirname, '..', 'src', 'backend')
            : path_1.default.join(process.resourcesPath, 'backend');
        // Verify backend directory exists
        if (!fs_1.default.existsSync(backendPath)) {
            reject(new Error(`Backend directory not found: ${backendPath}`));
            return;
        }
        const pythonCmd = findPython();
        console.log(`[Electron] Using Python: ${pythonCmd}`);
        console.log(`[Electron] Backend path: ${backendPath}`);
        // Use launcher script to handle import path setup
        const launcherPath = path_1.default.join(backendPath, 'electron_launcher.py');
        backendProcess = (0, child_process_1.spawn)(pythonCmd, [
            launcherPath,
            BACKEND_HOST,
            BACKEND_PORT.toString(),
        ], {
            cwd: backendPath,
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        backendProcess.on('error', (err) => {
            console.error('[Electron] Backend process error:', err);
            reject(new Error(`无法启动 Python 后端: ${err.message}\n请确认已安装 Python 并创建了 venv`));
        });
        backendProcess.stdout?.on('data', (data) => {
            console.log(`[Backend] ${data.toString().trim()}`);
        });
        backendProcess.stderr?.on('data', (data) => {
            console.error(`[Backend] ${data.toString().trim()}`);
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
            if (backendProcess.pid) {
                (0, child_process_1.spawn)('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t']);
            }
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
        await mainWindow.loadFile(path_1.default.join(__dirname, '..', 'frontend-build', 'index.html'));
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
    // API key management for local auth
    electron_1.ipcMain.handle('get-api-key', () => {
        return cachedApiKey;
    });
    electron_1.ipcMain.handle('set-api-key', (_, key) => {
        cachedApiKey = key;
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
        const msg = err instanceof Error ? err.message : String(err);
        electron_1.dialog.showErrorBox('启动失败', `无法启动后端服务，请检查 Python 环境\n\n详情: ${msg}`);
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
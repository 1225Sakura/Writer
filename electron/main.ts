/**
 * Electron Main Process
 * Handles window management, IPC communication, and Python backend process management.
 */

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

// Configuration
const BACKEND_PORT = 8000;
const BACKEND_HOST = 'localhost';
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Window reference
let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

// In-memory API key storage (persists for app lifetime)
let cachedApiKey: string | null = null;

/**
 * Start the Python backend process
 */
function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const backendPath = isDev
      ? path.join(__dirname, '..', 'src', 'backend')
      : path.join(process.resourcesPath, 'backend');

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    // Start uvicorn server
    backendProcess = spawn(pythonCmd, [
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
function waitForBackend(port: number, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const pollInterval = 500;

    const check = () => {
      const req = http.get(`http://${BACKEND_HOST}:${port}/api/v1/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(check, pollInterval);
        }
      });

      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Backend timeout'));
        } else {
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
function stopBackend(): void {
  if (backendProcess) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', backendProcess.pid!.toString(), '/f', '/t']);
    } else {
      backendProcess.kill('SIGTERM');
    }
    backendProcess = null;
  }
}

/**
 * Create the main application window
 */
async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
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
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the app
  if (isDev) {
    // Development: use Vite dev server
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: use built files
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

/**
 * Register IPC handlers for renderer process communication
 */
function registerIpcHandlers(): void {
  // Get backend URL for API calls
  ipcMain.handle('get-backend-url', () => {
    return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
  });

  // API key management for local auth
  ipcMain.handle('get-api-key', () => {
    return cachedApiKey;
  });

  ipcMain.handle('set-api-key', (_, key: string) => {
    cachedApiKey = key;
  });

  // Open external URL in browser
  ipcMain.handle('open-external', (_, url: string) => {
    return shell.openExternal(url);
  });

  // Show save dialog for export
  ipcMain.handle('show-save-dialog', async (_, options: Electron.SaveDialogOptions) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result.canceled ? null : result.filePath;
  });

  // Show open dialog for import
  ipcMain.handle('show-open-dialog', async (_, options: Electron.OpenDialogOptions) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? null : result.filePaths;
  });

  // Read file (for import)
  ipcMain.handle('read-file', async (_, filePath: string) => {
    return fs.promises.readFile(filePath, 'utf-8');
  });

  // Write file (for export)
  ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return true;
  });

  // App info
  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      isDev,
    };
  });

  // Window controls
  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    mainWindow?.close();
  });

  ipcMain.handle('is-maximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  console.log('[Electron] App ready');

  registerIpcHandlers();

  try {
    await startBackend();
    await createWindow();
  } catch (err) {
    console.error('[Electron] Failed to start:', err);
    dialog.showErrorBox('启动失败', '无法启动后端服务，请检查Python环境');
    app.quit();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

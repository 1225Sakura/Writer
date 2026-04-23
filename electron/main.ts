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
 * Find the correct Python executable.
 * Prefers project venv, then falls back to system python.
 */
function findPython(): string {
  const candidates: string[] = [];

  if (process.platform === 'win32') {
    if (!isDev) {
      // Packaged mode: use bundled venv
      const bundledVenv = path.join(process.resourcesPath!, 'python_venv', 'Scripts', 'python.exe');
      candidates.push(bundledVenv);
    }
    // Dev mode or fallback
    candidates.push(
      // Project venv (dev mode)
      path.join(__dirname, '..', '..', '..', 'src', 'backend', '.venv', 'Scripts', 'python.exe'),
      path.join(__dirname, '..', '..', '..', '.venv', 'Scripts', 'python.exe'),
      // Python Launcher for Windows (most reliable on Win)
      'py',
      // Direct python commands
      'python',
      'python3'
    );
  } else {
    if (!isDev) {
      const bundledVenv = path.join(process.resourcesPath!, 'python_venv', 'bin', 'python');
      candidates.push(bundledVenv);
    }
    candidates.push(
      path.join(__dirname, '..', '..', '..', 'src', 'backend', '.venv', 'bin', 'python'),
      path.join(__dirname, '..', '..', '..', '.venv', 'bin', 'python'),
      'python3',
      'python'
    );
  }

  for (const cmd of candidates) {
    try {
      fs.accessSync(cmd, fs.constants.X_OK);
      return cmd;
    } catch {
      // not found or not executable, try next
    }
  }
  return candidates[candidates.length - 1]; // fallback
}

/**
 * Start the Python backend process
 */
function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const backendPath = isDev
      ? path.join(__dirname, '..', 'src', 'backend')
      : path.join(process.resourcesPath, 'backend');

    // Verify backend directory exists
    if (!fs.existsSync(backendPath)) {
      reject(new Error(`Backend directory not found: ${backendPath}`));
      return;
    }

    const pythonCmd = findPython();
    console.log(`[Electron] Using Python: ${pythonCmd}`);
    console.log(`[Electron] Backend path: ${backendPath}`);

    // Use launcher script to handle import path setup
    const launcherPath = path.join(backendPath, 'electron_launcher.py');
    backendProcess = spawn(pythonCmd, [
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

    backendProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[Backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on('data', (data: Buffer) => {
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
      if (backendProcess.pid) {
        spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t']);
      }
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
    await mainWindow.loadFile(path.join(__dirname, '..', 'frontend-build', 'index.html'));
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
    const msg = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox(
      '启动失败',
      `无法启动后端服务，请检查 Python 环境\n\n详情: ${msg}`
    );
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

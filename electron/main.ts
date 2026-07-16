/**
 * Electron Main Process
 * Handles window management, IPC communication, Python backend process management,
 * backend health monitoring, auto-restart, and window state persistence.
 */

import { app, BrowserWindow, ipcMain, shell, dialog, screen } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

// ============================================
// Configuration
// ============================================

const BACKEND_PORT = 8000;
const BACKEND_HOST = '127.0.0.1';
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Paths
const STATE_DIR = path.join(app.getPath('userData'), 'state');
const WINDOW_STATE_FILE = path.join(STATE_DIR, 'window-state.json');

// ============================================
// State
// ============================================

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let backendRestartCount = 0;
let backendRestartTimer: NodeJS.Timeout | null = null;
let healthCheckTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;
let cachedApiKey: string | null = null;

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
  isFullScreen?: boolean;
}

const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1400,
  height: 900,
};

// ============================================
// Window State Persistence
// ============================================

function loadWindowState(): WindowState {
  try {
    if (fs.existsSync(WINDOW_STATE_FILE)) {
      const data = fs.readFileSync(WINDOW_STATE_FILE, 'utf-8');
      const state = JSON.parse(data) as WindowState;
      // Validate bounds are on a visible screen
      const displays = screen.getAllDisplays();
      const isVisible = displays.some((d: Electron.Display) => {
        const { x, y, width, height } = d.workArea;
        const wx = state.x ?? 0;
        const wy = state.y ?? 0;
        return wx + (state.width * 0.5) >= x &&
               wx <= x + width &&
               wy + (state.height * 0.5) >= y &&
               wy <= y + height;
      });
      if (isVisible) {
        return { ...DEFAULT_WINDOW_STATE, ...state };
      }
    }
  } catch (err) {
    console.error('[Electron] Failed to load window state:', err);
  }
  return { ...DEFAULT_WINDOW_STATE };
}

function saveWindowState(): void {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen(),
    };
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state), 'utf-8');
  } catch (err) {
    console.error('[Electron] Failed to save window state:', err);
  }
}

// ============================================
// Python Discovery
// ============================================

function findPython(): string {
  const candidates: string[] = [];

  if (process.platform === 'win32') {
    if (!isDev) {
      const bundledVenv = path.join(process.resourcesPath!, 'python_venv', 'Scripts', 'python.exe');
      candidates.push(bundledVenv);
    }
    candidates.push(
      path.join(__dirname, '..', '..', 'src', 'backend', '.venv', 'Scripts', 'python.exe'),
      path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe'),
    );
    // Commands that need to be resolved via PATH
    const pathCommands = ['py', 'python', 'python3'];
    for (const cmd of pathCommands) {
      try {
        // Use 'where' on Windows to resolve PATH commands
        const { execSync } = require('child_process');
        const resolved = execSync(`where ${cmd}`, { encoding: 'utf-8' }).trim().split('\n')[0];
        if (resolved) {
          candidates.push(resolved);
        }
      } catch {
        // command not in PATH
      }
    }
  } else {
    if (!isDev) {
      const bundledVenv = path.join(process.resourcesPath!, 'python_venv', 'bin', 'python');
      candidates.push(bundledVenv);
    }
    candidates.push(
      path.join(__dirname, '..', '..', 'src', 'backend', '.venv', 'bin', 'python'),
      path.join(__dirname, '..', '..', '.venv', 'bin', 'python'),
    );
    // Commands that need to be resolved via PATH
    const pathCommands = ['python3', 'python'];
    for (const cmd of pathCommands) {
      try {
        const { execSync } = require('child_process');
        const resolved = execSync(`which ${cmd}`, { encoding: 'utf-8' }).trim();
        if (resolved) {
          candidates.push(resolved);
        }
      } catch {
        // command not in PATH
      }
    }
  }

  for (const cmd of candidates) {
    try {
      fs.accessSync(cmd, fs.constants.X_OK);
      return cmd;
    } catch {
      // not found or not executable
    }
  }
  // Last resort: return 'python' and hope it's in PATH
  return process.platform === 'win32' ? 'python' : 'python3';
}

// ============================================
// Backend Lifecycle
// ============================================

function getBackendPaths(): { backendPath: string; launcherPath: string } {
  if (isDev) {
    // In dev, electron/main.ts is at project-root/electron/main.ts
    // __dirname = project-root/electron/dist-electron (after tsc build)
    // So we go up 2 levels to reach project-root, then into src/backend
    const backendPath = path.join(__dirname, '..', '..', 'src', 'backend');
    return {
      backendPath,
      launcherPath: path.join(backendPath, 'electron_launcher.py'),
    };
  } else {
    const backendPath = path.join(process.resourcesPath!, 'backend');
    return {
      backendPath,
      launcherPath: path.join(backendPath, 'electron_launcher.py'),
    };
  }
}

function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port, host);
  });
}

function startBackend(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    // MUST be first statement — before isPortAvailable — otherwise globalSetup's
    // Python already occupies 8000 → isPortAvailable returns false → startBackend
    // rejects → Electron never starts. (must_fix #8 / PRD AC-P0-18.4)
    if (process.env.WRITER_E2E_EXTERNAL_BACKEND === '1') {
      console.log('[Electron] External backend mode (env gate honored, skip spawning)');
      return resolve();
    }
    // Check if port is already in use before spawning backend
    const portAvailable = await isPortAvailable(BACKEND_PORT, BACKEND_HOST);
    if (!portAvailable) {
      const msg = `端口 ${BACKEND_PORT} 已被占用，请关闭占用该端口的程序后重试。`;
      console.error(`[Electron] ${msg}`);
      reject(new Error(msg));
      return;
    }

    const { backendPath, launcherPath } = getBackendPaths();

    if (!fs.existsSync(backendPath)) {
      reject(new Error(`Backend directory not found: ${backendPath}`));
      return;
    }
    if (!fs.existsSync(launcherPath)) {
      reject(new Error(`Launcher script not found: ${launcherPath}`));
      return;
    }

    const pythonCmd = findPython();
    console.log(`[Electron] Using Python: ${pythonCmd}`);
    console.log(`[Electron] Backend path: ${backendPath}`);
    console.log(`[Electron] Launcher path: ${launcherPath}`);

    // Set environment for the backend
    const env = {
      ...process.env,
      WRITER_ELECTRON_MODE: '1',
      WRITER_DATA_DIR: path.join(app.getPath('userData'), 'data'),
    };

    backendProcess = spawn(pythonCmd, [
      launcherPath,
      BACKEND_HOST,
      BACKEND_PORT.toString(),
    ], {
      cwd: backendPath,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Detach on Unix so SIGTERM doesn't propagate to Python
      detached: process.platform !== 'win32',
    });

    backendProcess.on('error', (err) => {
      console.error('[Electron] Backend process error:', err);
      reject(new Error(`无法启动 Python 后端: ${err.message}\n请确认已安装 Python 并创建了 venv`));
    });

    backendProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.log(`[Backend] ${line}`);
        }
      }
    });

    backendProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.error(`[Backend] ${line}`);
        }
      }
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`[Electron] Backend process exited with code ${code}, signal ${signal}`);
      backendProcess = null;

      if (!isShuttingDown) {
        console.error('[Electron] Backend crashed unexpectedly. Scheduling restart...');
        scheduleBackendRestart();
      }
    });

    // Wait for backend to be ready
    waitForBackend(BACKEND_PORT, 45000)
      .then(() => {
        console.log('[Electron] Backend is ready');
        backendRestartCount = 0;
        startHealthCheck();
        resolve();
      })
      .catch((err) => {
        console.error('[Electron] Backend failed to start:', err);
        stopBackend();
        reject(err);
      });
  });
}

function stopBackend(): void {
  if (backendRestartTimer) {
    clearTimeout(backendRestartTimer);
    backendRestartTimer = null;
  }
  stopHealthCheck();

  if (backendProcess) {
    console.log('[Electron] Stopping backend process...');
    if (process.platform === 'win32') {
      if (backendProcess.pid) {
        try {
          spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t']);
        } catch (err) {
          console.error('[Electron] taskkill failed:', err);
        }
      }
    } else {
      // Try graceful shutdown first
      try {
        process.kill(-backendProcess.pid!, 'SIGTERM');
      } catch {
        backendProcess.kill('SIGTERM');
      }
      // Force kill after 5 seconds
      setTimeout(() => {
        try {
          if (backendProcess && !backendProcess.killed) {
            process.kill(-backendProcess.pid!, 'SIGKILL');
          }
        } catch {
          backendProcess?.kill('SIGKILL');
        }
      }, 5000);
    }
    backendProcess = null;
  }
}

function scheduleBackendRestart(): void {
  if (isShuttingDown) return;

  backendRestartCount++;
  const maxRestarts = 5;
  const delayMs = Math.min(1000 * Math.pow(2, backendRestartCount - 1), 30000);

  if (backendRestartCount > maxRestarts) {
    console.error(`[Electron] Backend has crashed ${maxRestarts} times. Giving up.`);
    dialog.showErrorBox(
      '后端服务异常',
      'Python 后端服务多次启动失败，请检查环境配置后重启应用。'
    );
    return;
  }

  console.log(`[Electron] Will attempt to restart backend in ${delayMs}ms (attempt ${backendRestartCount}/${maxRestarts})`);

  backendRestartTimer = setTimeout(async () => {
    if (isShuttingDown) return;
    try {
      await startBackend();
      console.log('[Electron] Backend restarted successfully');
    } catch (err) {
      console.error('[Electron] Backend restart failed:', err);
    }
  }, delayMs);
}

// ============================================
// Backend Health Check
// ============================================

function startHealthCheck(): void {
  stopHealthCheck();

  let consecutiveFailures = 0;
  const MAX_FAILURES = 3;

  healthCheckTimer = setInterval(() => {
    if (isShuttingDown || !backendProcess) return;

    const req = http.get(
      `http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1/health`,
      { timeout: 5000 },
      (res) => {
        if (res.statusCode === 200) {
          consecutiveFailures = 0;
        } else {
          console.warn(`[Electron] Backend health check returned ${res.statusCode}`);
          consecutiveFailures++;
        }
      }
    );

    req.on('error', (err) => {
      console.warn('[Electron] Backend health check failed:', err.message);
      consecutiveFailures++;

      // Only restart after consecutive failures to avoid false positives
      if (consecutiveFailures >= MAX_FAILURES && backendProcess && !backendProcess.killed) {
        console.error(`[Electron] Backend is unresponsive (${MAX_FAILURES} consecutive failures). Restarting...`);
        stopBackend();
        scheduleBackendRestart();
        consecutiveFailures = 0;
      }
    });

    req.on('timeout', () => {
      req.destroy();
      consecutiveFailures++;
    });
  }, 30000); // Check every 30 seconds
}

function stopHealthCheck(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

// ============================================
// Backend Readiness Polling
// ============================================

function waitForBackend(port: number, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const pollInterval = 500;
    let attempts = 0;

    const check = () => {
      attempts++;
      const elapsed = Date.now() - startTime;

      if (elapsed > timeout) {
        reject(new Error(`后端服务启动超时 (${timeout}ms)。请检查 Python 环境是否正确配置。`));
        return;
      }

      // Log progress every ~5 seconds
      if (attempts % 10 === 0) {
        console.log(`[Electron] Waiting for backend... (${Math.round(elapsed / 1000)}s / ${Math.round(timeout / 1000)}s)`);
      }

      const req = http.get(
        `http://${BACKEND_HOST}:${port}/api/v1/health`,
        { timeout: 3000 },
        (res) => {
          if (res.statusCode === 200) {
            console.log(`[Electron] Backend ready after ${elapsed}ms (${attempts} attempts)`);
            resolve();
          } else {
            setTimeout(check, pollInterval);
          }
        }
      );

      req.on('error', () => {
        setTimeout(check, pollInterval);
      });

      req.on('timeout', () => {
        req.destroy();
        setTimeout(check, pollInterval);
      });
    };

    check();
  });
}

// ============================================
// Window Management
// ============================================

function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Simple HTML splash screen
  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          padding: 0;
          width: 400px;
          height: 300px;
          background: linear-gradient(135deg, #1a1510 0%, #2a1f14 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #f5f0e6;
          border-radius: 12px;
          overflow: hidden;
        }
        .logo {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .subtitle {
          font-size: 13px;
          color: #a0a0a0;
          margin-bottom: 24px;
        }
        .status {
          font-size: 12px;
          color: #c9a96e;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .progress-bar {
          width: 200px;
          height: 3px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          margin-top: 16px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          width: 0%;
          background: #c9a96e;
          border-radius: 2px;
          animation: progress 2s ease-in-out infinite;
        }
        @keyframes progress {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="logo">✍️</div>
      <div class="title">Writer</div>
      <div class="subtitle">自动化写作软件</div>
      <div class="status" id="status">正在启动后端服务...</div>
      <div class="progress-bar"><div class="progress-fill"></div></div>
    </body>
    </html>
  `;

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  splash.once('ready-to-show', () => splash.show());
  return splash;
}

function updateSplashStatus(message: string): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(`
      document.getElementById('status').textContent = ${JSON.stringify(message)};
    `).catch(() => {});
  }
}

function closeSplashWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

async function createWindow(): Promise<void> {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1024,
    minHeight: 768,
    title: 'Writer - 自动化写作软件',
    backgroundColor: '#1a1510',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Restore maximized/fullscreen state
  if (state.isMaximized) {
    mainWindow.maximize();
  }
  if (state.isFullScreen) {
    mainWindow.setFullScreen(true);
  }

  // Save state on changes
  const saveStateDebounced = debounce(saveWindowState, 500);
  mainWindow.on('resize', saveStateDebounced);
  mainWindow.on('move', saveStateDebounced);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);
  mainWindow.on('enter-full-screen', saveWindowState);
  mainWindow.on('leave-full-screen', saveWindowState);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    closeSplashWindow();
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the app
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'frontend-build', 'index.html'));
  }
}

// ============================================
// IPC Handlers
// ============================================

function registerIpcHandlers(): void {
  // Backend URL - renderer uses this to know where the API is
  ipcMain.handle('get-backend-url', () => {
    return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
  });

  // Backend status
  ipcMain.handle('get-backend-status', async () => {
    return new Promise((resolve) => {
      const req = http.get(
        `http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1/health`,
        { timeout: 3000 },
        (res) => {
          resolve({
            running: true,
            healthy: res.statusCode === 200,
            port: BACKEND_PORT,
            pid: backendProcess?.pid ?? null,
          });
        }
      );
      req.on('error', () => {
        resolve({
          running: false,
          healthy: false,
          port: BACKEND_PORT,
          pid: null,
        });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({
          running: false,
          healthy: false,
          port: BACKEND_PORT,
          pid: null,
        });
      });
    });
  });

  // Restart backend (for manual recovery)
  ipcMain.handle('restart-backend', async () => {
    console.log('[Electron] Manual backend restart requested');
    stopBackend();
    backendRestartCount = 0;
    try {
      await startBackend();
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });

  // API key management
  ipcMain.handle('get-api-key', () => cachedApiKey);
  ipcMain.handle('set-api-key', (_, key: string) => { cachedApiKey = key; });

  // External links
  ipcMain.handle('open-external', (_, url: string) => shell.openExternal(url));

  // File dialogs
  ipcMain.handle('show-save-dialog', async (_, options: Electron.SaveDialogOptions) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('show-open-dialog', async (_, options: Electron.OpenDialogOptions) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? null : result.filePaths;
  });

  // File operations
  ipcMain.handle('read-file', async (_, filePath: string) => {
    return fs.promises.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return true;
  });

  // App info
  ipcMain.handle('get-app-info', () => ({
    version: app.getVersion(),
    name: app.getName(),
    isDev,
    platform: process.platform,
  }));

  // Window controls
  ipcMain.on('minimize-window', () => mainWindow?.minimize());
  ipcMain.on('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('close-window', () => mainWindow?.close());
  ipcMain.handle('is-maximized', () => mainWindow?.isMaximized() ?? false);

  // AI log IPC (US-018) — write structured AI call events to userData/ai-log.jsonl
  const aiLogPath = path.join(app.getPath('userData'), 'ai-log.jsonl');
  ipcMain.handle('ai-log:append', async (_, payload: any) => {
    try {
      const line = JSON.stringify({
        timestamp: payload.timestamp ?? new Date().toISOString(),
        journeyId: payload.journeyId ?? null,
        stageId: payload.stageId ?? null,
        action: payload.action ?? 'unknown',
        prompt: payload.prompt ?? null,
        response: payload.response ?? null,
        latencyMs: payload.latencyMs ?? null,
        tokenCount: payload.tokenCount ?? null,
        correlationId: payload.correlationId ?? null,
      }) + '\n';
      await fs.promises.appendFile(aiLogPath, line, 'utf-8');
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Electron] ai-log:append failed:', msg);
      return { success: false, error: msg };
    }
  });
}

// ============================================
// Utilities
// ============================================

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ============================================
// App Lifecycle
// ============================================

app.whenReady().then(async () => {
  console.log('[Electron] App ready, mode:', isDev ? 'development' : 'production');

  registerIpcHandlers();

  // Show splash screen while backend starts
  splashWindow = createSplashWindow();

  try {
    updateSplashStatus('正在启动 Python 后端服务...');
    await startBackend();
    updateSplashStatus('正在加载应用界面...');
    await createWindow();
  } catch (err) {
    console.error('[Electron] Failed to start:', err);
    const msg = err instanceof Error ? err.message : String(err);
    closeSplashWindow();
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
  isShuttingDown = true;
  closeSplashWindow();
  saveWindowState();
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isShuttingDown = true;
  closeSplashWindow();
  saveWindowState();
  stopBackend();
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Electron] Unhandled rejection:', reason);
});

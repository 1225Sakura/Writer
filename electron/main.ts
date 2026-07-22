/**
 * Electron Main Process
 * Handles window management, IPC communication, Python backend process management,
 * backend health monitoring, auto-restart, and window state persistence.
 *
 * v0.5 Phase 2.2: console.* replaced with electron-log for file rotation
 * (10MB × 3) and unified redact pipeline. Redaction already enforced by
 * the ai-log IPC handler (P0-Sec4c); we rely on electron-log's
 * built-in redact patterns plus our own.
 */

import { app, BrowserWindow, ipcMain, session, shell, dialog, screen } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import crypto from 'crypto';
import log from 'electron-log/main';

// ============================================================
// electron-log configuration (v0.5 Phase 2.2)
// ============================================================

// Route everything through the main process logger.
log.initialize();

// File transport — write to userData/logs/main.log with 10MB rotation.
// electron-log automatically keeps `main.log.1` ... `main.log.3` etc.
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB per file
log.transports.file.fileName = 'main.log';
// Keep at most 3 rotated files (electron-log retention default is fine).
log.transports.file.archiveLogFn = (file: { path: string }) => {
  // Default archive appends a timestamp; we override to plain rotation.
  file.path = file.path.replace('main.log', `main.${Date.now()}.log`);
  return file.path;
};

// Console transport — keep colors when stdout is a TTY (dev only).
// (electron-log v5 writes to stderr by default; no `useStderr` toggle.)
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
log.transports.file.level = 'info';

// Redact sensitive payloads before writing to disk. electron-log
// applies these patterns to both file and console transports.
log.variables.redact = [
  'sk-[a-zA-Z0-9]{20,}',
  'sk-ant-[a-zA-Z0-9-]{20,}',
  'token=[a-zA-Z0-9_-]{8,}',
  'api_key=[a-zA-Z0-9_-]{8,}',
  'prompt',
  'response',
  'api[_-]?key',
  'authorization',
  'cookie',
];

// Ensure userData/logs exists with 0600 permissions (P-MINIMAL-SECRET).
try {
  const logsDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  try { fs.chmodSync(logsDir, 0o700); } catch { /* best-effort on Windows */ }
  // Set the file transport's resolved path so electron-log knows where to write.
  // electron-log picks the correct path under userData by default, so we don't
  // override the file location — we just ensure the directory.
} catch {
  // Ignore — logging will still work via stderr fallback.
}

// Replace the implicit console bridge in main process so any unhooked
// console.* still flows through electron-log. (v0.5 Phase 2.2 hardening.)
// We do NOT monkey-patch console here to keep behavior predictable;
// instead, all code paths use `log.*` directly. The narrow exception is
// when a third-party library uses `console.*` from the main module
// scope — those will surface in electron stderr only.

// ===== v0.4 P0-Sec3: Dialog Token System =====
// Replaces path-based IPC readFile/writeFile with token-based to prevent CWE-22 Path Traversal.
// Tokens are 256-bit cryptographic random, mapped to dialog-returned paths in main process only.
// Renderer cannot forge paths — only main process issues tokens after showSaveDialog/showOpenDialog.
interface DialogToken {
  token: string;
  path: string;
  createdAt: number;
  mode: 'read' | 'write';
}
const TOKEN_TTL_MS = 60_000; // 60 seconds
const TOKEN_MAX_ENTRIES = 256; // LRU cap
const tokenMap = new Map<string, DialogToken>();

function issueDialogToken(filePath: string, mode: 'read' | 'write'): string {
  const token = crypto.randomBytes(32).toString('hex');
  tokenMap.set(token, { token, path: filePath, createdAt: Date.now(), mode });
  // LRU eviction
  if (tokenMap.size > TOKEN_MAX_ENTRIES) {
    const oldest = [...tokenMap.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldest) tokenMap.delete(oldest[0]);
  }
  return token;
}

function consumeDialogToken(token: string, mode: 'read' | 'write'): string | null {
  const entry = tokenMap.get(token);
  if (!entry) return null;
  if (entry.mode !== mode) return null;
  if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
    tokenMap.delete(token);
    return null;
  }
  // Single-use for write tokens; read tokens reusable within TTL
  if (mode === 'write') tokenMap.delete(token);
  return entry.path;
}

// ===== v0.4 P0-Sec3: URL Scheme Allowlist =====
const ALLOWED_EXTERNAL_SCHEMES = new Set(['https:', 'http:']);
function validateExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_EXTERNAL_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}

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
    log.error('[Electron] Failed to load window state:', err);
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
    log.error('[Electron] Failed to save window state:', err);
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
      log.info('[Electron] External backend mode (env gate honored, skip spawning)');
      return resolve();
    }
    // Check if port is already in use before spawning backend
    const portAvailable = await isPortAvailable(BACKEND_PORT, BACKEND_HOST);
    if (!portAvailable) {
      const msg = `端口 ${BACKEND_PORT} 已被占用，请关闭占用该端口的程序后重试。`;
      log.error(`[Electron] ${msg}`);
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
    log.info(`[Electron] Using Python: ${pythonCmd}`);
    log.info(`[Electron] Backend path: ${backendPath}`);
    log.info(`[Electron] Launcher path: ${launcherPath}`);

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
      log.error('[Electron] Backend process error:', err);
      reject(new Error(`无法启动 Python 后端: ${err.message}\n请确认已安装 Python 并创建了 venv`));
    });

    backendProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          log.info(`[Backend] ${line}`);
        }
      }
    });

    backendProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          log.error(`[Backend] ${line}`);
        }
      }
    });

    backendProcess.on('exit', (code, signal) => {
      log.info(`[Electron] Backend process exited with code ${code}, signal ${signal}`);
      backendProcess = null;

      if (!isShuttingDown) {
        log.error('[Electron] Backend crashed unexpectedly. Scheduling restart...');
        scheduleBackendRestart();
      }
    });

    // Wait for backend to be ready
    waitForBackend(BACKEND_PORT, 45000)
      .then(() => {
        log.info('[Electron] Backend is ready');
        backendRestartCount = 0;
        startHealthCheck();
        resolve();
      })
      .catch((err) => {
        log.error('[Electron] Backend failed to start:', err);
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
    log.info('[Electron] Stopping backend process...');
    if (process.platform === 'win32') {
      if (backendProcess.pid) {
        try {
          spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t']);
        } catch (err) {
          log.error('[Electron] taskkill failed:', err);
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
    log.error(`[Electron] Backend has crashed ${maxRestarts} times. Giving up.`);
    dialog.showErrorBox(
      '后端服务异常',
      'Python 后端服务多次启动失败，请检查环境配置后重启应用。'
    );
    return;
  }

  log.info(`[Electron] Will attempt to restart backend in ${delayMs}ms (attempt ${backendRestartCount}/${maxRestarts})`);

  backendRestartTimer = setTimeout(async () => {
    if (isShuttingDown) return;
    try {
      await startBackend();
      log.info('[Electron] Backend restarted successfully');
    } catch (err) {
      log.error('[Electron] Backend restart failed:', err);
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
          log.warn(`[Electron] Backend health check returned ${res.statusCode}`);
          consecutiveFailures++;
        }
      }
    );

    req.on('error', (err) => {
      log.warn('[Electron] Backend health check failed:', err.message);
      consecutiveFailures++;

      // Only restart after consecutive failures to avoid false positives
      if (consecutiveFailures >= MAX_FAILURES && backendProcess && !backendProcess.killed) {
        log.error(`[Electron] Backend is unresponsive (${MAX_FAILURES} consecutive failures). Restarting...`);
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
        log.info(`[Electron] Waiting for backend... (${Math.round(elapsed / 1000)}s / ${Math.round(timeout / 1000)}s)`);
      }

      const req = http.get(
        `http://${BACKEND_HOST}:${port}/api/v1/health`,
        { timeout: 3000 },
        (res) => {
          if (res.statusCode === 200) {
            log.info(`[Electron] Backend ready after ${elapsed}ms (${attempts} attempts)`);
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
    log.info('[Electron] Manual backend restart requested');
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
  // v0.4 P0-Sec3: open-external validates URL scheme (no file:// / javascript: / data:)
  ipcMain.handle('open-external', async (_, url: string) => {
    if (!validateExternalUrl(url)) {
      throw new Error(`Blocked external URL with disallowed scheme: ${url.slice(0, 50)}`);
    }
    await shell.openExternal(url);
  });

  // File dialogs — return token instead of raw path (P0-Sec3 token system)
  ipcMain.handle('show-save-dialog', async (_, options: Electron.SaveDialogOptions) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, options);
    if (result.canceled || !result.filePath) return null;
    const token = issueDialogToken(result.filePath, 'write');
    return { token, path: result.filePath };
  });

  ipcMain.handle('show-open-dialog', async (_, options: Electron.OpenDialogOptions) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, options);
    if (result.canceled || result.filePaths.length === 0) return null;
    const tokens = result.filePaths.map((p) => ({
      token: issueDialogToken(p, 'read'),
      path: p,
    }));
    return tokens;
  });

  // File operations — accept token only, not arbitrary path (CWE-22 mitigation)
  ipcMain.handle('read-file', async (_, token: string) => {
    const filePath = consumeDialogToken(token, 'read');
    if (!filePath) throw new Error('Invalid or expired dialog token');
    return fs.promises.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('write-file', async (_, token: string, content: string) => {
    const filePath = consumeDialogToken(token, 'write');
    if (!filePath) throw new Error('Invalid or expired dialog token');
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

  // AI log IPC (v0.4 P0-Sec4c) — default no-op per P-MINIMAL-SECRET; WRITER_AI_LOG=1 to enable
  const aiLogDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(aiLogDir, { recursive: true });
  const aiLogPath = path.join(aiLogDir, 'ai-log.jsonl');

  // Redact: hash + truncate sensitive fields; never log raw key/url-token
  function redactAiLog<T extends Record<string, unknown>>(record: T): T {
    const out = { ...record } as Record<string, unknown>;
    const secretPatterns: Array<[RegExp, string]> = [
      [/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED-sk]'],
      [/sk-ant-[a-zA-Z0-9-]{20,}/g, '[REDACTED-sk-ant]'],
      [/token=[a-zA-Z0-9_-]{8,}/g, 'token=[REDACTED]'],
      [/api_key=[a-zA-Z0-9_-]{8,}/g, 'api_key=[REDACTED]'],
    ];
    function redactString(s: string): string {
      let r = s;
      for (const [pat, rep] of secretPatterns) r = r.replace(pat, rep);
      return r;
    }
    for (const k of Object.keys(out)) {
      const v = out[k];
      if (typeof v === 'string') {
        if (v.length > 200 && (k === 'prompt' || k === 'response' || k === 'content')) {
          const hash = require('crypto').createHash('sha256').update(v).digest('hex').slice(0, 16);
          out[k] = `[TRUNCATED:${v.length}:sha256=${hash}] ${redactString(v.slice(0, 200))}...`;
        } else {
          out[k] = redactString(v);
        }
      }
    }
    return out as T;
  }

  // Rotation: keep 3 files of 10MB each
  async function rotateAiLogIfNeeded(): Promise<void> {
    try {
      const stat = await fs.promises.stat(aiLogPath).catch(() => null);
      if (!stat || stat.size < 10 * 1024 * 1024) return;
      const ts = Date.now();
      await fs.promises.rename(aiLogPath, `${aiLogPath}.${ts}.1`).catch(() => {});
      const dir = await fs.promises.readdir(aiLogDir).catch(() => []);
      const backups = dir.filter((f) => f.startsWith('ai-log.jsonl.')).sort();
      while (backups.length > 3) {
        await fs.promises.unlink(path.join(aiLogDir, backups.shift()!)).catch(() => {});
      }
    } catch {/* ignore */}
  }

  ipcMain.handle('ai-log:append', async (_, payload: any) => {
    if (process.env.WRITER_AI_LOG !== '1') {
      return { success: true, skipped: true };
    }
    try {
      await rotateAiLogIfNeeded();
      const redacted = redactAiLog({
        timestamp: payload.timestamp ?? new Date().toISOString(),
        journeyId: payload.journeyId ?? null,
        stageId: payload.stageId ?? null,
        action: payload.action ?? 'unknown',
        prompt: payload.prompt ?? null,
        response: payload.response ?? null,
        latencyMs: payload.latencyMs ?? null,
        tokenCount: payload.tokenCount ?? null,
        correlationId: payload.correlationId ?? null,
      });
      const line = JSON.stringify(redacted) + '\n';
      await fs.promises.appendFile(aiLogPath, line, 'utf-8');
      // chmod 0o600 on each write (P-MINIMAL-SECRET)
      await fs.promises.chmod(aiLogPath, 0o600);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('[Electron] ai-log:append failed:', msg);
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
  log.info('[Electron] App ready, mode:', isDev ? 'development' : 'production');

  // v0.4 P0-Sec7: CSP injection at session level (applies to all webContents)
  // Tiptap + Framer Motion temporary allowed 'unsafe-inline'; future nonce/hash migration
  const cspValue = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws://127.0.0.1:8000 https://api.openai.com https://api.anthropic.com https://api.mistral.ai https://generativelanguage.googleapis.com",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspValue],
      },
    })
  })

  registerIpcHandlers();

  // Show splash screen while backend starts
  splashWindow = createSplashWindow();

  try {
    updateSplashStatus('正在启动 Python 后端服务...');
    await startBackend();
    updateSplashStatus('正在加载应用界面...');
    await createWindow();
  } catch (err) {
    log.error('[Electron] Failed to start:', err);
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
  log.error('[Electron] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  log.error('[Electron] Unhandled rejection:', reason);
});

#!/usr/bin/env node
/**
 * OpenAPI contract checker.
 *
 * Boots the FastAPI backend in a Python subprocess, extracts the OpenAPI
 * manifest, then scans the frontend's api/*.ts files for axios/fetch URLs
 * and reports drift (frontend URL that doesn't match any backend path).
 *
 * Usage:
 *   node scripts/check-openapi.mjs
 *
 * Exit codes:
 *   0  - no drift detected
 *   1  - drift detected (frontend references missing backend paths)
 *   2  - python or backend unavailable (skip with message)
 *
 * Cross-platform: pure Node.js, no shell-specific syntax. The .sh and .ps1
 * wrappers are thin aliases to this script.
 */
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");
const BACKEND_DIR = join(REPO_ROOT, "src", "backend");
const FRONTEND_API_DIR = join(REPO_ROOT, "src", "frontend", "src", "api");

// ---------------------------------------------------------------------------
// 1. Boot Python + extract OpenAPI manifest as JSON
// ---------------------------------------------------------------------------

async function extractOpenAPIManifest() {
  // Allow override via WRITER_PYTHON env var (CI uses system python;
  // local Windows dev may need to point at a venv or specific interpreter
  // if the default has ssl/site-packages issues).
  const pythonCmd = process.env.WRITER_PYTHON || "python";

  // Build child env. We strip PYTHONPATH/PYTHONHOME so QGIS-bundled Python
  // doesn't get confused by stale env from npm/git-bash. The user's pip
  // site-packages are typically already on QGIS Python's sys.path; if not,
  // they can pass them via PYTHONPATH explicitly (we keep that var if set).
  const childEnv = { ...process.env };
  // On Windows with QGIS-bundled Python, PYTHONHOME must remain unset or
  // match QGIS's bundle. We don't touch it; just ensure PYTHONPATH is sane.
  if (process.platform === "win32" && pythonCmd.toLowerCase().includes("qgis")) {
    // Don't override PYTHONPATH for QGIS Python; it has its own bundled paths.
    // But if a site-packages dir was passed explicitly via QGIS_PYTHONPATH,
    // we honor it.
    if (process.env.QGIS_PYTHONPATH) {
      childEnv.PYTHONPATH = process.env.QGIS_PYTHONPATH;
    } else {
      delete childEnv.PYTHONPATH;
    }
  }

  return new Promise((resolve, reject) => {
    const py = spawn(
      pythonCmd,
      [
        "-c",
        "import json; from app.main import app; print(json.dumps(app.openapi()))",
      ],
      { cwd: BACKEND_DIR, env: childEnv }
    );
    let stdout = "";
    let stderr = "";
    py.stdout.on("data", (d) => (stdout += d.toString()));
    py.stderr.on("data", (d) => (stderr += d.toString()));
    py.on("error", (err) => {
      // python not found
      reject(new Error(`python not available: ${err.message}`));
    });
    py.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`python exit ${code}: ${stderr}`));
        return;
      }
      try {
        const manifest = JSON.parse(stdout);
        resolve(manifest);
      } catch (e) {
        reject(new Error(`failed to parse manifest: ${e.message}\n${stdout.slice(0, 500)}`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 2. Normalize backend paths → replace {param} with regex
// ---------------------------------------------------------------------------

function normalizeBackendPath(path) {
  // /api/v1/chapters/{chapter_id}/drafts → /api/v1/chapters/<param>/drafts
  return path.replace(/\{[^}]+\}/g, "<param>");
}

// Frontend URLs are written relative to /api/v1 (the request helper prepends
// it). Normalize by prepending /api/v1 if missing, so we can compare directly
// against backend manifest paths.
function frontendUrlToBackendPath(frontendUrl) {
  if (frontendUrl.startsWith("/api/v1/")) return frontendUrl;
  if (frontendUrl.startsWith("/auth/")) return frontendUrl; // auth mounted at root
  if (frontendUrl.startsWith("/")) return `/api/v1${frontendUrl}`;
  return `/api/v1/${frontendUrl}`;
}

// ---------------------------------------------------------------------------
// 3. Build a regex matcher: convert normalized path → regex
// ---------------------------------------------------------------------------

function pathToRegex(normalizedPath) {
  // Escape regex special chars, then replace placeholder
  const escaped = normalizedPath
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/<param>/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}

// ---------------------------------------------------------------------------
// 4. Extract URLs from frontend api/*.ts files
// ---------------------------------------------------------------------------

function extractFrontendUrls() {
  const urls = [];
  let files;
  try {
    files = readdirSync(FRONTEND_API_DIR);
  } catch (e) {
    console.error(`Cannot read ${FRONTEND_API_DIR}: ${e.message}`);
    return urls;
  }
  for (const file of files) {
    if (!file.endsWith(".ts") || file === "request.ts" || file === "index.ts") {
      continue;
    }
    const filePath = join(FRONTEND_API_DIR, file);
    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch (e) {
      continue;
    }
    // Match template literals and string literals in api.get/post/put/delete/patch calls
    // Pattern: api\.(get|post|put|delete|patch)\s*<[^>]*>\s*\(\s*[`"']([^`"']+)[`"']
    const re =
      /api\.(?:get|post|put|delete|patch)\s*<[^>]*>\s*\(\s*[`"']([^`"']+)[`"']/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      urls.push({ file: relative(REPO_ROOT, filePath), url: m[1] });
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// 5. Match each frontend URL against backend paths
// ---------------------------------------------------------------------------

function matchUrl(frontendUrl, backendRegexes) {
  for (const { regex } of backendRegexes) {
    if (regex.test(frontendUrl)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("[check-openapi] Bootstrapping FastAPI OpenAPI manifest...");
  let manifest;
  try {
    manifest = await extractOpenAPIManifest();
  } catch (e) {
    console.error(`[check-openapi] SKIP: ${e.message}`);
    process.exit(2);
  }
  const backendPaths = Object.keys(manifest.paths || {});
  const backendRegexes = backendPaths.map((p) => ({
    raw: p,
    normalized: normalizeBackendPath(p),
    regex: pathToRegex(normalizeBackendPath(p)),
  }));

  console.log(
    `[check-openapi] Backend has ${backendPaths.length} paths in OpenAPI manifest.`
  );

  const frontendUrls = extractFrontendUrls();
  console.log(
    `[check-openapi] Found ${frontendUrls.length} frontend api URLs.`
  );

  const drift = [];
  for (const { file, url } of frontendUrls) {
    // Normalize template literals: replace ${var} with <param> so we can match.
    const interpolated = url.replace(/\$\{[^}]+\}/g, "<param>");
    const normalized = normalizeBackendPath(frontendUrlToBackendPath(interpolated));
    if (!matchUrl(normalized, backendRegexes)) {
      drift.push({ file, url, normalized });
    }
  }

  if (drift.length === 0) {
    console.log("[check-openapi] OK: all frontend URLs match backend paths.");
    process.exit(0);
  }

  console.error(
    `[check-openapi] DRIFT DETECTED: ${drift.length} frontend URL(s) without backend match.`
  );
  for (const { file, url, normalized } of drift) {
    console.error(`  ${file}: ${url}  (normalized: ${normalized})`);
  }
  console.error(
    "\nFix: implement the missing backend route, or remove the frontend call."
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(`[check-openapi] FATAL: ${e.message}`);
  process.exit(2);
});

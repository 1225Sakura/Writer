# scripts/start-services.ps1 — US-020 (manual dev helper, Windows).
#
# Starts the two long-running processes that the desktop app expects:
#   - Vite dev server on :5173  (frontend)
#   - Python FastAPI backend on :8000 (electron_launcher.py)
#
# Usage:
#   .\scripts\start-services.ps1           # both
#   .\scripts\start-services.ps1 -Frontend # vite only
#   .\scripts\start-services.ps1 -Backend  # uvicorn only
#
# Manual helper for local development. The Playwright test runner spawns
# these processes itself via `webServer` and `globalSetup`.
[CmdletBinding()]
param(
    [switch]$Frontend,
    [switch]$Backend
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $FrontendDir 'src\backend'

$VitePort = if ($env:VITE_PORT) { $env:VITE_PORT } else { '5173' }
$BackendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { '8000' }

function Start-Frontend {
    Write-Host "[start-services] launching vite on :$VitePort"
    Push-Location $FrontendDir
    try { npm run dev -- --port $VitePort } finally { Pop-Location }
}

function Start-Backend {
    $PythonBin = Join-Path $BackendDir '.venv\Scripts\python.exe'
    if (-not (Test-Path $PythonBin)) {
        $PythonBin = (Get-Command python).Source
    }
    Write-Host "[start-services] launching python backend on :$BackendPort"
    Push-Location $BackendDir
    try {
        & $PythonBin electron_launcher.py 127.0.0.1 $BackendPort
    } finally {
        Pop-Location
    }
}

$target = if ($Frontend -and -not $Backend) { 'frontend' }
          elseif ($Backend -and -not $Frontend) { 'backend' }
          else { 'all' }

switch ($target) {
    'frontend' { Start-Frontend }
    'backend'  { Start-Backend }
    'all' {
        $backendJob = Start-Job -ScriptBlock {
            param($BackendDir, $BackendPort)
            Set-Location $BackendDir
            $py = Join-Path $BackendDir '.venv\Scripts\python.exe'
            if (-not (Test-Path $py)) { $py = (Get-Command python).Source }
            & $py electron_launcher.py 127.0.0.1 $BackendPort
        } -ArgumentList $BackendDir, $BackendPort

        $frontendJob = Start-Job -ScriptBlock {
            param($FrontendDir, $VitePort)
            Set-Location $FrontendDir
            npm run dev -- --port $VitePort
        } -ArgumentList $FrontendDir, $VitePort

        Write-Host "[start-services] backend job=$($backendJob.Id) frontend job=$($frontendJob.Id)"
        try {
            Wait-Job $backendJob, $frontendJob | Out-Null
            Receive-Job $backendJob -Keep
            Receive-Job $frontendJob -Keep
        } finally {
            Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
            Remove-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
        }
    }
}
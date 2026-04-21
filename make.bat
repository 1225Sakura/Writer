@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: Writer - 自动化写作软件 (Windows Build Script)
:: Fallback when GNU make is not available
:: If make is installed (Git Bash, MSYS2), it will be used instead
:: ============================================================

set "VERSION="
for /f "delims=" %%a in ('node -p "require('./electron/package.json').version" 2^>nul') do set "VERSION=%%a"
if "%VERSION%"=="" set "VERSION=1.0.0"

:: Check if GNU make is available
where make >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    make %*
    goto :eof
)

:: Parse command
set "COMMAND=%~1"
if "%COMMAND%"=="" goto :help
if "%COMMAND%"=="help" goto :help

:: Dispatch
if "%COMMAND%"=="install"      goto :install
if "%COMMAND%"=="dev"          goto :dev
if "%COMMAND%"=="backend"      goto :backend
if "%COMMAND%"=="frontend"     goto :frontend
if "%COMMAND%"=="electron"     goto :electron
if "%COMMAND%"=="build"        goto :build
if "%COMMAND%"=="package"      goto :package
if "%COMMAND%"=="package-win"  goto :package
if "%COMMAND%"=="test"         goto :test
if "%COMMAND%"=="lint"         goto :lint
if "%COMMAND%"=="typecheck"    goto :typecheck
if "%COMMAND%"=="version"      goto :version
if "%COMMAND%"=="version-sync" goto :version_sync
if "%COMMAND%"=="bump-patch"   goto :bump_patch
if "%COMMAND%"=="bump-minor"   goto :bump_minor
if "%COMMAND%"=="bump-major"   goto :bump_major
if "%COMMAND%"=="clean"        goto :clean
if "%COMMAND%"=="docker-build" goto :docker_build
if "%COMMAND%"=="docker-up"    goto :docker_up
if "%COMMAND%"=="docker-down"  goto :docker_down
if "%COMMAND%"=="db-migrate"   goto :db_migrate
if "%COMMAND%"=="db-rollback"  goto :db_rollback

echo Unknown command: %COMMAND%
goto :help

:help
echo.
echo  Writer - 自动化写作软件
echo  Version: %VERSION%
echo.
echo  Development:
echo    make install       Install all dependencies
echo    make dev           Start backend + frontend dev servers
echo    make backend       Start backend dev server
echo    make frontend      Start frontend dev server
echo    make electron      Start Electron dev mode
echo.
echo  Build ^& Package:
echo    make build         Build production
echo    make package       Build Windows installer
echo    make package-win   Build Windows installer
echo.
echo  Version Management:
echo    make version       Show current version
echo    make version-sync  Sync version to all modules
echo    make bump-patch    Bump patch version
echo    make bump-minor    Bump minor version
echo    make bump-major    Bump major version
echo.
echo  Quality:
echo    make test          Run backend tests
echo    make lint          Run frontend lint
echo    make typecheck     Run TypeScript check
echo.
echo  Docker:
echo    make docker-build  Build Docker images
echo    make docker-up     Start Docker services
echo    make docker-down   Stop Docker services
echo.
echo  Database:
echo    make db-migrate    Run migrations
echo    make db-rollback   Rollback last migration
echo.
echo  Maintenance:
echo    make clean         Clean build artifacts
goto :eof

:: ============================================================
:: Development
:: ============================================================
:install
echo [install] Installing dependencies...
cd src\backend && pip install -r requirements.txt
cd ..\..\src\frontend && npm install
cd ..\..\electron && npm install
cd ..\..
goto :eof

:dev
echo [dev] Starting development mode...
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
start "Backend" cmd /C "cd src\backend && uvicorn main:app --reload --port 8000"
timeout /t 2 >nul
start "Frontend" cmd /C "cd src\frontend && npm run dev"
goto :eof

:backend
echo [backend] Starting backend server...
cd src\backend && uvicorn main:app --reload --port 8000
goto :eof

:frontend
echo [frontend] Starting frontend dev server...
cd src\frontend && npm run dev
goto :eof

:electron
echo [electron] Starting Electron dev mode...
cd electron && npm run electron:dev
goto :eof

:: ============================================================
:: Build & Package
:: ============================================================
:build
echo [build] Building production v%VERSION%...
call :version_sync
cd src\frontend && npm run build
cd ..\..\electron && npm run build:electron && npm run dist
cd ..\..
goto :eof

:package
echo [package] Packaging v%VERSION% for Windows...
call :clean
call :version_sync
cd src\frontend && npm run build
cd ..\..\electron && npm run build:electron && npm run dist:win
cd ..\..
echo [package] Package created in electron\release\
if exist electron\release (
    dir /B electron\release
)
goto :eof

:: ============================================================
:: Version Management
:: ============================================================
:version
echo Writer %VERSION%
for /f "delims=" %%a in ('node -p "require('./src/frontend/package.json').version" 2^>nul') do echo Frontend: %%a
for /f "delims=" %%a in ('powershell -Command "(Get-Content src\backend\config.py | Select-String 'app_version: str = \"([^\"]+)\"').Matches.Groups[1].Value"') do echo Backend:  %%a
goto :eof

:version_sync
echo [version-sync] Syncing version %VERSION%...
node scripts\version-sync.js %VERSION%
goto :eof

:bump_patch
node scripts\version-bump.js patch
goto :eof

:bump_minor
node scripts\version-bump.js minor
goto :eof

:bump_major
node scripts\version-bump.js major
goto :eof

:: ============================================================
:: Quality
:: ============================================================
:test
echo [test] Running backend tests...
cd src\backend && pytest -v
goto :eof

:lint
echo [lint] Running frontend lint...
cd src\frontend && npm run lint
goto :eof

:typecheck
echo [typecheck] Running TypeScript check...
cd src\frontend && npx tsc --noEmit
goto :eof

:: ============================================================
:: Docker
:: ============================================================
:docker_build
echo [docker-build] Building Docker images...
docker compose build
goto :eof

:docker_up
echo [docker-up] Starting Docker services...
docker compose up -d
echo Services started!
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
goto :eof

:docker_down
echo [docker-down] Stopping Docker services...
docker compose down
goto :eof

:: ============================================================
:: Database
:: ============================================================
:db_migrate
echo [db-migrate] Running migrations...
cd src\backend && python cli.py db upgrade
goto :eof

:db_rollback
echo [db-rollback] Rolling back migration...
cd src\backend && python cli.py db downgrade
goto :eof

:: ============================================================
:: Cleanup
:: ============================================================
:clean
echo [clean] Cleaning build artifacts...
if exist src\frontend\dist rmdir /S /Q src\frontend\dist 2>nul
if exist src\frontend\node_modules\.cache rmdir /S /Q src\frontend\node_modules\.cache 2>nul
if exist electron\dist rmdir /S /Q electron\dist 2>nul
if exist electron\dist-electron rmdir /S /Q electron\dist-electron 2>nul
if exist electron\release rmdir /S /Q electron\release 2>nul
for /f "delims=" %%d in ('dir /S /B /AD __pycache__ 2^>nul') do @rmdir /S /Q "%%d" 2>nul
for /f "delims=" %%f in ('dir /S /B /A *.pyc 2^>nul') do @del "%%f" 2>nul
echo [clean] Done.
goto :eof

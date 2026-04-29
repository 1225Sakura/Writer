@echo off
chcp 65001 >nul
echo ========================================
echo   Auto Novel Writer - Local Build
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\local-build.ps1" %*
set BUILD_EXIT_CODE=%ERRORLEVEL%

echo.
if %BUILD_EXIT_CODE% equ 0 (
    echo [SUCCESS] Build completed successfully.
) else (
    echo [ERROR] Build failed with exit code: %BUILD_EXIT_CODE%
)
echo ========================================

exit /b %BUILD_EXIT_CODE%

# Windows PowerShell wrapper for OpenAPI contract check.
# Delegates to check-openapi.mjs (cross-platform Node.js).
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& node (Join-Path $ScriptDir "check-openapi.mjs") @args
exit $LASTEXITCODE

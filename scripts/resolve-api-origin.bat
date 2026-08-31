@echo off
setlocal
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0resolve-api-origin.ps1"
if errorlevel 1 (
  echo Failed to resolve API origin.
  pause
  exit /b 1
)

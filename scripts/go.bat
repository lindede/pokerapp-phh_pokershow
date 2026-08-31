@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

set "BACKEND=%~dp0..\..\pokerapp-phh_analysis_service\scripts"

if "%~1"=="" goto :help
if /I "%~1"=="help" goto :help
if /I "%~1"=="?" goto :help

if /I "%~1"=="api" goto :api
if /I "%~1"=="worker" goto :worker
if /I "%~1"=="check-api" goto :check_api
if /I "%~1"=="h5" goto :h5
if /I "%~1"=="mp" goto :mp
if /I "%~1"=="mp-phone" goto :mp_phone
if /I "%~1"=="mp-build" goto :mp_build
if /I "%~1"=="all-phone" goto :all_phone

echo [ERROR] Unknown command: %~1
goto :help

:api
call "%BACKEND%\start-api.bat"
goto :eof

:worker
call "%BACKEND%\start-worker.bat"
goto :eof

:check_api
call "%~dp0resolve-api-origin.bat"
if errorlevel 1 exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-api-health.ps1"
goto :eof

:h5
call "%~dp0start-h5.bat"
goto :eof

:mp
call "%~dp0start-mp-weixin.bat"
goto :eof

:mp_phone
call "%~dp0dev-weixin-phone.bat"
goto :eof

:mp_build
call "%~dp0build-mp-weixin.bat"
goto :eof

:all_phone
echo.
echo === 一条龙: API + 微信小程序真机 ===
echo.
start "PHH API :9000" cmd /k call "%BACKEND%\start-api.bat"
echo Waiting for API to listen on :9000 ...
timeout /t 4 /nobreak >nul
call "%~dp0dev-weixin-phone.bat"
goto :eof

:help
echo.
echo Usage: scripts\go.bat ^<command^>
echo.
echo   api         Start backend API on :9000
echo   worker      Start platform worker
echo   check-api   Ping /healthz with current VITE_API_ORIGIN
echo   h5          H5 dev server (browser)
echo   mp          WeChat MP dev (simulator)
echo   mp-phone    WeChat MP real device (recommended)
echo   mp-build    Production MP build
echo   all-phone   API + mp-phone in one flow
echo.
exit /b 1

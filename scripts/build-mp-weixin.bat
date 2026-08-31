@echo off
setlocal
cd /d "%~dp0\.."

call "%~dp0resolve-api-origin.bat"
if errorlevel 1 exit /b 1

echo === Build WeChat Mini Program ===
call npm run build:mp-weixin
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Sync to dist\dev\mp-weixin (avoid opening stale dev folder)...
if not exist "dist\dev\mp-weixin" mkdir "dist\dev\mp-weixin"
robocopy "dist\build\mp-weixin" "dist\dev\mp-weixin" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul

echo.
echo ========================================
echo   Import THIS folder in WeChat DevTools:
echo   %CD%\dist\build\mp-weixin
echo.
echo   Do NOT use repo root or old dev copy.
echo   After import: Compile ^> Clear cache ^> Compile
echo ========================================
echo.
pause

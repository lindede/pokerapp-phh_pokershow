@echo off
setlocal
cd /d "%~dp0\.."

call "%~dp0resolve-api-origin.bat"
if errorlevel 1 exit /b 1

echo.
echo === WeChat Mini Program DEV ===
echo.
echo 1. Keep this window open (auto rebuild on code changes)
echo 2. WeChat DevTools: import folder
echo    %CD%\dist\dev\mp-weixin
echo 3. After each rebuild: click Compile in DevTools
echo.
call npm run dev:mp-weixin
pause

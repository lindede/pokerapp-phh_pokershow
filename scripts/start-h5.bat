@echo off
setlocal
cd /d "%~dp0\.."

echo === start H5 http://localhost:5173 ===
echo API proxy target: see .env.development VITE_COMMENTARY_DEV_PROXY_TARGET
echo Make sure API is running (scripts\start-api.bat) first.
echo.
call npm run dev:h5 -- --host 0.0.0.0
pause

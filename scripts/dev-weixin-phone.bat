@echo off
setlocal
cd /d "%~dp0\.."

echo.
echo ========================================
echo   微信小程序 - 真机开发（一键）
echo ========================================
echo.

call "%~dp0resolve-api-origin.bat"
if errorlevel 1 goto :fail

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-api-health.ps1"
if errorlevel 1 (
  echo.
  echo [WARN] API 未就绪，小程序仍会编译，但真机可能取不到数据。
  echo        请先启动 API 后再点微信「预览」。
  echo.
) else (
  echo.
)

echo 微信开发者工具导入目录（固定用这个）:
echo   %CD%\dist\dev\mp-weixin
echo.
echo 真机步骤:
echo   1. 手机与电脑同一 WiFi
echo   2. 开发者工具: 详情 - 本地设置 - 不校验合法域名
echo   3. 点「预览」- 手机重新扫码
echo   4. API 地址：改仓库根目录 project.config.json 的 apiOrigin
echo.
echo 保持本窗口打开，改代码会自动编译到 dist\dev\mp-weixin
echo ========================================
echo.

call npm run dev:mp-weixin
goto :eof

:fail
pause
exit /b 1

@echo off
title Recipe App - Run on phone
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE (
  echo [ERROR] Node.js not found. Please send this message to Codex.
  pause
  exit /b 1
)

echo.
echo   How to run this app on your phone:
echo     1. Keep this black window open.
echo     2. Phone and computer must be on the same Wi-Fi.
echo     3. Open "Expo Go" on the phone and scan the QR code below.
echo.
echo   Press Ctrl+C here to stop.
echo.

"%NODE_EXE%" "node_modules\expo\bin\cli" start

echo.
echo Server stopped.
pause

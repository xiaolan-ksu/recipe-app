@echo off
title Recipe App - Preview on PC
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
echo   Opening the app in your browser...
echo   The phone-shaped frame in the middle is the app itself.
echo   Press Ctrl+C here to stop.
echo.

"%NODE_EXE%" "node_modules\expo\bin\cli" start --web

echo.
echo Server stopped.
pause

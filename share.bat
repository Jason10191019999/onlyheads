@echo off
setlocal
chcp 65001 >nul
title OnlyHeads - share on local network
cd /d "%~dp0"

echo.
echo   Builds the game and serves it to everyone on the same Wi-Fi.
echo   Keep this window open while they play. Ctrl+C stops it.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [x] Node.js was not found. Install it from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo   [1/2] Installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo   [x] npm install failed.
    pause
    exit /b 1
  )
)

echo   [2/2] Building...
call npm run build
if errorlevel 1 (
  echo   [x] Build failed.
  pause
  exit /b 1
)

echo.
echo   Ready. Send the "Network:" address below to people on your network.
echo.
call npx vite preview --host --port 4173

echo.
echo   Server stopped.
pause

@echo off
setlocal
chcp 65001 >nul
title OnlyHeads
cd /d "%~dp0"

echo.
echo   ============================================
echo    OnlyHeads - headshot-only aim range
echo   ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [x] Node.js was not found.
  echo       Install the LTS build from https://nodejs.org
  echo       then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo   [1/2] First run - installing dependencies, this takes a minute...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   [x] npm install failed. Check your network and try again.
    pause
    exit /b 1
  )
  echo.
)

echo   [2/2] Starting the range. The browser opens by itself.
echo         Keep this window open while you play. Ctrl+C stops the server.
echo.

call npm run dev -- --open

echo.
echo   Server stopped.
pause

@echo off
setlocal
chcp 65001 >nul
title ONLYheads - desktop icon
cd /d "%~dp0"

echo.
echo   Creates an "ONLYheads" shortcut on your desktop.
echo   It opens the game without an address bar and starts fullscreen.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1"

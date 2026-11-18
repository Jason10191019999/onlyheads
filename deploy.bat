@echo off
setlocal
chcp 65001 >nul
title OnlyHeads - deploy to GitHub Pages
cd /d "%~dp0"

echo.
echo   Builds the game and publishes it to the gh-pages branch.
echo   GitHub Pages serves that branch, so the live site updates in ~1 minute.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [x] Node.js was not found. Install it from https://nodejs.org
  pause
  exit /b 1
)

echo   [1/3] Building...
call npm run build
if errorlevel 1 (
  echo   [x] Build failed.
  pause
  exit /b 1
)

set "TMP=%TEMP%\onlyheads-gh-pages"

echo   [2/3] Preparing gh-pages branch...
if exist "%TMP%" rmdir /s /q "%TMP%"
mkdir "%TMP%"
xcopy /e /i /q /y "dist" "%TMP%" >nul
pushd "%TMP%"
git init -q -b gh-pages
git add -A
git -c user.name="OnlyHeads" -c user.email="deploy@local" commit -q -m "deploy"
git remote add origin "https://github.com/Jason10191019999/onlyheads.git"

rem This machine's global git config maps https to ssh and asks for openssl,
rem so every setting is pinned locally for the deploy push.
git config url."https://github.com/Jason10191019999/".insteadOf "https://github.com/Jason10191019999/"
git config http.sslBackend schannel
git config http.version HTTP/1.1
git config credential."https://github.com".helper "!gh auth git-credential"

echo   [3/3] Pushing...
git push -f origin gh-pages
if errorlevel 1 (
  echo.
  echo   [x] Push failed. Run "gh auth status" and check your network.
  popd
  rmdir /s /q "%TMP%"
  pause
  exit /b 1
)

popd
rmdir /s /q "%TMP%"
echo.
echo   Done: https://jason10191019999.github.io/onlyheads/
echo   Pages takes about a minute to refresh.
pause

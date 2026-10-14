@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title SYNKRA - local website
set "SYNKRA_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "SYNKRA_NODE=%ProgramFiles%\nodejs\node.exe"
  ) else (
    echo Install Node.js 24 LTS, then try again.
    pause
    exit /b 1
  )
)
set "PORT=5174"
set "NO_COLOR=1"
"%SYNKRA_NODE%" scripts\launch-local.mjs
if errorlevel 1 (
  echo.
  echo Startup stopped. Details are in .sites-runtime\startup.log
  echo Keep this window open or send a screenshot of the error.
  pause
  exit /b 1
)
endlocal

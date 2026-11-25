@echo off
title Portfolio Studio
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed on this computer.
  echo  Get it from https://nodejs.org, install it, then open this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo  Setting up for the first time. This takes a minute or two.
  echo.
  call npm install --no-audit --no-fund
)

echo.
echo  The Studio is opening in your browser.
echo  Keep this window open while you edit, and close it when you are done.
echo.
call npm run studio
pause

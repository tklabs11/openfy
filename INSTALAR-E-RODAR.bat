@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js primeiro: https://nodejs.org  ^(versao LTS^)
  pause
  exit /b
)
call npm install
call npm run dev
pause

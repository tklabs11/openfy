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
call npm run dist
if errorlevel 1 (
  echo Deu erro. Tente de novo clicando com o botao direito e "Executar como administrador".
  pause
  exit /b
)
echo.
echo Pronto! O instalador esta na pasta dist. Mande o arquivo Setup.exe para seus amigos.
explorer dist
pause

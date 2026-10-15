@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Cole o client_id do Jamendo (deixe vazio e aperte Enter para pular):
set /p "JID=client_id: "
echo // Configuracao feita uma vez, antes de gerar o instalador.> "src\shared\config.ts"
echo // Audius e Internet Archive funcionam sem chave. Jamendo usa o client_id abaixo.>> "src\shared\config.ts"
echo export const JAMENDO_CLIENT_ID = '%JID%'>> "src\shared\config.ts"
echo.
echo Pronto. Agora use INSTALAR-E-RODAR.bat ou GERAR-INSTALADOR.bat.
pause

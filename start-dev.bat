@echo off
chcp 65001 >nul

pushd "%~dp0"

pushd "backend"
start "Backend" cmd /k "npm run dev"
popd

pushd "frontend"
start "Frontend" cmd /k "npm start"
popd

echo Servidores iniciados en ventanas separadas.
popd
exit /b 0

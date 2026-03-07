@echo off
chcp 65001 >nul
echo Starting Vite dev server...
echo.
cd /d "%~dp0"
npm run dev
pause

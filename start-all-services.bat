@echo off
chcp 65001 >nul
echo ==========================================
echo   Pipeline Energy System - Full Startup
echo ==========================================
echo.

cd /d C:\Users\14297\Desktop\oil

echo This script will start all services in separate windows:
echo   1. Java Backend (Spring Boot) - Port 8080
echo   2. Python AI Service (FastAPI) - Port 8100
echo   3. React Frontend (Vite) - Port 5173
echo.
echo Press any key to continue...
pause >nul

REM Start Java Backend
echo.
echo [1/3] Starting Java Backend...
start "Java Backend - Port 8080" cmd /k "cd pipeline-energy-cloud && mvn spring-boot:run"
timeout /t 3 >nul

REM Start Python AI Service
echo [2/3] Starting Python AI Service...
start "Python AI Service - Port 8100" cmd /k "cd pipeline-agent && python -m src.main"
timeout /t 3 >nul

REM Start React Frontend
echo [3/3] Starting React Frontend...
start "React Frontend - Port 5173" cmd /k "cd pipeline-react && npm run dev"

echo.
echo ==========================================
echo   All services are starting...
echo ==========================================
echo.
echo Service URLs:
echo   - Frontend:  http://localhost:5173
echo   - Backend:   http://localhost:8080
echo   - AI Service: http://localhost:8100
echo.
echo Check the separate windows for each service status.
echo Close this window when done.
echo.

pause

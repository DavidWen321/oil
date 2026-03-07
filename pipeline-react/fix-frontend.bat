@echo off
chcp 65001 >nul
echo ==========================================
echo   Frontend Diagnostic and Fix Script
echo ==========================================
echo.

cd /d C:\Users\14297\Desktop\oil\pipeline-react

echo [Step 1/3] Installing missing dependencies...
echo.
npm install react-syntax-highlighter @tanstack/react-virtual
npm install -D @types/react-syntax-highlighter

echo.
echo [Step 2/3] Checking for other issues...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [WARNING] node_modules not found, running full install...
    npm install
)

echo.
echo [Step 3/3] Diagnostic Summary
echo.
echo Dependencies Status:
npm list react-syntax-highlighter @tanstack/react-virtual 2>nul
echo.

echo ==========================================
echo   Fix Complete!
echo ==========================================
echo.
echo Next steps:
echo   1. Start Java backend: cd ..\pipeline-energy-cloud ^&^& mvn spring-boot:run
echo   2. Start Python AI service: cd ..\pipeline-agent ^&^& python -m src.main
echo   3. Restart frontend: npm run dev
echo.
echo Note: The proxy errors (ECONNREFUSED) are normal when backend is not running.
echo.

pause

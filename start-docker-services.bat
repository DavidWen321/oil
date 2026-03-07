@echo off
chcp 65001 >nul
echo ==========================================
echo   Pipeline Energy System - Docker Startup
echo ==========================================
echo.

cd /d C:\Users\14297\Desktop\oil\pipeline-energy-cloud

echo [Step 1/3] Starting infrastructure services (MySQL, Redis, Nacos, Milvus)...
echo This may take 1-2 minutes for first-time setup...
echo.
docker-compose up -d

if errorlevel 1 (
    echo [ERROR] Failed to start Docker services
    echo Please make sure Docker Desktop is running
    pause
    exit /b 1
)

echo.
echo [OK] Infrastructure services started successfully
echo.
echo Waiting 30 seconds for services to initialize...
timeout /t 30 >nul

echo.
echo [Step 2/3] Checking service status...
docker-compose ps

echo.
echo [Step 3/3] Service URLs:
echo   - MySQL:    localhost:3306 (root/root)
echo   - Redis:    localhost:6379
echo   - Nacos:    http://localhost:8848/nacos (nacos/nacos)
echo   - Milvus:   localhost:19530
echo   - MinIO:    http://localhost:9001 (admin/password)
echo.
echo ==========================================
echo   Infrastructure Ready!
echo ==========================================
echo.
echo Next steps:
echo   1. Python AI service is already running (Port 8100)
echo   2. React frontend is already running (Port 5173)
echo   3. For Java backend, you need to:
echo      - Build: mvn clean package -DskipTests
echo      - Run specific module: cd pipeline-gateway ^&^& mvn spring-boot:run
echo.
echo Note: Java backend needs to be started from a specific module (gateway/data/calculation)
echo      not from the root project.
echo.

pause

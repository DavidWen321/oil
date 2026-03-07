@echo off
chcp 65001 >nul
echo ==========================================
echo   Docker Cleanup Script
echo ==========================================
echo.

echo WARNING: This will remove:
echo   - All stopped containers
echo   - All unused images
echo   - All unused volumes
echo   - All unused networks
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo [Step 1/5] Stopping all running containers...
docker stop $(docker ps -aq) 2>nul
echo.

echo [Step 2/5] Removing all containers...
docker rm $(docker ps -aq) 2>nul
echo.

echo [Step 3/5] Removing all images...
docker rmi $(docker images -q) -f 2>nul
echo.

echo [Step 4/5] Removing all volumes...
docker volume rm $(docker volume ls -q) 2>nul
echo.

echo [Step 5/5] Removing all networks (except default)...
docker network prune -f
echo.

echo [Cleanup] Running system prune...
docker system prune -a -f --volumes

echo.
echo ==========================================
echo   Cleanup Complete!
echo ==========================================
echo.
echo Current Docker status:
docker system df
echo.

pause

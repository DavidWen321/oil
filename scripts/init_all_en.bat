@echo off
chcp 65001 >nul 2>&1
REM Pipeline Energy Analysis System - Quick Initialization Script (Windows)
REM Initialize Knowledge Graph and RAG Knowledge Base

echo ==========================================
echo   Pipeline Energy System - Data Init
echo ==========================================
echo.

cd /d "%~dp0.."

REM Check Python environment
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found, please install Python 3.11+
    exit /b 1
)

echo [OK] Python environment check passed
echo.

REM 1. Initialize Knowledge Graph
echo === Step 1/2: Initialize Knowledge Graph ===
echo Loading equipment, fault, and standard data...
python pipeline-agent\scripts\init_knowledge_graph.py

if errorlevel 1 (
    echo [ERROR] Knowledge graph initialization failed
    exit /b 1
)

echo [OK] Knowledge graph initialized successfully
echo.

REM 2. Initialize RAG Knowledge Base
echo === Step 2/2: Initialize RAG Knowledge Base ===
echo Loading knowledge documents to Milvus vector database...

if not exist "pipeline-agent\knowledge_base" (
    echo [WARNING] knowledge_base directory not found, skipping RAG initialization
    echo           Please create knowledge base documents first
) else (
    python pipeline-agent\scripts\init_knowledge_base.py

    if errorlevel 1 (
        echo [ERROR] RAG knowledge base initialization failed
        exit /b 1
    )

    echo [OK] RAG knowledge base initialized successfully
)

echo.
echo ==========================================
echo   Initialization Complete!
echo ==========================================
echo.
echo Next steps:
echo   1. Start Java backend: cd pipeline-energy-cloud ^&^& mvn spring-boot:run
echo   2. Start Python AI service: cd pipeline-agent ^&^& python -m src.main
echo   3. Visit frontend: http://localhost:5173
echo.

pause

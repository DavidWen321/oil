@echo off
setlocal
set SCRIPT_DIR=%~dp0
set LOG_DIR=%SCRIPT_DIR%..\run-logs

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

node "%SCRIPT_DIR%qwen-agent-lite.mjs" 1>>"%LOG_DIR%\qwen-agent-lite.out.log" 2>>"%LOG_DIR%\qwen-agent-lite.err.log"

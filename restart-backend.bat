@echo off
cd /d "%~dp0"
start "AgriLink Backend" /min cmd /c "cd /d "%~dp0backend" && npm run start:dev > "%~dp0logs\backend-run.log" 2>&1"

@echo off
chcp 65001 >nul
echo ===================================================
echo             PRINTFILM DEV LAUNCHER
echo ===================================================

echo [1/3] Starting Backend API (http://127.0.0.1:8000)...
start "PRINTFILM Backend" cmd /k "cd /d %~dp0backend && set PYTHONUTF8=1 && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo [2/3] Starting User Frontend (http://127.0.0.1:5173)...
start "PRINTFILM Frontend" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

echo [3/3] Starting Admin Panel (http://127.0.0.1:5174)...
start "PRINTFILM Admin" cmd /k "cd /d %~dp0admin && npm.cmd run dev"

echo.
echo All services started!
echo - User Web:   http://localhost:5173
echo - Admin Web:  http://localhost:5174
echo - API Docs:   http://localhost:8000/docs
echo ===================================================
pause

# PRINTFILM Dev Services Launcher
$Host.UI.RawUI.WindowTitle = "PRINTFILM Launcher"
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "             PRINTFILM DEV LAUNCHER" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

Write-Host "[1/3] Starting Backend API (http://127.0.0.1:8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root/backend'; `$env:PYTHONUTF8=1; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

Write-Host "[2/3] Starting User Frontend (http://127.0.0.1:5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root/frontend'; npm.cmd run dev"

Write-Host "[3/3] Starting Admin Panel (http://127.0.0.1:5174)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root/admin'; npm.cmd run dev"

Write-Host "`nAll services launched successfully!" -ForegroundColor Cyan
Write-Host " - User Web:   http://localhost:5173" -ForegroundColor Yellow
Write-Host " - Admin Web:  http://localhost:5174" -ForegroundColor Yellow
Write-Host " - API Docs:   http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan

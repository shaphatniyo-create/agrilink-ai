@echo off
title AgriLink AI launcher
cd /d "%~dp0"
if not exist logs mkdir logs
echo [%date% %time%] launcher started > logs\launcher.log

echo Checking PostgreSQL on port 5432...
powershell -NoProfile -Command "if ((Test-NetConnection localhost -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded){exit 0}else{exit 1}"
if %errorlevel%==0 goto pgok

echo Postgres not running - trying Windows service...
for /f "tokens=2 delims=: " %%s in ('sc query state^= all ^| findstr /i /r /c:"^SERVICE_NAME: postgresql"') do (
  echo starting service %%s >> logs\launcher.log
  net start %%s >> logs\launcher.log 2>&1
)
powershell -NoProfile -Command "Start-Sleep 3; if ((Test-NetConnection localhost -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded){exit 0}else{exit 1}"
if %errorlevel%==0 goto pgok

echo Trying pg_ctl with your AgriLink data folder...
set PGCTL=
for /d %%d in ("C:\Program Files\PostgreSQL\*") do if exist "%%d\bin\pg_ctl.exe" set "PGCTL=%%d\bin\pg_ctl.exe"
if not defined PGCTL for /f "delims=" %%p in ('where pg_ctl 2^>nul') do set "PGCTL=%%p"
if not defined PGCTL (echo pg_ctl not found >> logs\launcher.log & goto pgfail)
set PGD=%USERPROFILE%\agrilink_pgdata2
if not exist "%PGD%\PG_VERSION" set PGD=%USERPROFILE%\agrilink_pgdata
echo using "%PGCTL%" -D "%PGD%" >> logs\launcher.log
"%PGCTL%" -D "%PGD%" -l "%~dp0logs\postgres.log" start >> logs\launcher.log 2>&1
powershell -NoProfile -Command "Start-Sleep 4; if ((Test-NetConnection localhost -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded){exit 0}else{exit 1}"
if %errorlevel%==0 goto pgok

:pgfail
echo POSTGRES_FAILED >> logs\launcher.log
echo.
echo Could not start PostgreSQL. See logs\launcher.log
pause
exit /b 1

:pgok
echo POSTGRES_OK >> logs\launcher.log
echo PostgreSQL is running.

echo Applying any pending database migrations...
cd backend
call npx prisma migrate deploy > ..\logs\migrate.log 2>&1
cd ..

echo Starting backend (port 4000) and frontend (port 5173)...
start "AgriLink Backend" /min cmd /c "cd /d "%~dp0backend" && npm run start:dev > "%~dp0logs\backend.log" 2>&1"
start "AgriLink Frontend" /min cmd /c "cd /d "%~dp0frontend" && npm run dev > "%~dp0logs\frontend.log" 2>&1"
echo LAUNCHED >> logs\launcher.log

timeout /t 20 /nobreak >nul
start "" http://localhost:5173
echo.
echo AgriLink AI is running:  http://localhost:5173
echo API docs:               http://localhost:4000/api/docs
echo To stop it, close the two minimized "AgriLink Backend/Frontend" windows.
timeout /t 15 >nul

@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
  py -3 license_key_generator.py
) else (
  python license_key_generator.py
)
if errorlevel 1 pause
endlocal

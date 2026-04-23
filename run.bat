@echo off
:: Wrapper that calls run.sh via Git Bash.
:: For direct usage on Linux/macOS, run ./run.sh instead.

:: Find Git Bash (not WSL bash)
set "BASH_EXE="
if exist "C:\Program Files\Git\bin\bash.exe" (
    set "BASH_EXE=C:\Program Files\Git\bin\bash.exe"
) else if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    set "BASH_EXE=C:\Program Files (x86)\Git\bin\bash.exe"
) else (
    echo ERROR: Git Bash not found. Install Git for Windows from https://git-scm.com
    pause
    exit /b 1
)

:: Convert Windows backslash path to forward slashes for bash
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:\=/%"

"%BASH_EXE%" "%SCRIPT_DIR%run.sh" %*
set "RC=%ERRORLEVEL%"
pause
exit /b %RC%

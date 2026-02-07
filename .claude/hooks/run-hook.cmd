@echo off
REM Universal Hook Runner for Windows
REM Tries: python -> python3 -> bun -> npx tsx

set HOOK_NAME=%1
set HOOKS_DIR=%~dp0

REM Try Python first
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if exist "%HOOKS_DIR%%HOOK_NAME%.py" (
        python "%HOOKS_DIR%%HOOK_NAME%.py"
        exit /b %ERRORLEVEL%
    )
)

REM Try Python3
where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if exist "%HOOKS_DIR%%HOOK_NAME%.py" (
        python3 "%HOOKS_DIR%%HOOK_NAME%.py"
        exit /b %ERRORLEVEL%
    )
)

REM Try Bun with TypeScript
where bun >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if exist "%HOOKS_DIR%%HOOK_NAME%.ts" (
        bun "%HOOKS_DIR%%HOOK_NAME%.ts"
        exit /b %ERRORLEVEL%
    )
)

REM Try npx tsx as final fallback
where npx >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if exist "%HOOKS_DIR%%HOOK_NAME%.ts" (
        npx tsx "%HOOKS_DIR%%HOOK_NAME%.ts"
        exit /b %ERRORLEVEL%
    )
)

REM No runtime available - return safe default
echo {"decision":"approve","reason":"No runtime available for hook, allowing by default"}
exit /b 0

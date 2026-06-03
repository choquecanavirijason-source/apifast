@echo off
setlocal EnableDelayedExpansion
chcp 65001 > nul
title New Elashes — Build

echo.
echo ================================================
echo   NEW ELASHES — Build completo (.exe)
echo ================================================
echo.

:: ── Verificar herramientas ────────────────────────────────────────────────────
where python >nul 2>&1 || (echo [ERROR] Python no encontrado. Instala Python 3.11+ && exit /b 1)
where npm    >nul 2>&1 || (echo [ERROR] npm no encontrado. Instala Node.js && exit /b 1)
where cargo  >nul 2>&1 || (echo [ERROR] Cargo (Rust) no encontrado. Instala Rust && exit /b 1)

:: ── PASO 1: Backend con PyInstaller ──────────────────────────────────────────
echo [1/3] Compilando backend con PyInstaller...
cd /d "%~dp0elashesbackend"

:: Usar el venv del proyecto (tiene todas las dependencias ya instaladas)
set VENV_PYINSTALLER=%~dp0elashesbackend\venv\Scripts\pyinstaller.exe
set VENV_PIP=%~dp0elashesbackend\venv\Scripts\pip.exe

if not exist "%VENV_PYINSTALLER%" (
    echo [ERROR] No se encontro pyinstaller en el venv.
    echo         Activa el entorno virtual y ejecuta: pip install pyinstaller
    exit /b 1
)

:: Compilar usando el venv
"%VENV_PYINSTALLER%" backend.spec --clean --noconfirm
if errorlevel 1 (
    echo [ERROR] Fallo la compilacion del backend.
    exit /b 1
)
echo       Backend compilado OK ^(dist\backend.exe^)

:: ── PASO 2: Copiar binario al lugar que espera Tauri ──────────────────────────
echo [2/3] Copiando binario a src-tauri/binaries/...
set BINARIES_DIR=%~dp0adminElashes\src-tauri\binaries
if not exist "%BINARIES_DIR%" mkdir "%BINARIES_DIR%"

:: Detectar arquitectura
reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PROCESSOR_ARCHITECTURE > nul 2>&1
for /f "tokens=3" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PROCESSOR_ARCHITECTURE 2^>nul') do set ARCH=%%a

if /i "%ARCH%"=="AMD64" (
    set TARGET=x86_64-pc-windows-msvc
) else if /i "%ARCH%"=="ARM64" (
    set TARGET=aarch64-pc-windows-msvc
) else (
    set TARGET=x86_64-pc-windows-msvc
)

copy /y "%~dp0elashesbackend\dist\backend.exe" "%BINARIES_DIR%\backend-%TARGET%.exe"
if errorlevel 1 (
    echo [ERROR] No se pudo copiar el binario.
    exit /b 1
)
echo       Binario copiado: binaries\backend-%TARGET%.exe

:: ── PASO 3: Build Tauri ───────────────────────────────────────────────────────
echo [3/3] Construyendo instalador Tauri...
cd /d "%~dp0adminElashes"

call npm install --silent
call npm run tauri build
if errorlevel 1 (
    echo [ERROR] Fallo el build de Tauri.
    exit /b 1
)

:: Buscar el instalador generado
for /r "%~dp0adminElashes\src-tauri\target\release\bundle" %%f in (*.exe *.msi) do (
    echo.
    echo ================================================
    echo   INSTALADOR LISTO:
    echo   %%f
    echo ================================================
    echo.
)

echo Listo. El instalador esta en src-tauri\target\release\bundle\
pause

@echo off
REM =============================================================================
REM WMS Pro — Setup & Inicialização Automática (Windows)
REM =============================================================================
REM Uso: Clique duplo ou rode no Prompt de Comando como Administrador
REM =============================================================================

setlocal enabledelayedexpansion
title WMS Pro — Setup

echo.
echo ============================================================
echo            WMS Pro ^— Setup Automatico (Windows)
echo ============================================================
echo.

REM ── Diretório do script ────────────────────────────────────────────────────
set "ROOT_DIR=%~dp0"
REM Remove trailing backslash
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
cd /d "%ROOT_DIR%"
echo [WMS] Diretorio: %ROOT_DIR%

REM ── 1. Verificar Python ─────────────────────────────────────────────────────
echo [WMS] Verificando Python...
set "PYTHON_CMD="

for %%P in (python3.12 python3.11 python3.10 python3 python py) do (
  where %%P >nul 2>&1
  if !errorlevel! == 0 (
    if not defined PYTHON_CMD (
      set "PYTHON_CMD=%%P"
    )
  )
)

if not defined PYTHON_CMD (
  echo [ERRO] Python 3.10+ nao encontrado no PATH.
  echo.
  echo   Instale em: https://www.python.org/downloads/
  echo   Marque a opcao "Add Python to PATH" durante a instalacao.
  pause
  exit /b 1
)

echo [OK] Python encontrado: %PYTHON_CMD%

REM ── 2. Virtualenv ─────────────────────────────────────────────────────────
set "VENV_PYTHON=%ROOT_DIR%\venv\Scripts\python.exe"
set "VENV_PIP=%ROOT_DIR%\venv\Scripts\pip.exe"
set "VENV_ALEMBIC=%ROOT_DIR%\venv\Scripts\alembic.exe"

if exist "%VENV_PYTHON%" (
  echo [OK] Virtualenv ja existe.
) else (
  echo [WMS] Criando virtualenv...
  %PYTHON_CMD% -m venv "%ROOT_DIR%\venv"
  if errorlevel 1 (
    echo [ERRO] Falha ao criar virtualenv.
    pause
    exit /b 1
  )
  echo [OK] Virtualenv criado.
)

REM ── 3. Dependências ─────────────────────────────────────────────────────────
echo [WMS] Instalando dependencias...
"%VENV_PIP%" install --upgrade pip --quiet
"%VENV_PIP%" install -r "%ROOT_DIR%\requirements.txt" --quiet
if errorlevel 1 (
  echo [ERRO] Falha ao instalar dependencias. Verifique sua conexao com a internet.
  pause
  exit /b 1
)
echo [OK] Dependencias instaladas.

REM ── 4. Criar .env ──────────────────────────────────────────────────────────
if not exist "%ROOT_DIR%\.env" (
  echo [WMS] Criando .env...
  copy "%ROOT_DIR%\.env.example" "%ROOT_DIR%\.env" >nul
  REM Gerar SECRET_KEY segura
  for /f "delims=" %%K in ('"%VENV_PYTHON%" -c "import secrets; print(secrets.token_urlsafe(48))"') do set "SECRET_KEY=%%K"
  REM Reescrever .env com a chave gerada
  powershell -Command "(Get-Content '%ROOT_DIR%\.env') -replace '^SECRET_KEY=.*', 'SECRET_KEY=\"!SECRET_KEY!\"' | Set-Content '%ROOT_DIR%\.env'"
  echo [OK] .env criado com SECRET_KEY segura.
) else (
  echo [OK] .env ja existe.
)

REM ── 5. Criar pasta de XMLs de NF-e ─────────────────────────────────────────
if not exist "%ROOT_DIR%\nfe_xml" (
  mkdir "%ROOT_DIR%\nfe_xml"
  echo [OK] Pasta nfe_xml criada.
) else (
  echo [OK] Pasta nfe_xml ja existe.
)

REM ── 6. Migrações ───────────────────────────────────────────────────────────
echo [WMS] Aplicando migracoes do banco de dados...
"%VENV_ALEMBIC%" upgrade head
if errorlevel 1 (
  echo [ERRO] Falha nas migracoes Alembic.
  pause
  exit /b 1
)
echo [OK] Banco de dados atualizado.

REM ── 6. Usuário admin ───────────────────────────────────────────────────────
echo [WMS] Criando usuario admin...
"%VENV_PYTHON%" -m backend.initial_data
echo [OK] Usuario admin: login=admin / senha=Admin@123  (troque no primeiro login)

REM ── 7. Iniciar servidor ────────────────────────────────────────────────────
set "HOST=127.0.0.1"
set "PORT=8000"
set "URL=http://%HOST%:%PORT%"

echo.
echo ============================================================
echo   WMS Pro pronto!
echo   URL   : %URL%
echo   Login : admin / Senha: Admin@123  (troque no primeiro login)
echo   Para encerrar: feche esta janela ou Ctrl+C
echo ============================================================
echo.

REM Abrir navegador após 2s
start "" timeout /t 2 /nobreak >nul & start "" "%URL%"

REM Iniciar servidor
"%VENV_PYTHON%" -m uvicorn backend.app.main:app --host %HOST% --port %PORT% --reload

pause

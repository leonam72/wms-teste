#!/usr/bin/env bash
# =============================================================================
# WMS Pro — Setup & Inicialização Automática
# =============================================================================
# Uso:
#   chmod +x setup.sh && ./setup.sh
#
# O que este script faz:
#   1. Verifica pré-requisitos (Python 3.10+)
#   2. Cria e ativa virtualenv
#   3. Instala dependências do requirements.txt
#   4. Cria .env com SECRET_KEY segura (se não existir)
#   5. Roda as migrações Alembic (cria wms.db)
#   6. Cria usuário admin inicial
#   7. Inicia o servidor e abre o navegador
# =============================================================================

set -euo pipefail

# ── Cores ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[WMS]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $*"; }
err()  { echo -e "${RED}[ERRO]${NC} $*" >&2; }
die()  { err "$*"; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BLUE}${BOLD}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║              WMS Pro — Setup Automático              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Diretório raiz do projeto ─────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
log "Diretório do projeto: $ROOT_DIR"

# ── 1. Verificar Python ────────────────────────────────────────────────────────
log "Verificando Python..."

PYTHON_CMD=""
for cmd in python3.12 python3.11 python3.10 python3 python; do
  if command -v "$cmd" &>/dev/null; then
    version=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "0.0")
    major=$(echo "$version" | cut -d. -f1)
    minor=$(echo "$version" | cut -d. -f2)
    if [[ "$major" -ge 3 && "$minor" -ge 10 ]]; then
      PYTHON_CMD="$cmd"
      ok "Python $version encontrado em: $(command -v "$cmd")"
      break
    fi
  fi
done

if [[ -z "$PYTHON_CMD" ]]; then
  err "Python 3.10+ não encontrado no PATH."
  echo ""
  echo "  Instale via:"
  echo "    Ubuntu/Debian : sudo apt install python3.12"
  echo "    macOS         : brew install python@3.12"
  echo "    Windows       : https://www.python.org/downloads/"
  exit 1
fi

# ── 2. Criar/Reutilizar virtualenv ─────────────────────────────────────────────
VENV_DIR="$ROOT_DIR/venv"
if [[ -x "$VENV_DIR/bin/python" || -x "$VENV_DIR/Scripts/python.exe" ]]; then
  ok "Virtualenv já existe em venv/"
else
  log "Criando virtualenv em venv/..."
  "$PYTHON_CMD" -m venv "$VENV_DIR" || die "Falha ao criar virtualenv."
  ok "Virtualenv criado."
fi

# Determinar binários dentro do venv
if [[ -f "$VENV_DIR/bin/python" ]]; then
  VENV_PYTHON="$VENV_DIR/bin/python"
  VENV_PIP="$VENV_DIR/bin/pip"
  VENV_ALEMBIC="$VENV_DIR/bin/alembic"
  VENV_UVICORN="$VENV_DIR/bin/uvicorn"
elif [[ -f "$VENV_DIR/Scripts/python.exe" ]]; then
  # Windows
  VENV_PYTHON="$VENV_DIR/Scripts/python.exe"
  VENV_PIP="$VENV_DIR/Scripts/pip.exe"
  VENV_ALEMBIC="$VENV_DIR/Scripts/alembic.exe"
  VENV_UVICORN="$VENV_DIR/Scripts/uvicorn.exe"
else
  die "Virtualenv criado mas binários não encontrados."
fi

# ── 3. Instalar dependências ───────────────────────────────────────────────────
log "Instalando dependências (requirements.txt)..."
"$VENV_PIP" install --upgrade pip --quiet
"$VENV_PIP" install -r "$ROOT_DIR/requirements.txt" --quiet \
  && ok "Dependências instaladas." \
  || die "Falha ao instalar dependências. Verifique conexão com a internet."

# ── 4. Criar .env ─────────────────────────────────────────────────────────────
ENV_FILE="$ROOT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  log "Criando .env com SECRET_KEY segura..."
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
  SECRET=$("$VENV_PYTHON" -c "import secrets; print(secrets.token_urlsafe(48))")
  # Substituição portável (funciona em Linux e macOS)
  if sed --version &>/dev/null 2>&1; then
    # GNU sed
    sed -i "s|^SECRET_KEY=.*|SECRET_KEY=\"$SECRET\"|" "$ENV_FILE"
  else
    # BSD sed (macOS)
    sed -i '' "s|^SECRET_KEY=.*|SECRET_KEY=\"$SECRET\"|" "$ENV_FILE"
  fi
  ok ".env criado com chave segura."
else
  ok ".env já existe, mantendo configuração atual."
fi

# Verificar se ainda tem placeholder
if grep -Eq '^SECRET_KEY="?(gere-uma-chave-segura|changethis|change_this)"?' "$ENV_FILE" 2>/dev/null; then
  warn "SECRET_KEY parece ser placeholder. Gerando nova chave..."
  SECRET=$("$VENV_PYTHON" -c "import secrets; print(secrets.token_urlsafe(48))")
  if sed --version &>/dev/null 2>&1; then
    sed -i "s|^SECRET_KEY=.*|SECRET_KEY=\"$SECRET\"|" "$ENV_FILE"
  else
    sed -i '' "s|^SECRET_KEY=.*|SECRET_KEY=\"$SECRET\"|" "$ENV_FILE"
  fi
  ok "SECRET_KEY regenerada."
fi

# ── 5. Criar pasta de XMLs de NF-e ────────────────────────────────────────────
NFE_DIR="${ROOT_DIR}/nfe_xml"
if [ ! -d "$NFE_DIR" ]; then
  mkdir -p "$NFE_DIR" && ok "Pasta nfe_xml criada em $NFE_DIR"
else
  ok "Pasta nfe_xml já existe: $NFE_DIR"
fi

# ── 6. Migrações Alembic ───────────────────────────────────────────────────────
log "Aplicando migrações do banco de dados..."
cd "$ROOT_DIR"
"$VENV_ALEMBIC" upgrade head \
  && ok "Banco de dados atualizado (wms.db)." \
  || die "Falha nas migrações Alembic. Veja o erro acima."

# ── 7. Criar usuário admin ─────────────────────────────────────────────────────
log "Verificando/criando usuário admin..."
"$VENV_PYTHON" -m backend.initial_data \
  && ok "Usuário admin pronto (login: admin / senha: Admin@123  (troque no primeiro login))." \
  || warn "Falha ao criar admin — pode já existir ou ocorreu erro."

# ── 8. Iniciar servidor ────────────────────────────────────────────────────────
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
URL="http://$HOST:$PORT"

log "Iniciando servidor WMS em $URL ..."

# Abrir navegador em background após 2s
(sleep 2 && \
  if command -v xdg-open &>/dev/null; then xdg-open "$URL"
  elif command -v open &>/dev/null; then open "$URL"
  elif command -v start &>/dev/null; then start "$URL"
  fi
) &

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  WMS Pro pronto!${NC}"
echo -e "  URL   : ${CYAN}${BOLD}$URL${NC}"
echo -e "  Login : ${BOLD}admin${NC} / Senha: ${BOLD}Admin@123${NC}  (troque no primeiro login)"
echo -e "  Para encerrar: ${BOLD}Ctrl+C${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════${NC}"
echo ""

# Rodar em foreground (visível no terminal)
exec "$VENV_PYTHON" -m uvicorn backend.app.main:app \
  --host "$HOST" \
  --port "$PORT" \
  --reload

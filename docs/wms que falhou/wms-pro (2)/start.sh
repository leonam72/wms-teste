#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/run"
PID_FILE="$RUN_DIR/wms.pid"
META_FILE="$RUN_DIR/wms.meta"
LOG_FILE="$RUN_DIR/wms.log"
ENV_FILE="$ROOT_DIR/.env"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
APP_MODULE="${APP_MODULE:-backend.app.main:app}"
PYTHON_BIN="$ROOT_DIR/venv/bin/python"
ALEMBIC_BIN="$ROOT_DIR/venv/bin/alembic"
HEALTH_URL="http://$HOST:$PORT/api/health"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-20}"
HOST_IPS="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true)"

mkdir -p "$RUN_DIR"
touch "$LOG_FILE"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${OLD_PID:-}" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "WMS ja esta rodando com PID $OLD_PID"
    echo "URL: http://$HOST:$PORT"
    echo "Log: $LOG_FILE"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

cd "$ROOT_DIR"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Python do venv nao encontrado em $PYTHON_BIN"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
fi

if grep -Eq '^SECRET_KEY="?(changethis|gere-uma-chave-segura-com-pelo-menos-32-caracteres|change_this_to_a_secure_random_key_in_production)"?$' "$ENV_FILE"; then
  GENERATED_SECRET="$("$PYTHON_BIN" - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
  if grep -q '^SECRET_KEY=' "$ENV_FILE"; then
    sed -i "s|^SECRET_KEY=.*|SECRET_KEY=\"$GENERATED_SECRET\"|" "$ENV_FILE"
  else
    printf '\nSECRET_KEY="%s"\n' "$GENERATED_SECRET" >> "$ENV_FILE"
  fi
  echo "[$(date '+%F %T')] SECRET_KEY local gerada automaticamente em .env" >> "$LOG_FILE"
fi

if [[ -x "$ALEMBIC_BIN" ]]; then
  echo "[$(date '+%F %T')] Aplicando migracoes..." >> "$LOG_FILE"
  "$ALEMBIC_BIN" upgrade head >> "$LOG_FILE" 2>&1
fi

echo "[$(date '+%F %T')] Iniciando WMS em http://$HOST:$PORT" >> "$LOG_FILE"
nohup setsid "$PYTHON_BIN" -m uvicorn "$APP_MODULE" --host "$HOST" --port "$PORT" >> "$LOG_FILE" 2>&1 < /dev/null &
PID=$!
echo "$PID" > "$PID_FILE"
{
  echo "PID=$PID"
  echo "HOST=$HOST"
  echo "PORT=$PORT"
  echo "APP_MODULE=$APP_MODULE"
  echo "STARTED_AT=$(date '+%F %T')"
} > "$META_FILE"

sleep 2

if kill -0 "$PID" 2>/dev/null; then
  HEALTH_OK=0
  for ((i=1; i<=MAX_WAIT_SECONDS; i++)); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      HEALTH_OK=1
      break
    fi
    sleep 1
  done

  if [[ "$HEALTH_OK" -ne 1 ]]; then
    echo "Falha no health-check em $HEALTH_URL. Veja o log em $LOG_FILE"
    kill "$PID" 2>/dev/null || true
    rm -f "$PID_FILE" "$META_FILE"
    exit 1
  fi

  echo "WMS iniciado com PID $PID"
  echo "URL: http://$HOST:$PORT"
  if [[ -n "$HOST_IPS" ]]; then
    while IFS= read -r ip; do
      [[ -z "$ip" ]] && continue
      echo "ALERTA: servidor aberto em http://$ip:$PORT"
    done <<< "$HOST_IPS"
  fi
  echo "Health: $HEALTH_URL"
  echo "Log: $LOG_FILE"
  echo "Meta: $META_FILE"
else
  echo "Falha ao iniciar o WMS. Veja o log em $LOG_FILE"
  rm -f "$PID_FILE" "$META_FILE"
  exit 1
fi

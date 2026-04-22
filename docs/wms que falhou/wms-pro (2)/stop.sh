#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/run"
PID_FILE="$RUN_DIR/wms.pid"
META_FILE="$RUN_DIR/wms.meta"

stop_pid() {
  local pid="$1"
  if [[ -z "${pid:-}" ]]; then
    return 0
  fi
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    for _ in {1..20}; do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 0.2
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "WMS parado. PID $pid"
  else
    echo "Processo $pid nao estava rodando."
  fi
}

if [[ ! -f "$PID_FILE" ]]; then
  echo "Nenhum PID file encontrado em $PID_FILE"
else
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -z "${PID:-}" ]]; then
    echo "PID file vazio. Removendo."
  else
    stop_pid "$PID"
  fi
fi

ORPHANS="$(pgrep -f "uvicorn backend.app.main:app" || true)"
if [[ -n "${ORPHANS:-}" ]]; then
  while IFS= read -r orphan_pid; do
    [[ -n "${orphan_pid:-}" ]] || continue
    stop_pid "$orphan_pid"
  done <<< "$ORPHANS"
fi

rm -f "$PID_FILE" "$META_FILE"
echo "Arquivos de controle removidos de $RUN_DIR"

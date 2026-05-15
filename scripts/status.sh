#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
PORT="${PORT:-3000}"

status_pid_file() {
  local pid_file="$1"
  local name="$2"
  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "$name: running (pid $(cat "$pid_file"))"
  else
    echo "$name: stopped"
  fi
}

status_pid_file "$RUN_DIR/ingestion-endpoint.pid" "ingestion endpoint"
status_pid_file "$RUN_DIR/device-simulation.pid" "device simulator"

if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "healthcheck: ok"
else
  echo "healthcheck: failed"
fi

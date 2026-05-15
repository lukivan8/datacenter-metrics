#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
PORT="${PORT:-3000}"

find_matching_processes() {
  local cwd="$1"
  local cmd_match="$2"

  for proc in /proc/[0-9]*; do
    local pid="${proc##*/}"
    local proc_cwd
    proc_cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"
    [[ "$proc_cwd" == "$cwd" ]] || continue

    local cmdline
    cmdline="$(tr '\0' ' ' < "$proc/cmdline" 2>/dev/null || true)"
    [[ "$cmdline" == *"$cmd_match"* ]] || continue
    echo "$pid"
  done
}

status_pid_file() {
  local pid_file="$1"
  local name="$2"
  local cwd="$3"
  local cmd_match="$4"
  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "$name: running (pid $(cat "$pid_file"))"
  else
    local pids
    pids="$(find_matching_processes "$cwd" "$cmd_match" | xargs echo)"
    if [[ -n "$pids" ]]; then
      echo "$name: unmanaged running (pid(s) $pids)"
    else
      echo "$name: stopped"
    fi
  fi
}

status_pid_file "$RUN_DIR/ingestion-endpoint.pid" "ingestion endpoint" "$ROOT_DIR/ingestion-endpoint" "node dist/server.js"
status_pid_file "$RUN_DIR/device-simulation.pid" "device simulator" "$ROOT_DIR/device-simulation" "node dist/index.js"

if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "healthcheck: ok"
else
  echo "healthcheck: failed"
fi

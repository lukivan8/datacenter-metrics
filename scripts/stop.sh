#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"

stop_pid() {
  local pid="$1"
  local name="$2"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi

  echo "Stopping $name ($pid)..."
  kill "$pid" 2>/dev/null || true
  for _ in {1..30}; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.2
  done
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
}

stop_pid_file() {
  local pid_file="$1"
  local name="$2"
  if [[ ! -f "$pid_file" ]]; then
    echo "$name is not managed/running."
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  stop_pid "$pid" "$name" || echo "$name pid file exists, but process is not running."
  rm -f "$pid_file"
}

stop_matching_processes() {
  local cwd="$1"
  local cmd_match="$2"
  local name="$3"

  for proc in /proc/[0-9]*; do
    local pid="${proc##*/}"
    local proc_cwd
    proc_cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"
    [[ "$proc_cwd" == "$cwd" ]] || continue

    local cmdline
    cmdline="$(tr '\0' ' ' < "$proc/cmdline" 2>/dev/null || true)"
    [[ "$cmdline" == *"$cmd_match"* ]] || continue

    stop_pid "$pid" "unmanaged $name" || true
  done
}

stop_pid_file "$RUN_DIR/device-simulation.pid" "device simulator"
stop_pid_file "$RUN_DIR/ingestion-endpoint.pid" "ingestion endpoint"

# Older deploys launched through `npm run start`; killing npm could leave the
# actual node child orphaned. Clean up those project-local leftovers too.
stop_matching_processes "$ROOT_DIR/device-simulation" "node dist/index.js" "device simulator"
stop_matching_processes "$ROOT_DIR/ingestion-endpoint" "node dist/server.js" "ingestion endpoint"

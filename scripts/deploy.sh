#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"
API_PID_FILE="$RUN_DIR/ingestion-endpoint.pid"
SIM_PID_FILE="$RUN_DIR/device-simulation.pid"
PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"
SIM_INTERVAL="${SIM_INTERVAL:-3s}"
SIM_DEVICES="${SIM_DEVICES:-50}"
SIM_URL="${SIM_URL:-http://127.0.0.1:${PORT}/api/metrics}"

mkdir -p "$RUN_DIR" "$LOG_DIR"
cd "$ROOT_DIR"

stop_pid_file() {
  local pid_file="$1"
  local name="$2"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $name ($pid)..."
      kill "$pid" 2>/dev/null || true
      for _ in {1..30}; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.2
      done
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

cleanup_on_failure() {
  echo "Deploy failed; stopping newly managed processes."
  stop_pid_file "$API_PID_FILE" "ingestion endpoint"
  stop_pid_file "$SIM_PID_FILE" "device simulator"
}
trap cleanup_on_failure ERR

echo "Installing dependencies..."
npm ci

echo "Building shared package, API, simulator, and dashboard..."
npm run build -w @lukivan8-datacenter/shared
npm run build -w ingestion-endpoint
npm run build -w device-simulation
npm run build -w datacenter-dashboard

echo "Running database migrations..."
npm run db:migrate -w ingestion-endpoint

echo "Restarting managed processes..."
stop_pid_file "$SIM_PID_FILE" "device simulator"
stop_pid_file "$API_PID_FILE" "ingestion endpoint"

(
  cd "$ROOT_DIR/ingestion-endpoint"
  STATIC_DIR="$ROOT_DIR/datacenter-dashboard/dist" \
  HOST="$HOST" \
  PORT="$PORT" \
  LOG_FILE="$LOG_DIR/ingestion.log" \
  exec node dist/server.js
) > "$LOG_DIR/ingestion.stdout.log" 2>&1 &
echo $! > "$API_PID_FILE"

echo "Waiting for API healthcheck on port $PORT..."
for _ in {1..60}; do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null

(
  cd "$ROOT_DIR/device-simulation"
  exec node dist/index.js \
    --url "$SIM_URL" \
    --interval "$SIM_INTERVAL" \
    --devices "$SIM_DEVICES" \
    --log-file "$LOG_DIR/device-simulation.log"
) > "$LOG_DIR/device-simulation.stdout.log" 2>&1 &
echo $! > "$SIM_PID_FILE"

trap - ERR

echo "Deploy complete."
echo "Dashboard/API: http://127.0.0.1:${PORT}"
echo "API pid: $(cat "$API_PID_FILE")"
echo "Simulator pid: $(cat "$SIM_PID_FILE")"
echo "Logs: $LOG_DIR"

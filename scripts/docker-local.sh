#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"
PORT="${PORT:-3000}"
SIM_INTERVAL="${SIM_INTERVAL:-3s}"
SIM_DEVICES="${SIM_DEVICES:-50}"
BUILD=1
RESET_DB=0

usage() {
  cat <<'MSG'
Usage: scripts/docker-local.sh [options]

Options:
  --port PORT                 Host port for dashboard/API (default: 3000)
  --sim-interval INTERVAL     Simulator interval, e.g. 1s, 500ms (default: 3s)
  --sim-devices COUNT         Number of simulated devices (default: 50)
  --no-build                  Skip docker compose build
  --reset-db                  Remove the Docker Postgres volume before starting
  -h, --help                  Show this help

Environment variables PORT, SIM_INTERVAL, and SIM_DEVICES are also supported.
MSG
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="${2:?--port requires a value}"
      shift 2
      ;;
    --sim-interval)
      SIM_INTERVAL="${2:?--sim-interval requires a value}"
      shift 2
      ;;
    --sim-devices)
      SIM_DEVICES="${2:?--sim-devices requires a value}"
      shift 2
      ;;
    --no-build)
      BUILD=0
      shift
      ;;
    --reset-db)
      RESET_DB=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

export PORT SIM_INTERVAL SIM_DEVICES

cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  cat >&2 <<'MSG'
Docker is not installed or not on PATH.
Install Docker Engine/Desktop, then re-run this script.
On Debian/Ubuntu this usually requires sudo, for example:
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
MSG
  exit 127
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required (the 'docker compose' plugin was not found)." >&2
  exit 127
fi

mkdir -p logs
if [[ ! -f device-simulation/device-ids.json ]]; then
  printf '[]\n' > device-simulation/device-ids.json
fi

if [[ "$RESET_DB" -eq 1 ]]; then
  echo "Resetting Docker Postgres volume..."
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
fi

if [[ "$BUILD" -eq 1 ]]; then
  echo "Building local Docker image(s)..."
  docker compose -f "$COMPOSE_FILE" build
else
  echo "Skipping Docker build (--no-build)."
fi

echo "Starting postgres, app, and simulator..."
START_EPOCH="$(date +%s)"
docker compose -f "$COMPOSE_FILE" up -d

echo "Waiting for API healthcheck on http://127.0.0.1:${PORT}/health ..."
for _ in {1..90}; do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null

echo "Waiting for simulator/app logs to receive telemetry..."
for _ in {1..60}; do
  ingestion_mtime="0"
  [[ -f logs/ingestion.log ]] && ingestion_mtime="$(stat -c %Y logs/ingestion.log)"
  if [[ "$ingestion_mtime" -ge "$START_EPOCH" ]] \
    && tail -200 logs/ingestion.log 2>/dev/null | grep -q '"url":"/api/metrics"' \
    && tail -200 logs/ingestion.log 2>/dev/null | grep -q '"statusCode":202' \
    && docker compose -f "$COMPOSE_FILE" logs --no-color simulator 2>/dev/null | grep -Eq "\[stats\] sent=[1-9][0-9]* failed=0"; then
    break
  fi
  sleep 1
done

if ! tail -200 logs/ingestion.log 2>/dev/null | grep -q '"url":"/api/metrics"'; then
  echo "Timed out waiting for app telemetry logs." >&2
  exit 1
fi

echo "Recent app logs:"
docker compose -f "$COMPOSE_FILE" logs --no-color --tail=40 app simulator

echo "Docker local stack is running."
echo "Dashboard/API: http://127.0.0.1:${PORT}"
echo "Simulator: devices=${SIM_DEVICES}, interval=${SIM_INTERVAL}"
echo "Stop with: docker compose -f docker-compose.local.yml down"

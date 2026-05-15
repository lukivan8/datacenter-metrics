#!/usr/bin/env bash
set -euo pipefail

# Starts the API and dashboard immediately, then starts the device simulator
# after a short delay so the ingestion endpoint has time to come up.
SIM_DELAY_SECONDS="${SIM_DELAY_SECONDS:-5}"

pids=()

cleanup() {
  echo "\nStopping dev processes..."
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

npm run dev:api &
pids+=("$!")

npm run dev:web &
pids+=("$!")

echo "Waiting ${SIM_DELAY_SECONDS}s before starting device simulator..."
sleep "$SIM_DELAY_SECONDS"

npm run sim -w device-simulation -- "$@" &
pids+=("$!")

# Keep the script alive until any child exits, then clean up the rest.
wait -n "${pids[@]}"

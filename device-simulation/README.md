# Device Telemetry Simulator

A simple Node.js + TypeScript CLI that simulates many independent devices sending telemetry to an ingestion endpoint.

The target payload shape is:

```json
{
  "deviceId": "3f8c9ad1-2c7f-4c9e-9f45-98d16721f6f8",
  "power": 612,
  "temperature": 77,
  "timestamp": "2025-10-09T14:00:00.000Z"
}
```

## Purpose and limitations

This is a behavior simulator for a Live Device Telemetry Dashboard/API. It is useful for checking ingestion, persistence, live UI updates, error handling, and general system behavior with many timer-driven devices.

Each simulated device has its own async loop, a stable UUID for the lifetime of the simulator process, startup skew, and small random interval jitter. Devices do not coordinate with each other.

This is not a formal load-testing tool and should not be presented as a maximum-throughput benchmark. Single-threaded Node.js is appropriate here because the simulator models timer-driven network I/O, not CPU-heavy device behavior. For capacity testing, run multiple simulator instances or use dedicated tools such as k6.

## Setup

```bash
npm install
```

## Scripts

```bash
npm run sim -- [--url <endpoint>] [--devices <count>] [--interval <duration>] [--dry-run]
npm run typecheck
npm run build
npm start -- [--url <endpoint>] [--devices <count>] [--interval <duration>]
```

When running through `npm run`, include the standalone `--` before simulator arguments. Without it, npm tries to parse flags like `--devices` as npm options instead of forwarding them to the simulator.

By default, the simulator runs 50 devices reporting every 15 seconds to `http://localhost:3000/api/metrics`. Intervals can be provided as milliseconds or seconds: `15000`, `15000ms`, or `15s`.

## Examples

Dry run with defaults:

```bash
npm run sim -- --dry-run
```

Send metrics to a local API with defaults:

```bash
npm run sim
```

Run 1000 devices every 15 seconds:

```bash
npm run sim -- --devices 1000 --interval 15s --url http://localhost:3000/api/metrics
```

Stop the simulator with `Ctrl+C`. It will abort timers and print final stats.

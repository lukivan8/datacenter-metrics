# Live Device Telemetry Dashboard

A take-home implementation for a live telemetry dashboard and API. The system ingests device power/temperature readings, persists time-series metrics, exposes query/live endpoints, and renders a React fleet dashboard that consumes the backend API.

For the implementation narrative and decision-making notes, see [`DEVLOG.md`](./DEVLOG.md).

Task brief: https://aravolta.notion.site/interview

## Contents

1. [Project overview](#1-project-overview)
2. [Tech stack](#2-tech-stack)
3. [Setup and local development](#3-setup-and-local-development)
4. [API documentation](#4-api-documentation)
5. [Data model and database schema](#5-data-model-and-database-schema)
6. [Ingestion architecture](#6-ingestion-architecture)
7. [High-level data flow](#7-high-level-data-flow)
8. [Dashboard features](#8-dashboard-features)
9. [Scaling notes](#9-scaling-notes)
10. [Testing and verification](#10-testing-and-verification)
11. [Project structure](#11-project-structure)
12. [Known limitations and future work](#12-known-limitations-and-future-work)

## 1. Project overview

This repository is an npm workspace with three main apps:

- [`ingestion-endpoint`](./ingestion-endpoint): Fastify API for ingestion, reads, persistence, and live telemetry streams.
- [`datacenter-dashboard`](./datacenter-dashboard): React + Vite dashboard for fleet summary, search/filtering, device detail, and charts.
- [`device-simulation`](./device-simulation): TypeScript CLI that simulates devices sending telemetry to `POST /api/metrics`.

The frontend does not hardcode telemetry data. It reads devices, metrics, and live updates from the backend API.

## 2. Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts, Zustand.
- Backend: Fastify, TypeScript, Zod, PostgreSQL, `pg` connection pool.
- Live updates: Server-Sent Events via `GET /api/devices/:id/live`.
- Workspace tooling: npm workspaces, shared package at [`packages/shared`](./packages/shared).
- Local orchestration: npm scripts and optional Docker Compose.

## 3. Setup and local development

### Prerequisites

- Node.js compatible with this workspace.
- npm.
- PostgreSQL, or Docker if using the local Compose flow.

### Install dependencies

```bash
npm install
```

### Backend environment

```bash
cp ingestion-endpoint/.env.example ingestion-endpoint/.env
```

Default important values:

```env
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgres://postgres:postgres@localhost:5432/telemetry
FLUSH_INTERVAL_MS=1000
FLUSH_BATCH_SIZE=500
MAX_BUFFER_SIZE=5000
DB_POOL_MAX=5
```

### Database setup

Create the database, then apply the schema:

```bash
createdb telemetry
npm run db:migrate -w ingestion-endpoint
```

The schema is defined in [`ingestion-endpoint/db/schema.sql`](./ingestion-endpoint/db/schema.sql).

### Run locally

Run all local services:

```bash
npm run dev
```

Or run services separately:

```bash
npm run dev:api   # API on http://localhost:3000
npm run dev:web   # Vite dashboard, usually http://localhost:5173
npm run sim -w device-simulation -- --devices 50 --interval 15s
```

Useful root scripts:

```bash
npm run build          # build shared package, API, simulator, and dashboard
npm run docker:local   # start local Docker flow if configured
npm run status         # check local service status
npm run stop           # stop local services started by scripts
```

## 4. API documentation

Base URL: `http://localhost:3000`.

### `POST /api/metrics`

Ingest one telemetry point. The endpoint validates and enqueues the metric, then returns quickly with `202 Accepted`.

Request:

```json
{
  "deviceId": "rack-a1",
  "power": 612,
  "temperature": 77,
  "timestamp": "2025-10-09T14:00:00Z"
}
```

Example:

```bash
curl -X POST http://localhost:3000/api/metrics \
  -H 'content-type: application/json' \
  -d '{"deviceId":"rack-a1","power":612,"temperature":77,"timestamp":"2025-10-09T14:00:00Z"}'
```

Typical responses:

- `202 Accepted`: metric accepted into the ingestion buffer.
- `400 Bad Request`: invalid payload.
- `503 Service Unavailable`: ingestion buffer is full and applying backpressure.

### `GET /api/devices`

Returns latest known state for devices. Used by the fleet table and summary cards.

Common query parameters:

- `page`, `pageSize`: pagination.
- `search`: match device id/name.
- `status`: filter by `normal`, `warning`, or `critical`.
- `sortBy`, `sortDir`: sort fleet rows.

Examples:

```bash
curl 'http://localhost:3000/api/devices?page=1&pageSize=50&search=device'
curl 'http://localhost:3000/api/devices?status=critical'
```

### `GET /api/devices/:id/metrics`

Returns recent raw metrics for one device. Used to initialize the selected-device chart.

Common query parameters:

- `windowSeconds`: recent lookback window, for example `60`.
- `limit`: maximum number of points, if supplied by the client.

Example:

```bash
curl 'http://localhost:3000/api/devices/rack-a1/metrics?windowSeconds=60'
```

### `GET /api/devices/:id/live`

Opens a Server-Sent Events stream for persisted latest telemetry updates for one device.

Example:

```bash
curl -N 'http://localhost:3000/api/devices/rack-a1/live'
```

The dashboard first loads recent history from [`GET /api/devices/:id/metrics`](#get-apidevicesidmetrics), then listens to this live endpoint for new points.

## 5. Data model and database schema

PostgreSQL stores both device identity and telemetry history.

### `devices`

One row per known device. Devices are auto-created on first metric for simulator convenience.

| Column | Purpose |
| --- | --- |
| `id` | Device id, primary key. |
| `name` | Optional display name. |
| `created_at` | First-seen time. |

### `metrics`

Append-only raw time-series table used for recent chart windows.

| Column | Purpose |
| --- | --- |
| `id` | Surrogate primary key. |
| `device_id` | Foreign key to `devices.id`. |
| `power` | Power reading. |
| `temperature` | Temperature reading. |
| `timestamp` | Device/event timestamp. |
| `received_at` | Server receive time. |

### `device_latest`

Denormalized latest-state table used for fast fleet reads.

| Column | Purpose |
| --- | --- |
| `device_id` | Primary key and foreign key to `devices.id`. |
| `power`, `temperature` | Latest readings. |
| `timestamp`, `received_at` | Latest event and receive times. |
| `status` | Computed `normal`, `warning`, or `critical`. |
| `updated_at` | Latest row update time. |

### Indexes

- `idx_metrics_device_timestamp_desc` supports recent-window queries by device.
- `idx_device_latest_status` supports status filtering.
- `idx_device_latest_timestamp_desc` supports latest-state sorting.
- `idx_devices_name` supports name search/display queries.

`device_latest` prevents fleet reads from scanning the raw `metrics` table; the raw table remains the source for per-device time-series charts.

## 6. Ingestion architecture

The ingestion path is intentionally short and non-blocking on database writes:

```txt
receive request -> validate -> check buffer capacity -> enqueue -> return 202
```

`POST /api/metrics` validates payloads with the shared schema, appends valid points to an in-process buffer, and returns `202 Accepted` without waiting for PostgreSQL. A background flush loop writes buffered metrics in batches.

Default buffer settings are in [`ingestion-endpoint/.env.example`](./ingestion-endpoint/.env.example):

```txt
FLUSH_INTERVAL_MS=1000
FLUSH_BATCH_SIZE=500
MAX_INSERT_BATCH_SIZE=1000
MAX_BUFFER_SIZE=5000
```

Flush behavior:

- flush on interval or when the batch threshold is reached;
- write batches in transactions;
- insert raw rows into `metrics`;
- upsert current state into `device_latest` only if the incoming timestamp is newer;
- publish SSE live updates only after commit.

If a DB flush fails, the batch is requeued at the front and retried with capped backoff. If the buffer reaches `MAX_BUFFER_SIZE`, new ingestion receives `503` backpressure instead of growing memory without bound.

Tradeoff: this keeps ingestion latency low and avoids one DB round trip per metric, but the queue is not durable. A hard process crash can lose accepted-but-not-yet-flushed metrics.

## 7. High-level data flow

```txt
device-simulation
  -> POST /api/metrics
  -> Fastify validation
  -> in-memory MetricBuffer
  -> batched PostgreSQL transaction
  -> metrics + device_latest
  -> REST reads + selected-device SSE
  -> React dashboard
```

Read paths are split by use case:

```txt
fleet dashboard       -> devices + device_latest
selected-device chart -> metrics for one device and recent time window
selected-device live  -> SSE after persisted latest-state commit
```

The assignment does not require fleet-wide historical analytics, so the system stores raw history but keeps fleet views cheap by reading one latest row per device.

## 8. Dashboard features

The dashboard implements the required fleet and live-device views:

- fleet summary cards for total/normal/warning/critical devices;
- searchable/filterable device table;
- status badges based on shared alert thresholds;
- selected-device detail sheet;
- recent 60-second power/temperature chart;
- 10-second rolling-average overlay;
- old chart points dropped client-side from the live window;
- selected-device live updates over SSE plus 15-second fallback refetching.

Basic alerting is threshold-based and shared between backend/frontend:

- `critical`: power `>= 1000` or temperature `>= 95`;
- `warning`: power `>= 800` or temperature `>= 80`;
- otherwise `normal`.

The simulator defaults to a 3-second reporting interval so the 60-second chart and 10-second rolling average are visibly useful during demos. The original 15-second cadence is still supported with `--interval 15s`.

## 9. Scaling notes

At 50,000 devices, write volume depends on reporting frequency:

```txt
15s interval -> ~3,333 metrics/sec
3s interval  -> ~16,667 metrics/sec
1s interval  -> 50,000 metrics/sec
```

The current design handles load by batching writes and serving fleet reads from `device_latest` instead of recomputing latest state from raw telemetry. That is enough for a compact take-home and local testing, including an eye-test run of 5,000 devices every 5 seconds.

When trying 50,000 simulated devices locally, the first bottleneck was the simulator itself, not the API. That is expected: one Node.js process was coordinating tens of thousands of async loops, timers, `fetch` calls, sockets, response handlers, and logs from one machine. This does not prove the backend can handle 50,000 physical devices in production; it shows the local simulator stops being a reliable load source at that scale. Real capacity testing should use multiple simulator instances, multiple machines, or a dedicated load tool such as k6, Locust, or distributed workers.

For production scale, I would evolve it as follows:

1. Replace the in-memory buffer with Kafka, Redpanda, NATS JetStream, Redis Streams, SQS, Kinesis, or Pub/Sub.
2. Split HTTP ingestion from persistence workers.
3. Partition raw telemetry or move `metrics` to TimescaleDB hypertables.
4. Add retention, compression, and downsampling for old metrics.
5. Use optimized bulk insert paths such as `COPY` if needed.
6. Move all fleet pagination/filtering/sorting fully server-side.
7. Add shared pub/sub for SSE/WebSocket fanout across API instances.
8. Add device authentication, per-source rate limits, and observability.

What would break first:

- Single-process simulator limits during local high-scale tests.
- PostgreSQL write throughput: inserts, indexes, WAL, and `device_latest` upserts.
- Buffer capacity during DB slowdown: after `MAX_BUFFER_SIZE`, ingestion returns `503`.
- Raw metric growth: no retention or partitioning yet.
- Process-local state: buffer and SSE subscribers are not shared across instances.
- Frontend large-page loading/search: acceptable for take-home, but should be server-page based at larger scale.

## 10. Testing and verification

Build all workspaces:

```bash
npm run build
```

Run API and dashboard:

```bash
npm run dev:api
npm run dev:web
```

Send one metric:

```bash
curl -X POST http://localhost:3000/api/metrics \
  -H 'content-type: application/json' \
  -d '{"deviceId":"rack-a1","power":612,"temperature":77,"timestamp":"2025-10-09T14:00:00Z"}'
```

Query data:

```bash
curl 'http://localhost:3000/api/devices?page=1&pageSize=50'
curl 'http://localhost:3000/api/devices/rack-a1/metrics?windowSeconds=60'
curl -N 'http://localhost:3000/api/devices/rack-a1/live/stream'
```

Simulate devices:

```bash
npm run sim -w device-simulation -- --devices 50 --interval 3s
npm run sim -w device-simulation -- --devices 1000 --interval 15s
npm run sim -w device-simulation -- --dry-run
```

## 11. Project structure

```txt
datacenter-dashboard/     React dashboard UI
device-simulation/        TypeScript telemetry simulator CLI
ingestion-endpoint/       Fastify API, buffer, DB queries, SSE
packages/shared/          Shared schemas, API types, alert thresholds
scripts/                  Local orchestration helpers
docker-compose.local.yml  Optional local Docker setup
README_CHECKLIST.tmp.md   Temporary README planning checklist
MOUDLE_WRITEUP.md         Detailed implementation/module writeup
```

Key backend files:

- [`ingestion-endpoint/src/server.ts`](./ingestion-endpoint/src/server.ts): API routes and app setup.
- [`ingestion-endpoint/src/registries/buffer.ts`](./ingestion-endpoint/src/registries/buffer.ts): ingestion buffer lifecycle.
- [`ingestion-endpoint/src/queries/metricBuffer.ts`](./ingestion-endpoint/src/queries/metricBuffer.ts): batch persistence.
- [`ingestion-endpoint/src/registries/liveSubscribers.ts`](./ingestion-endpoint/src/registries/liveSubscribers.ts): SSE subscribers.

## 12. Known limitations and future work

- In-memory buffering is not crash-durable.
- SSE subscriptions are process-local.
- Devices are auto-created from incoming metrics instead of provisioned/authenticated.
- Raw telemetry has no retention, partitioning, or downsampling.
- PostgreSQL is used directly instead of a dedicated queue plus worker tier.
- Some dashboard responsiveness choices favor take-home UX over strict server-side pagination.
- `device-simulation` is a behavior simulator, not a formal load-testing tool; at very high local scale the simulator can become the bottleneck before the API.

The main production upgrade would be adding a durable queue between ingestion and persistence. The next major upgrade would be a stronger time-series storage strategy for raw metrics.

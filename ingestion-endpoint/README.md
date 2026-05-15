# Live Device Telemetry Backend

Fastify + TypeScript + PostgreSQL backend for ingesting simulated device telemetry and serving dashboard reads.

## Setup

```bash
npm install
cp .env.example .env
createdb telemetry
npm run db:migrate
npm run dev
```

Useful scripts:

```bash
npm run dev        # run with tsx watch
npm run build      # compile TypeScript
npm start          # run compiled dist/server.js
npm run typecheck  # type-check only
npm run db:migrate # apply db/schema.sql using DATABASE_URL
```

## Logging

The server uses Fastify/Pino logging. The default log level is `info`.

By default, each server run writes to a new file under `./logs`:

```text
./logs/ingestion-<timestamp>-<pid>.log
```

To change the level or force a specific log file, set these environment variables:

```bash
LOG_LEVEL=debug
LOG_FILE=./logs/ingestion.log
npm run dev
```

## API examples

```bash
curl -X POST http://localhost:3000/api/metrics \
  -H 'content-type: application/json' \
  -d '{"deviceId":"device-0001","power":612,"temperature":77,"timestamp":"2025-10-09T14:00:00Z"}'

curl 'http://localhost:3000/api/devices?page=1&pageSize=50&search=device&sortBy=temperature&sortDir=desc'
curl 'http://localhost:3000/api/devices?status=critical'
curl -N http://localhost:3000/api/devices/device-0001/live # SSE stream
curl 'http://localhost:3000/api/devices/device-0001/metrics?windowSeconds=60'
```

## Data flow

1. `POST /api/metrics` receives telemetry from the simulator.
2. The request body is validated with Zod.
3. The metric is appended to an in-memory buffer.
4. The endpoint returns `202 Accepted` immediately.
5. A background loop flushes buffered metrics to PostgreSQL in batches.
6. Each flush inserts raw rows into `metrics` and upserts `device_latest`.
7. After the transaction commits, the server publishes accepted latest telemetry updates to connected SSE subscribers for those devices.

`POST /api/metrics` intentionally returns before the DB write. This keeps ingestion latency low and avoids one database round trip per simulator request. The Fastify process acts as both API and logical worker; this avoids prematurely splitting the take-home into multiple services.

## Buffering and batching

The local buffer flushes every `FLUSH_INTERVAL_MS` for predictable DB pressure and also when it reaches `FLUSH_BATCH_SIZE`. `MAX_INSERT_BATCH_SIZE` caps generated SQL size even if configuration is accidentally set too high. `MAX_BUFFER_SIZE` protects the process from unbounded memory growth; when full, ingestion returns `503`. The PostgreSQL pool is intentionally small via `DB_POOL_MAX` so this API cannot overwhelm Postgres with too many concurrent connections.

On graceful shutdown, the server stops the timer and flushes remaining metrics before exit. If a DB flush fails, the batch is logged, re-queued at the front of the buffer, and retried with capped backoff of roughly 1s, 2s, 5s, then 10s. During a DB outage the process keeps accepted metrics only up to `MAX_BUFFER_SIZE`; after that, new ingestion requests receive `503` backpressure instead of allowing unbounded memory growth. Ingestion and DB writes are separate code paths: the request handler only validates and enqueues, and it never awaits the database insert. SSE publication also happens only after a successful commit, so the live UI does not see unpersisted points. Logging is aggregate-oriented at batch/error level rather than per metric to avoid turning logs into the bottleneck. This is simple and useful for a take-home, but it is not durable: the current in-memory batch can be lost on a hard crash or process kill.

## Live telemetry with Server-Sent Events

`GET /api/devices/:id/live` is a Server-Sent Events stream. The frontend should first load the initial chart window with `GET /api/devices/:id/metrics?windowSeconds=60`, then open an `EventSource` to receive new persisted telemetry for that selected device.

The prompt asks for a simulated WebSocket feed, but polling is explicitly allowed, so the real requirement is reactive live telemetry. SSE is a better fit here because the stream is server-to-client only. WebSocket would be useful if the client needed to send commands, acknowledgements, subscriptions, or control messages over the same connection. Polling would be acceptable for a real 15-second telemetry dashboard, but SSE is useful in this take-home because it better demonstrates the actual ingestion flow: the live UI receives telemetry after it flows through ingestion, buffering, flushing, persistence, and publication. This avoids hardcoded frontend updates and avoids inventing liveness with a timer.

The current implementation keeps an in-process subscriber map keyed by `deviceId`. When a client connects, it is registered under that device id, receives an initial `connected` event, and then receives heartbeat comments about every 20 seconds. After a flush transaction commits, the server publishes rows returned by the `device_latest` upsert. If multiple metrics for the same device are in one flush, the backend emits only the latest point for that device in that flush. This keeps the stream aligned with latest-state semantics and avoids extra events during bursts; the tradeoff is that the live chart may skip intermediate persisted raw points. Older out-of-order points may still be inserted into raw `metrics`, but they are not emitted as live latest-state events if they did not update `device_latest`.

Frontend usage example:

```ts
const initial = await fetch('/api/devices/device-0001/metrics?windowSeconds=60')
  .then((res) => res.json());

let points = initial.items;
const stream = new EventSource('/api/devices/device-0001/live');

stream.onmessage = (event) => {
  const point = JSON.parse(event.data);
  points = [...points, point].filter((p) => {
    return new Date(p.timestamp).getTime() >= Date.now() - 60_000;
  });
  // Recompute 10-second rolling averages here, then update chart state.
};

stream.addEventListener('connected', () => {
  console.log('live telemetry stream connected');
});

// When closing the detail panel:
stream.close();
```

Scale caveat: SSE subscriptions are process-local. This works for a single Fastify instance. If the system is horizontally scaled, an SSE client connected to one instance will not automatically receive updates ingested by another instance. In production, this would require shared pub/sub such as Redis Pub/Sub, Redis Streams, NATS, Kafka, or another event bus. Alternatively, route a device's ingestion and live stream consistently to the same instance, but shared pub/sub is the cleaner general solution.

## Data model

- `devices`: one row per known device. For this take-home, devices are auto-created on first metric because the simulator can generate arbitrary IDs. In production this would be replaced by explicit device provisioning and device authentication.
- `metrics`: append-only raw telemetry. Used for the selected device's recent chart window.
- `device_latest`: denormalized current state, one row per device. It is updated only when the incoming metric timestamp is newer than the stored timestamp. Status is computed from configurable warning/critical power and temperature thresholds.

`device_latest` exists so dashboard reads do not scan raw time-series data. The fleet table and summary cards read current state from `device_latest`; the selected-device chart reads only a recent window from `metrics`.

## Scaling notes

At 15-second reporting frequency, 50,000 devices produce about 3,333 metrics/sec. At 1-second frequency, they produce 50,000 metrics/sec.

With `device_latest`, the most expensive required read is `GET /api/devices` because it powers the fleet table, search/filtering, sorting, pagination, and summary cards. It is still much cheaper than querying raw metrics because it reads one latest row per device.

After introducing `device_latest`, the main scalability pressure moves to write volume: batch insert size, upsert rate, index maintenance, DB connection limits, and raw `metrics` storage growth. At 50,000+ devices, the first things likely to break are PostgreSQL write throughput, table/index bloat on raw metrics, expensive sorted/filtered fleet queries without more targeted indexes, and process memory if the DB cannot keep up with flushes.

Horizontal scaling is straightforward at this level: multiple Fastify instances can each maintain a local buffer and flush append-only metrics to the same DB. The latest-state upsert is timestamp-guarded, so older out-of-order samples do not overwrite newer state.

In production, the local buffer should become a durable queue such as Redis Streams, NATS JetStream, Kafka, Redpanda, or SQS. That would preserve accepted metrics across crashes, support backpressure/replay, and decouple ingestion from database availability.

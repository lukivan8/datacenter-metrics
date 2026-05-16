# Development Log

This document is a cleaned-up version of my working notes while building the take-home. It is not meant to be a minute-by-minute transcript; it captures the main decisions, tradeoffs, and course corrections behind the implementation.

Source notes: [Crude Notes](https://www.notion.so/lukivan8/Crude-Notes-361aa8c76ef880b2b471fc2ffe6c39c5?source=copy_link).

## Starting point

I started by rereading the assignment and reframing it as two related problems:

1. generate realistic-enough telemetry so the system can be exercised end-to-end;
2. build an API and dashboard that can ingest, persist, query, and display that telemetry without hardcoding data in the UI.

My first conclusion was that the simulator would make the rest of the task easier to reason about. A dashboard for live telemetry is hard to validate if there is no realistic stream of device data flowing through the system.

## Simulator-first approach

I built `device-simulation` first as a small TypeScript CLI. The goal was not to create a perfect load-testing tool, but to model many independent devices periodically sending metrics.

The simulator decisions were:

- each device owns a stable UUID;
- device IDs are persisted locally so restarts do not create a completely new fleet;
- each simulated device runs independently on a timer;
- startup skew and interval jitter reduce synchronized request spikes;
- failed sends are recorded, but not retried by the device.

I briefly considered using Elixir because spawning many independent timed processes is very natural there, but I chose TypeScript to keep the repository and tooling simple. Since the rest of the stack was going to be TypeScript, keeping the simulator in the same ecosystem made the project easier to run and review.

I also intentionally avoided putting hierarchy into the device ID itself. The sample payload uses an ID like `rack-a1`, but in a production model I would represent hierarchy as separate fields/entities rather than encode it into an identifier string.

## Avoiding over-engineering in the simulator

One early question was whether simulated devices should retry failed requests. I decided against it.

For this project, devices are frequent telemetry reporters. If one point is lost, the next point should arrive soon. More importantly, retry behavior in thousands of simulated clients could hide backend overload or amplify traffic during failures. I wanted reliability and backpressure to be visible in the ingestion layer instead of hidden in the simulator.

That is why the simulator is best described as a behavior simulator, not a benchmark tool.

## Backend architecture decisions

For the API, I wanted ingestion to be fast and conceptually horizontally scalable. The simplest production-shaped model would be:

```txt
ingestion API -> queue/stream -> persistence workers -> database
```

For the take-home, I kept that logical shape but collapsed it into one Fastify process:

```txt
ingestion API -> in-memory buffer -> background batch flush -> PostgreSQL
```

This gives the important behavior without requiring Redis, Kafka, or another service just to run the project locally.

The key decision was that `POST /api/metrics` should not synchronously write to PostgreSQL. It validates the payload, enqueues it, and returns `202 Accepted`. A background buffer flush writes metrics in batches.

That keeps the hot request path small and avoids one database round trip per metric.

## Persistence and read model

I initially thought about TimescaleDB because this is time-series data. I decided to start with plain PostgreSQL because it lowers setup friction: if someone has Node and Postgres, they can run the project without needing a special database extension or container.

The schema ended up with three main tables:

- `devices`: known device identities;
- `metrics`: append-only raw telemetry history;
- `device_latest`: denormalized latest state per device.

The important realization was that the assignment does not require fleet-wide historical analytics. The dashboard needs a current fleet view and a recent per-device chart. That makes `device_latest` very useful: the fleet table and summary cards can read one row per device instead of scanning raw telemetry to compute the latest state.

Raw metrics are still stored because the selected-device chart needs a recent history window, and keeping historical data is a reasonable default for telemetry unless retention constraints are explicit.

## Buffering, retries, and backpressure

The first version of the buffer simply requeued failed database writes. I then tightened the behavior so overload is explicit.

The final behavior is:

- metrics are accepted into a bounded in-memory buffer;
- the buffer flushes on interval or batch-size threshold;
- failed flushes are requeued and retried with backoff;
- once the buffer reaches capacity, new ingestion receives `503`.

This is an intentional tradeoff. Returning `503` is better than accepting unbounded data that the process cannot safely hold. The obvious production improvement is to replace this memory buffer with a durable queue or stream.

## SSE instead of WebSockets

The prompt mentions simulating a WebSocket feed, with polling allowed. I chose Server-Sent Events for the selected-device live stream.

SSE fits this use case because updates are one-way: server to browser. The client does not need to send commands or acknowledgements over the same connection. It also keeps the frontend simpler while still showing a real reactive data path.

The important part is that SSE events are published only after PostgreSQL commits. The UI is therefore reacting to persisted telemetry, not to uncommitted in-memory data.

In production, the process-local SSE registry would need shared pub/sub so updates ingested by one API instance can reach clients connected to another instance.

## Frontend implementation

For the dashboard I used Vite, React, TypeScript, and Tailwind. I added libraries as needed rather than designing the entire frontend stack up front.

The core UI goals were:

- fleet-level summary cards;
- searchable/filterable device table;
- clear status/alert indicators;
- selected-device detail panel;
- 60-second chart for power and temperature;
- 10-second rolling average overlay;
- live updates for the selected device.

During frontend work, I added a shared package for API types, schemas, and status thresholds. This reduced drift between backend and frontend and made the alerting rules explicit in one place.

I also changed the simulator default interval to 3 seconds. At a strict 15-second interval, a 10-second rolling average over the last 60 seconds is not very visually interesting because there may be only a few points. The simulator still supports `--interval 15s`, but the shorter default makes the demo easier to evaluate.

## UX tradeoffs

I initially considered polling the fleet table continuously. I decided against aggressive fleet polling because it made the UI feel noisier and was not required by the task. The selected-device panel updates live, and the fleet view can be refreshed explicitly.

One minor consequence is that a device row and its detail panel can briefly show different values. That is acceptable for the scope, but in a production dashboard I would either add fleet-level streaming, low-frequency polling, or clearer staleness indicators.

I also generated more realistic device names so the UI was not just a wall of UUIDs. UUIDs are still available and copyable, but names make the fleet view easier to scan.

## Local load testing observations

I did a local sanity test with 5,000 devices reporting every 5 seconds. It was not meant as a formal benchmark, but it helped confirm that the ingestion path, buffering, persistence, and dashboard reads were wired correctly.

I also tried pushing the simulator to 50,000 devices locally. The first thing that broke was the simulator itself, not the API. That is expected: one Node.js process on one machine is not a realistic model of 50,000 physical devices distributed across many machines, clocks, TCP stacks, and network paths.

That result is useful because it defines the simulator's limit. It should not be used as proof that the backend can handle 50,000 production devices. Real capacity testing would require multiple load generators or tools such as k6, Locust, or distributed workers.

## Deployment and polish

After the core flow worked, I hosted the app behind a Cloudflare tunnel so it could be reviewed without requiring setup first. I still kept local setup as a priority: the project should remain runnable with Node and PostgreSQL, with Docker as an optional convenience.

The last pass focused on:

- documentation;
- making tradeoffs explicit;
- explaining scale limitations honestly;
- ensuring the frontend consumes the backend API;
- keeping the architecture understandable rather than adding infrastructure for its own sake.

## Final reflection

The main architectural choice was to keep the project small while preserving production-shaped boundaries:

```txt
simulator -> ingestion API -> buffer -> database -> read APIs -> dashboard
```

The biggest deliberate simplification is the in-memory buffer. It demonstrates batching, backpressure, and eventual persistence, but it is not durable. If I were taking this toward production, the first change would be a durable queue between ingestion and persistence. The second would be a stronger time-series storage strategy with partitioning, retention, and shared pub/sub for live updates.

For the take-home scope, I prioritized an end-to-end working system, clear data flow, defensible tradeoffs, and a README that explains where the design is intentionally simple and how it would evolve.

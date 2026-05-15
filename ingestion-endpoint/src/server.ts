import Fastify from "fastify";
import cors from "@fastify/cors";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { deviceStatusSchema, metricIngestSchema } from "@lukivan8-datacenter/shared";
import { z } from "zod";
import { pool } from "./db.js";
import { MetricBuffer } from "./registries/buffer.js";
import { config } from "./config.js";
import { LiveSubscriberRegistry } from "./registries/liveSubscribers.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
    DeviceListItemRow,
    DeviceListSummaryRow,
    DeviceListTotalRow,
    DeviceMetricWithRollingAveragesRow,
} from "./types/dbTypes.js";
import {
    deviceListSortColumns,
    getDeviceListItemsQuery,
    getDeviceListSummaryQuery,
    getDeviceListTotalQuery,
} from "./queries/devices.js";
import { getDeviceMetricsWithinWindowWithRollingAveragesQuery } from "./queries/deviceMetrics.js";
import { getLatestTelemetryForDeviceQuery } from "./queries/deviceLive.js";


function n(value: unknown) {
    return value === null || value === undefined ? null : Number(value);
}

const mimeTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
};

function registerStaticRoutes(app: FastifyInstance) {
    const staticDir = resolve(config.staticDir);
    const indexPath = join(staticDir, "index.html");

    if (!existsSync(indexPath)) {
        app.log.warn({ staticDir }, "dashboard static files not found; API-only mode");
        return;
    }

    app.get("/*", async (request: FastifyRequest, reply: FastifyReply) => {
        const url = new URL(request.url, "http://localhost");
        const decodedPath = decodeURIComponent(url.pathname);
        const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
        const filePath = normalize(join(staticDir, requestedPath));

        let pathToServe = filePath.startsWith(staticDir) ? filePath : indexPath;
        if (!existsSync(pathToServe) || !statSync(pathToServe).isFile()) {
            const acceptsHtml = request.headers.accept?.includes("text/html") ?? false;
            if (!acceptsHtml) {
                return reply.code(404).send({ error: "Not found" });
            }
            pathToServe = indexPath;
        }

        const contentType = mimeTypes[extname(pathToServe)] ?? "application/octet-stream";
        return reply.header("Content-Type", contentType).send(createReadStream(pathToServe));
    });
}

export async function buildServer() {
    if (config.logFile) {
        mkdirSync(dirname(config.logFile), { recursive: true });
    }

    const app = Fastify({
        logger: {
            level: config.logLevel,
            file: config.logFile,
        },
    });
    // Open CORS is intentional: this API uses no cookies/credentials and it keeps local
    // development simple when the UI is served from a different/remote machine.
    await app.register(cors, { origin: "*" });

    const liveSubscribers = new LiveSubscriberRegistry();
    const metricBuffer = new MetricBuffer(pool, app.log, (rows) =>
        liveSubscribers.publishMany(rows),
    );
    metricBuffer.start();

    app.get("/health", async () => ({
        ok: true,
        bufferedMetrics: metricBuffer.size(),
    }));

    app.post("/api/metrics", async (request, reply) => {
        const parsed = metricIngestSchema.safeParse(request.body);
        if (!parsed.success) {
            request.log.warn(
                {
                    validation: z.flattenError(parsed.error),
                    bufferedMetrics: metricBuffer.size(),
                },
                "metric ingestion request rejected: invalid payload",
            );
            return reply.code(400).send({
                error: "Invalid metric payload",
                details: z.flattenError(parsed.error),
            });
        }
        if (!metricBuffer.enqueue(parsed.data)) {
            request.log.error(
                {
                    deviceId: parsed.data.deviceId,
                    timestamp: parsed.data.timestamp,
                    bufferedMetrics: metricBuffer.size(),
                    maxBufferSize: config.maxBufferSize,
                },
                "metric ingestion request rejected: buffer overloaded",
            );
            return reply
                .code(503)
                .send({ error: "Ingestion buffer overloaded" });
        }
        return reply.code(202).send({ accepted: true });
    });

    app.get("/api/devices", async (request) => {
        const q = request.query as Record<string, string | undefined>;
        const page = Math.max(1, Number(q.page ?? 1));
        const pageSize = Math.min(200, Math.max(1, Number(q.pageSize ?? 50)));
        const sortBy = (
            q.sortBy && q.sortBy in deviceListSortColumns ? q.sortBy : "id"
        ) as keyof typeof deviceListSortColumns;
        const sortDir =
            q.sortDir?.toLowerCase() === "desc"
                ? ("desc" as const)
                : ("asc" as const);

        const status = q.status ? deviceStatusSchema.parse(q.status) : undefined;
        const queryOptions = {
            search: q.search,
            status,
            page,
            pageSize,
            sortBy,
            sortDir,
        };

        const [summaryResult, totalResult, itemsResult] = await Promise.all([
            pool.query<DeviceListSummaryRow>(
                getDeviceListSummaryQuery(queryOptions),
            ),
            pool.query<DeviceListTotalRow>(
                getDeviceListTotalQuery(queryOptions),
            ),
            pool.query<DeviceListItemRow>(
                getDeviceListItemsQuery(queryOptions),
            ),
        ]);

        const s = summaryResult.rows[0];
        return {
            summary: {
                totalDevices: s.total_devices,
                onlineDevices: s.online_devices,
                warningDevices: s.warning_devices,
                criticalDevices: s.critical_devices,
                avgPower: n(s.avg_power),
                avgTemperature: n(s.avg_temperature),
                totalPower: n(s.total_power),
            },
            items: itemsResult.rows.map((r) => ({
                ...r,
                power: n(r.power),
                temperature: n(r.temperature),
            })),
            page,
            pageSize,
            total: totalResult.rows[0].total,
        };
    });

    app.get("/api/devices/:id/live", async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await pool.query(getLatestTelemetryForDeviceQuery(id));
        const row = result.rows[0];
        if (!row) return reply.code(404).send({ error: "Device telemetry not found" });
        return {
            id: row.id,
            power: n(row.power),
            temperature: n(row.temperature),
            timestamp: row.timestamp.toISOString(),
            receivedAt: row.received_at.toISOString(),
            status: row.status,
        };
    });

    app.get("/api/devices/:id/live/stream", async (request, reply) => {
        const { id } = request.params as { id: string };
        const origin = request.headers.origin;

        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": typeof origin === "string" ? origin : "*",
            Vary: "Origin",
            "X-Accel-Buffering": "no",
        });

        const unsubscribe = liveSubscribers.subscribe(id, reply.raw);
        request.raw.on("close", unsubscribe);
        reply.hijack();
    });

    app.get("/api/devices/:id/metrics", async (request) => {
        const { id } = request.params as { id: string };
        const q = request.query as { windowSeconds?: string };
        const windowSeconds = Math.min(
            3600,
            Math.max(1, Number(q.windowSeconds ?? 60)),
        );
        const result = await pool.query<DeviceMetricWithRollingAveragesRow>(
            getDeviceMetricsWithinWindowWithRollingAveragesQuery(
                id,
                windowSeconds,
            ),
        );
        return {
            deviceId: id,
            windowSeconds,
            items: result.rows.map((r) => ({
                ...r,
                power: n(r.power),
                temperature: n(r.temperature),
                rolling_avg_power: n(r.rolling_avg_power),
                rolling_avg_temperature: n(r.rolling_avg_temperature),
            })),
        };
    });

    app.addHook("onError", async (request, _reply, error) => {
        request.log.error(
            {
                err: error,
                method: request.method,
                url: request.url,
                params: request.params,
                query: request.query,
            },
            "request failed",
        );
    });

    app.addHook("onClose", async () => {
        await metricBuffer.stop();
    });

    registerStaticRoutes(app);
    return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const app = await buildServer();
    const shutdown = async () => {
        await app.close();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    await app.listen({ port: config.port, host: config.host });
}

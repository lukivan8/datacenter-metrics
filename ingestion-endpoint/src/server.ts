import Fastify from "fastify";
import cors from "@fastify/cors";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { deviceStatusSchema, metricIngestSchema } from "@lukivan8-datacenter/shared";
import { z } from "zod";
import { pool } from "./db.js";
import { MetricBuffer } from "./registries/buffer.js";
import { config } from "./config.js";
import { LiveSubscriberRegistry } from "./registries/liveSubscribers.js";
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


function n(value: unknown) {
    return value === null || value === undefined ? null : Number(value);
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
    await app.register(cors, { origin: true });

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
        if (!parsed.success)
            return reply.code(400).send({
                error: "Invalid metric payload",
                details: z.flattenError(parsed.error),
            });
        if (!metricBuffer.enqueue(parsed.data))
            return reply
                .code(503)
                .send({ error: "Ingestion buffer overloaded" });
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

        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
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

    app.addHook("onClose", async () => {
        await metricBuffer.stop();
    });
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

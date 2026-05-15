import type { FastifyBaseLogger } from "fastify";
import type { Pool, PoolClient } from "pg";
import { config } from "../config.js";
import {
    beginMetricFlushTransactionQuery,
    commitMetricFlushTransactionQuery,
    insertMetricBatchQuery,
    insertMissingDevicesQuery,
    rollbackMetricFlushTransactionQuery,
    upsertLatestTelemetryForMetricBatchQuery,
} from "../queries/metricBuffer.js";
import type { DeviceLatestRow } from "../types/dbTypes.js";
import type { MetricInput, MetricRecord } from "../types/types.js";

function computeStatus(
    metric: Pick<MetricInput, "power" | "temperature">,
): MetricRecord["status"] {
    if (
        metric.power >= config.thresholds.criticalPower ||
        metric.temperature >= config.thresholds.criticalTemperature
    )
        return "critical";

    if (
        metric.power >= config.thresholds.warningPower ||
        metric.temperature >= config.thresholds.warningTemperature
    )
        return "warning";

    return "normal";
}

export class MetricBuffer {
    private buffer: MetricRecord[] = [];
    private timer?: NodeJS.Timeout;
    private retryTimer?: NodeJS.Timeout;
    private flushing = false;
    private consecutiveFlushFailures = 0;

    constructor(
        private pool: Pool,
        private logger: FastifyBaseLogger,
        private publishLiveUpdates: (rows: DeviceLatestRow[]) => void = () =>
            undefined,
    ) {}

    start() {
        this.timer = setInterval(
            () => void this.flush(),
            config.flushIntervalMs,
        );
    }

    async stop() {
        if (this.timer) clearInterval(this.timer);
        if (this.retryTimer) clearTimeout(this.retryTimer);
        await this.flush();
    }

    canAccept() {
        return this.buffer.length < config.maxBufferSize;
    }

    enqueue(metric: MetricInput) {
        if (!this.canAccept()) return false;
        this.buffer.push({
            ...metric,
            receivedAt: new Date(),
            status: computeStatus(metric),
        });
        if (this.buffer.length >= config.flushBatchSize) this.scheduleFlush();
        return true;
    }

    size() {
        return this.buffer.length;
    }

    private scheduleFlush(delayMs = 0) {
        if (this.retryTimer) return;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = undefined;
            void this.flush();
        }, delayMs);
    }

    private retryDelayMs() {
        const delays = [1_000, 2_000, 5_000, 10_000];
        return delays[Math.min(this.consecutiveFlushFailures - 1, delays.length - 1)];
    }

    async flush() {
        if (this.flushing || this.buffer.length === 0) return;
        this.flushing = true;
        const batchSize = Math.min(
            config.flushBatchSize,
            config.maxInsertBatchSize,
        );
        const batch = this.buffer.splice(0, batchSize);
        const deviceIds = [...new Set(batch.map((m) => m.deviceId))];
        const batchStartedAt = Date.now();
        let shouldContinueFlushing = false;
        let client: PoolClient | undefined;
        let flushStep = "connect";

        try {
            client = await this.pool.connect();
            flushStep = "begin transaction";
            await client.query(beginMetricFlushTransactionQuery());

            flushStep = "insert missing devices";
            await client.query(insertMissingDevicesQuery(deviceIds));
            flushStep = "insert metric batch";
            await client.query(insertMetricBatchQuery(batch));
            flushStep = "upsert latest telemetry";
            const latestResult = await client.query<DeviceLatestRow>(
                upsertLatestTelemetryForMetricBatchQuery(batch),
            );

            flushStep = "commit transaction";
            await client.query(commitMetricFlushTransactionQuery());
            this.consecutiveFlushFailures = 0;
            this.publishLiveUpdates(latestResult.rows);
            this.logger.info(
                {
                    flushed: batch.length,
                    deviceCount: deviceIds.length,
                    liveUpdates: latestResult.rowCount,
                    durationMs: Date.now() - batchStartedAt,
                    remainingBuffered: this.buffer.length,
                },
                "metric batch flushed",
            );
            shouldContinueFlushing = this.buffer.length >= config.flushBatchSize;
        } catch (error) {
            const rollbackStep = flushStep;
            await client?.query(rollbackMetricFlushTransactionQuery()).catch((rollbackError) => {
                this.logger.error(
                    { err: rollbackError, failedFlushStep: rollbackStep },
                    "metric batch rollback failed",
                );
            });
            this.buffer.unshift(...batch);
            this.consecutiveFlushFailures += 1;
            const retryDelayMs = this.retryDelayMs();
            this.logger.error(
                {
                    err: error,
                    failedFlushStep: flushStep,
                    batchSize: batch.length,
                    deviceCount: deviceIds.length,
                    sampleDeviceIds: deviceIds.slice(0, 5),
                    oldestMetricTimestamp: batch[0]?.timestamp,
                    newestMetricTimestamp: batch.at(-1)?.timestamp,
                    durationMs: Date.now() - batchStartedAt,
                    buffered: this.buffer.length,
                    retryDelayMs,
                    consecutiveFlushFailures: this.consecutiveFlushFailures,
                },
                "metric batch flush failed; re-queueing batch with backoff",
            );
        } finally {
            client?.release();
            this.flushing = false;
            if (shouldContinueFlushing) this.scheduleFlush();
            else if (this.consecutiveFlushFailures > 0 && this.buffer.length > 0)
                this.scheduleFlush(this.retryDelayMs());
        }
    }
}

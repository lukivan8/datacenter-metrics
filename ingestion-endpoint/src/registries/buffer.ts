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
        let shouldContinueFlushing = false;
        let client: PoolClient | undefined;

        try {
            client = await this.pool.connect();
            await client.query(beginMetricFlushTransactionQuery());

            const deviceIds = [...new Set(batch.map((m) => m.deviceId))];
            await client.query(insertMissingDevicesQuery(deviceIds));
            await client.query(insertMetricBatchQuery(batch));
            const latestResult = await client.query<DeviceLatestRow>(
                upsertLatestTelemetryForMetricBatchQuery(batch),
            );

            await client.query(commitMetricFlushTransactionQuery());
            this.consecutiveFlushFailures = 0;
            this.publishLiveUpdates(latestResult.rows);
            this.logger.debug(
                {
                    flushed: batch.length,
                    liveUpdates: latestResult.rowCount,
                    remainingBuffered: this.buffer.length,
                },
                "metric batch flushed",
            );
            shouldContinueFlushing = this.buffer.length >= config.flushBatchSize;
        } catch (error) {
            await client
                ?.query(rollbackMetricFlushTransactionQuery())
                .catch(() => undefined);
            this.buffer.unshift(...batch);
            this.consecutiveFlushFailures += 1;
            const retryDelayMs = this.retryDelayMs();
            this.logger.error(
                {
                    error,
                    batchSize: batch.length,
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

import type { QueryResultRow } from 'pg';
import type { DeviceLatestRow, TypedQueryConfig } from '../types/dbTypes.js';
import type { MetricRecord } from '../types/types.js';

type EmptyRow = QueryResultRow;
type MetricInsertValue = string | number | Date;
type LatestTelemetryUpsertValue = MetricInsertValue | MetricRecord['status'];

export function beginMetricFlushTransactionQuery(): TypedQueryConfig<EmptyRow, []> {
  return { text: 'begin' };
}

export function commitMetricFlushTransactionQuery(): TypedQueryConfig<EmptyRow, []> {
  return { text: 'commit' };
}

export function rollbackMetricFlushTransactionQuery(): TypedQueryConfig<EmptyRow, []> {
  return { text: 'rollback' };
}

export function insertMissingDevicesQuery(deviceIds: string[]): TypedQueryConfig<EmptyRow, [string[]]> {
  return {
    text: `
      insert into devices(id)
      select unnest($1::text[])
      on conflict (id) do nothing`,
    values: [deviceIds]
  };
}

export function insertMetricBatchQuery(metrics: MetricRecord[]): TypedQueryConfig<EmptyRow, MetricInsertValue[]> {
  const values: MetricInsertValue[] = [];
  const rows = metrics.map((metric, index) => {
    const base = index * 5;
    values.push(metric.deviceId, metric.power, metric.temperature, metric.timestamp, metric.receivedAt);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::timestamptz, $${base + 5}::timestamptz)`;
  });

  return {
    text: `
      insert into metrics(device_id, power, temperature, timestamp, received_at)
      values ${rows.join(', ')}`,
    values
  };
}

export function upsertLatestTelemetryForMetricBatchQuery(metrics: MetricRecord[]): TypedQueryConfig<DeviceLatestRow, LatestTelemetryUpsertValue[]> {
  const values: LatestTelemetryUpsertValue[] = [];
  const rows = metrics.map((metric, index) => {
    const base = index * 6;
    values.push(metric.deviceId, metric.power, metric.temperature, metric.timestamp, metric.receivedAt, metric.status);
    return `($${base + 1}::text, $${base + 2}::numeric, $${base + 3}::numeric, $${base + 4}::timestamptz, $${base + 5}::timestamptz, $${base + 6}::text)`;
  });

  return {
    text: `
      with incoming(device_id, power, temperature, timestamp, received_at, status) as (
        values ${rows.join(', ')}
      ), latest_per_device as (
        select distinct on (device_id) *
        from incoming
        order by device_id, timestamp desc
      )
      insert into device_latest(device_id, power, temperature, timestamp, received_at, status)
      select device_id, power, temperature, timestamp, received_at, status from latest_per_device
      on conflict (device_id) do update set
        power = excluded.power,
        temperature = excluded.temperature,
        timestamp = excluded.timestamp,
        received_at = excluded.received_at,
        status = excluded.status,
        updated_at = now()
      where excluded.timestamp > device_latest.timestamp
      returning device_id, power, temperature, timestamp, received_at, status, updated_at`, 
    values
  };
}

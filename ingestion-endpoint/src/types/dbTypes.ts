import type { QueryConfig, QueryResultRow } from "pg";

export type DbNumeric = string;
export type DbTimestamp = Date;
export type DeviceStatus = "normal" | "warning" | "critical";

export type DeviceRow = QueryResultRow & {
    id: string;
    name: string | null;
    created_at: DbTimestamp;
};

export type MetricRow = QueryResultRow & {
    id: string;
    device_id: DeviceRow["id"];
    power: DbNumeric;
    temperature: DbNumeric;
    timestamp: DbTimestamp;
    received_at: DbTimestamp;
};

export type DeviceLatestRow = QueryResultRow & {
    device_id: DeviceRow["id"];
    power: DbNumeric;
    temperature: DbNumeric;
    timestamp: DbTimestamp;
    received_at: DbTimestamp;
    status: DeviceStatus;
    updated_at: DbTimestamp;
};

export type DeviceListSummaryRow = QueryResultRow & {
    total_devices: number;
    online_devices: number;
    warning_devices: number;
    critical_devices: number;
    avg_power: DbNumeric | null;
    avg_temperature: DbNumeric | null;
    total_power: DbNumeric;
};

export type DeviceListTotalRow = QueryResultRow & {
    total: number;
};

export type DeviceListItemRow = QueryResultRow & {
    id: DeviceRow["id"];
    name: DeviceRow["name"];
    power: DeviceLatestRow["power"] | null;
    temperature: DeviceLatestRow["temperature"] | null;
    timestamp: DeviceLatestRow["timestamp"] | null;
    status: DeviceLatestRow["status"] | null;
};

export type LatestTelemetryForDeviceRow = QueryResultRow & {
    id: DeviceLatestRow["device_id"];
    power: DeviceLatestRow["power"];
    temperature: DeviceLatestRow["temperature"];
    timestamp: DeviceLatestRow["timestamp"];
    received_at: DeviceLatestRow["received_at"];
    status: DeviceLatestRow["status"];
};

export type DeviceMetricWithRollingAveragesRow = MetricRow & {
    rolling_avg_power: DbNumeric | null;
    rolling_avg_temperature: DbNumeric | null;
};

export type TypedQueryConfig<
    Row extends QueryResultRow,
    Values extends unknown[] = unknown[],
> = QueryConfig<Values> & {
    readonly __rowType?: Row;
};

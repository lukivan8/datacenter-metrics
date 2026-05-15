import type {
    DeviceMetricWithRollingAveragesRow,
    TypedQueryConfig,
} from "../types/dbTypes.js";

export function getDeviceMetricsWithinWindowWithRollingAveragesQuery(
    deviceId: string,
    windowSeconds: number,
): TypedQueryConfig<DeviceMetricWithRollingAveragesRow, [string, number]> {
    return {
        text: `
      select id, device_id, power, temperature, timestamp, received_at,
        avg(power) over (order by timestamp range between interval '10 seconds' preceding and current row) as rolling_avg_power,
        avg(temperature) over (order by timestamp range between interval '10 seconds' preceding and current row) as rolling_avg_temperature
      from metrics
      where device_id = $1 and timestamp >= now() - ($2::int * interval '1 second')
      order by timestamp asc`,
        values: [deviceId, windowSeconds],
    };
}

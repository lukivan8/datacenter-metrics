import type { LatestTelemetryForDeviceRow, TypedQueryConfig } from '../types/dbTypes.js';

export function getLatestTelemetryForDeviceQuery(deviceId: string): TypedQueryConfig<LatestTelemetryForDeviceRow, [string]> {
  return {
    text: `
      select device_id as id, power, temperature, timestamp, received_at, status
      from device_latest
      where device_id = $1`,
    values: [deviceId]
  };
}

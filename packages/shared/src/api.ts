import { z } from "zod";
import { deviceListItemSchema } from "./telemetry.js";

export const devicesResponseSchema = z.object({
  summary: z.object({
    totalDevices: z.number(),
    onlineDevices: z.number(),
    warningDevices: z.number(),
    criticalDevices: z.number(),
    avgPower: z.number().nullable(),
    avgTemperature: z.number().nullable(),
    totalPower: z.number(),
  }),
  items: z.array(deviceListItemSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
export type DevicesResponse = z.infer<typeof devicesResponseSchema>;

export const liveDeviceResponseSchema = deviceListItemSchema;
export type LiveDeviceResponse = z.infer<typeof liveDeviceResponseSchema>;

export const metricPointSchema = z.object({
  id: z.string(),
  device_id: z.string(),
  power: z.number().nullable(),
  temperature: z.number().nullable(),
  timestamp: z.string(),
  received_at: z.string(),
  rolling_avg_power: z.number().nullable(),
  rolling_avg_temperature: z.number().nullable(),
});
export type MetricPoint = z.infer<typeof metricPointSchema>;

export const deviceMetricsResponseSchema = z.object({
  deviceId: z.string(),
  windowSeconds: z.number(),
  items: z.array(metricPointSchema),
});
export type DeviceMetricsResponse = z.infer<typeof deviceMetricsResponseSchema>;

import { z } from "zod";

export const deviceStatusSchema = z.enum(["normal", "warning", "critical"]);
export type DeviceStatus = z.infer<typeof deviceStatusSchema>;

export const metricIngestSchema = z.object({
  deviceId: z.string().min(1).max(128),
  power: z.number().nonnegative(),
  temperature: z.number(),
  timestamp: z.iso.datetime(),
});
export type MetricIngestPayload = z.infer<typeof metricIngestSchema>;

export const deviceListItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  power: z.number().nullable(),
  temperature: z.number().nullable(),
  timestamp: z.string().nullable(),
  status: deviceStatusSchema.nullable(),
});
export type DeviceListItem = z.infer<typeof deviceListItemSchema>;

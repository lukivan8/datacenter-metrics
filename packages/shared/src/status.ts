export const DEVICE_STATUS_THRESHOLDS = {
  warningPower: 800,
  criticalPower: 1000,
  warningTemperature: 80,
  criticalTemperature: 95,
} as const;

export type TelemetryStatus = "normal" | "warning" | "critical";

export function calculateTelemetryStatus(metric: {
  power: number;
  temperature: number;
}): TelemetryStatus {
  if (
    metric.power >= DEVICE_STATUS_THRESHOLDS.criticalPower ||
    metric.temperature >= DEVICE_STATUS_THRESHOLDS.criticalTemperature
  ) {
    return "critical";
  }

  if (
    metric.power >= DEVICE_STATUS_THRESHOLDS.warningPower ||
    metric.temperature >= DEVICE_STATUS_THRESHOLDS.warningTemperature
  ) {
    return "warning";
  }

  return "normal";
}

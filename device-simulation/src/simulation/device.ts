import { randomUUID } from "node:crypto";

import type { Config, MetricPayload } from "../shared/types.js";
import { randomInt, randomIntervalWithJitter, sleep } from "./timing.js";

export type MetricDispatcher = (payload: MetricPayload) => void;

export function createStableDeviceId(): string {
  return randomUUID();
}

export function generateMetric(deviceId: string): MetricPayload {
  return {
    deviceId,
    power: randomInt(450, 850),
    temperature: randomInt(65, 92),
    timestamp: new Date().toISOString(),
  };
}

export async function runDevice(
  deviceId: string,
  config: Config,
  dispatchMetric: MetricDispatcher,
  signal: AbortSignal,
): Promise<void> {
  const startupSkewMs = randomInt(0, config.intervalMs);
  await sleep(startupSkewMs, signal);

  while (!signal.aborted) {
    dispatchMetric(generateMetric(deviceId));
    await sleep(randomIntervalWithJitter(config.intervalMs), signal);
  }
}

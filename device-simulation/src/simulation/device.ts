import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { Config, MetricPayload } from "../shared/types.js";
import { randomInt, randomIntervalWithJitter, sleep } from "./timing.js";

export type MetricDispatcher = (payload: MetricPayload) => void;

const DEVICE_IDS_FILE = fileURLToPath(new URL("../../device-ids.json", import.meta.url));

export async function getStableDeviceIds(deviceCount: number): Promise<string[]> {
  const storedDeviceIds = await readStoredDeviceIds();
  const deviceIds = [...storedDeviceIds];

  while (deviceIds.length < deviceCount) {
    deviceIds.push(randomUUID());
  }

  if (deviceIds.length !== storedDeviceIds.length) {
    await writeFile(DEVICE_IDS_FILE, `${JSON.stringify(deviceIds, null, 2)}\n`, "utf8");
  }

  return deviceIds.slice(0, deviceCount);
}

async function readStoredDeviceIds(): Promise<string[]> {
  try {
    const rawDeviceIds = await readFile(DEVICE_IDS_FILE, "utf8");
    const parsedDeviceIds: unknown = JSON.parse(rawDeviceIds);

    if (!Array.isArray(parsedDeviceIds) || !parsedDeviceIds.every((id) => typeof id === "string")) {
      throw new Error(`${DEVICE_IDS_FILE} must contain a JSON array of UUID strings.`);
    }

    return parsedDeviceIds;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
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

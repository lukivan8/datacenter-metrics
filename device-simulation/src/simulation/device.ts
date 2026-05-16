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
    power: generateRareCriticalValue([
      { chance: 0.8, min: 450, max: 790 },
      { chance: 0.18, min: 800, max: 980 },
      { chance: 0.02, min: 1_000, max: 1_150 },
    ]),
    temperature: generateRareCriticalValue([
      { chance: 0.8, min: 65, max: 79 },
      { chance: 0.18, min: 80, max: 94 },
      { chance: 0.02, min: 95, max: 105 },
    ]),
    timestamp: new Date().toISOString(),
  };
}

type ValueBand = { chance: number; min: number; max: number };

function generateRareCriticalValue(bands: ValueBand[]): number {
  const roll = Math.random();
  let cumulativeChance = 0;

  for (const band of bands) {
    cumulativeChance += band.chance;
    if (roll <= cumulativeChance) return randomInt(band.min, band.max);
  }

  const fallback = bands.at(-1) ?? { min: 0, max: 0 };
  return randomInt(fallback.min, fallback.max);
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

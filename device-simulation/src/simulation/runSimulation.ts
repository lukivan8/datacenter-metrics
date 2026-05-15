import type { Config, MetricPayload, SendResult, Stats } from "../shared/types.js";
import { createStableDeviceId, runDevice } from "./device.js";
import {
  announceShutdown,
  announceSimulationStart,
  logDryRunPayload,
  logFinalStats,
  logSendFailure,
  startStatsLogging,
} from "./logging.js";
import { sendMetric } from "./sender.js";

export async function runSimulation(config: Config): Promise<void> {
  const controller = new AbortController();
  const stats = createStats();
  const pendingSends = new Set<Promise<void>>();
  let statsTimer: NodeJS.Timeout | undefined;
  let finalStatsPrinted = false;

  const printFinalStats = () => {
    if (!finalStatsPrinted) {
      finalStatsPrinted = true;
      logFinalStats(stats);
    }
  };

  const dispatchMetric = (payload: MetricPayload) => {
    if (config.dryRun) {
      logDryRunPayload(payload);
      stats.sent++;
      return;
    }

    const send = sendMetric(payload, config, controller.signal)
      .then((result) => recordSendResult(stats, result))
      .finally(() => pendingSends.delete(send));

    pendingSends.add(send);
  };

  const stopSimulation = () => {
    if (controller.signal.aborted) {
      return;
    }

    announceShutdown();
    controller.abort();

    if (statsTimer) {
      clearInterval(statsTimer);
    }
  };

  process.once("SIGINT", stopSimulation);
  process.once("SIGTERM", stopSimulation);

  announceSimulationStart(config);

  statsTimer = startStatsLogging(stats, controller.signal);

  const devices = Array.from({ length: config.deviceCount }, () =>
    runDevice(createStableDeviceId(), config, dispatchMetric, controller.signal),
  );

  await Promise.all(devices);
  await Promise.allSettled(pendingSends);

  if (statsTimer) {
    clearInterval(statsTimer);
  }

  printFinalStats();
}

function createStats(): Stats {
  return { sent: 0, failed: 0 };
}

function recordSendResult(stats: Stats, result: SendResult): void {
  switch (result.status) {
    case "sent":
      stats.sent++;
      return;
    case "failed":
      stats.failed++;
      logSendFailure(result.message);
      return;
    case "aborted":
      return;
  }
}

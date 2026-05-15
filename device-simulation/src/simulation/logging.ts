import type { Config, MetricPayload, Stats } from "../shared/types.js";

export function announceSimulationStart(config: Config): void {
  console.log(
    `Starting ${config.deviceCount} device(s), interval=${config.intervalMs}ms, mode=${
      config.dryRun ? "dry-run" : "post"
    }, url=${config.endpointUrl}`,
  );
}

export function announceShutdown(): void {
  console.log("\nShutting down gracefully...");
}

export function logDryRunPayload(payload: MetricPayload): void {
  console.log(JSON.stringify(payload));
}

export function logFinalStats(stats: Stats): void {
  console.log(formatStats("final", stats));
}

export function logSendFailure(message: string): void {
  console.warn(message);
}

export function startStatsLogging(stats: Stats, signal: AbortSignal): NodeJS.Timeout {
  return setInterval(() => {
    if (!signal.aborted) {
      console.log(formatStats("stats", stats));
    }
  }, 10_000);
}

function formatStats(prefix: "stats" | "final", stats: Stats): string {
  return `[${prefix}] sent=${stats.sent} failed=${stats.failed}`;
}

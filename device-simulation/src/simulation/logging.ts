import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, extname, join, basename } from "node:path";
import type { Config, MetricPayload, Stats } from "../shared/types.js";

let logFilePath: string | undefined;

export function initializeFileLogging(path: string): string {
  logFilePath = createRunLogFilePath(path);
  const directory = dirname(logFilePath);
  if (directory !== ".") {
    mkdirSync(directory, { recursive: true });
  }

  writeLogLine(`--- simulation started ${new Date().toISOString()} ---`);
  return logFilePath;
}

export function announceSimulationStart(config: Config): void {
  logInfo(
    `Starting ${config.deviceCount} device(s), interval=${config.intervalMs}ms, mode=${
      config.dryRun ? "dry-run" : "post"
    }, url=${config.endpointUrl}, logFile=${config.logFile}`,
  );
}

export function announceShutdown(): void {
  logInfo("\nShutting down gracefully...");
}

export function logDryRunPayload(payload: MetricPayload): void {
  logInfo(JSON.stringify(payload));
}

export function logFinalStats(stats: Stats): void {
  logInfo(formatStats("final", stats));
}

export function logSendFailure(message: string): void {
  logWarn(message);
}

export function startStatsLogging(stats: Stats, signal: AbortSignal): NodeJS.Timeout {
  return setInterval(() => {
    if (!signal.aborted) {
      logInfo(formatStats("stats", stats));
    }
  }, 10_000);
}

function logInfo(message: string): void {
  console.log(message);
  writeLogLine(message);
}

function logWarn(message: string): void {
  console.warn(message);
  writeLogLine(`WARN ${message}`);
}

function createRunLogFilePath(path: string): string {
  const directory = dirname(path);
  const extension = extname(path);
  const name = extension ? basename(path, extension) : basename(path);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return join(directory, `${name}-${timestamp}${extension}`);
}

function writeLogLine(message: string): void {
  if (!logFilePath) {
    return;
  }

  appendFileSync(logFilePath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
}

function formatStats(prefix: "stats" | "final", stats: Stats): string {
  return `[${prefix}] sent=${stats.sent} failed=${stats.failed}`;
}

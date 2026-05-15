import type { Config } from "../shared/types.js";
import { DEFAULT_DEVICE_COUNT, DEFAULT_ENDPOINT_URL, DEFAULT_INTERVAL_MS, DEFAULT_LOG_FILE } from "./defaults.js";
import { parseInterval, parsePositiveInteger, parseUrl } from "./parsers.js";

export function usage(): string {
  return `Device telemetry simulator

Usage:
  npm run sim -- [--url <endpoint>] [--devices <count>] [--interval <duration>] [--log-file <path>] [--dry-run]

Options:
  --devices, -d    Number of simulated devices (default: 50), e.g. 10
  --interval, -i   Reporting interval in ms or seconds (default: 3s), e.g. 3000, 3000ms, 3s
  --url, -u        Ingestion endpoint URL (default: http://localhost:3000/api/metrics)
  --log-file, -l   Write simulator logs to this file pattern (default: logs/device-simulation.log)
  --dry-run        Print payloads instead of sending HTTP requests
  --help, -h       Show this help
`;
}

export function parseArgs(argv: string[]): Config {
  const args = new Map<string, string | boolean>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    if (arg === "--dry-run") {
      args.set("dry-run", true);
      continue;
    }

    const key = normalizeKey(arg);
    if (!key) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const value = argv[i + 1];
    if (!value || value.startsWith("-")) {
      throw new Error(`Missing value for ${arg}`);
    }

    args.set(key, value);
    i++;
  }

  const deviceCount = parsePositiveInteger(args.get("devices"), "devices", DEFAULT_DEVICE_COUNT);
  const intervalMs = parseInterval(args.get("interval"), DEFAULT_INTERVAL_MS);
  const endpointUrl = parseUrl(args.get("url"), DEFAULT_ENDPOINT_URL);
  const dryRun = args.get("dry-run") === true;
  const logFile = parseLogFile(args.get("log-file"), DEFAULT_LOG_FILE);

  return { deviceCount, intervalMs, endpointUrl, dryRun, logFile };
}

function normalizeKey(arg: string): string | undefined {
  switch (arg) {
    case "--devices":
    case "-d":
      return "devices";
    case "--interval":
    case "-i":
      return "interval";
    case "--url":
    case "-u":
      return "url";
    case "--log-file":
    case "-l":
      return "log-file";
    default:
      return undefined;
  }
}

function parseLogFile(value: string | boolean | undefined, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("log-file must not be empty");
  }

  return trimmed;
}

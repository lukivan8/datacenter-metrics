export type MetricPayload = {
  deviceId: string;
  power: number;
  temperature: number;
  timestamp: string;
};

export type Config = {
  deviceCount: number;
  intervalMs: number;
  endpointUrl: string;
  dryRun: boolean;
  logFile: string;
};

export type Stats = {
  sent: number;
  failed: number;
};

export type SendResult =
  | { status: "sent" }
  | { status: "failed"; message: string }
  | { status: "aborted" };

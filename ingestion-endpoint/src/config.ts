import 'dotenv/config';

const num = (name: string, fallback: number) => {
  const value = process.env[name];
  const parsed = value ? Number(value) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const maxInsertBatchSize = clamp(num('MAX_INSERT_BATCH_SIZE', 1000), 1, 5000);

export const config = {
  port: num('PORT', 3000),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/telemetry',
  flushIntervalMs: clamp(num('FLUSH_INTERVAL_MS', 1000), 100, 60_000),
  flushBatchSize: clamp(num('FLUSH_BATCH_SIZE', 500), 1, maxInsertBatchSize),
  maxInsertBatchSize,
  maxBufferSize: clamp(num('MAX_BUFFER_SIZE', 5000), 1, 100_000),
  dbPoolMax: clamp(num('DB_POOL_MAX', 5), 1, 20),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  logFile: process.env.LOG_FILE,
  thresholds: {
    warningPower: num('WARNING_POWER', 800),
    criticalPower: num('CRITICAL_POWER', 1000),
    warningTemperature: num('WARNING_TEMPERATURE', 80),
    criticalTemperature: num('CRITICAL_TEMPERATURE', 95)
  }
};

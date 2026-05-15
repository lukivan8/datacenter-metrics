export function parsePositiveInteger(value: string | boolean | undefined, name: string, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string") {
    throw new Error(`--${name} must be a positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }

  return parsed;
}

export function parseInterval(value: string | boolean | undefined, defaultValueMs: number): number {
  if (value === undefined) {
    return defaultValueMs;
  }

  if (typeof value !== "string") {
    throw new Error("--interval must look like 15000, 15000ms, or 15s");
  }

  const match = value.trim().match(/^(\d+)(ms|s)?$/i);
  if (!match) {
    throw new Error("--interval must look like 15000, 15000ms, or 15s");
  }

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? "ms";
  const intervalMs = unit === "s" ? amount * 1000 : amount;

  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    throw new Error("--interval must be greater than 0");
  }

  return intervalMs;
}

export function parseUrl(value: string | boolean | undefined, defaultValue: string): string {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string") {
    throw new Error("--url must be a valid http(s) URL");
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("URL must use http or https");
    }
    return url.toString();
  } catch {
    throw new Error("--url must be a valid http(s) URL");
  }
}

import type { Config, MetricPayload, SendResult } from "../shared/types.js";

export async function sendMetric(payload: MetricPayload, config: Config, signal: AbortSignal): Promise<SendResult> {
  try {
    const response = await fetch(config.endpointUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const responseBody = await readResponseBody(response);
      return {
        status: "failed",
        message: `[${payload.deviceId}] POST ${config.endpointUrl} failed: ${response.status} ${response.statusText}${responseBody}`,
      };
    }

    return { status: "sent" };
  } catch (error) {
    if (signal.aborted) {
      return { status: "aborted" };
    }

    return {
      status: "failed",
      message: `[${payload.deviceId}] request to ${config.endpointUrl} failed: ${formatErrorDetails(error)}`,
    };
  }
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body ? `; body=${body.slice(0, 500)}` : "";
  } catch (error) {
    return `; unable to read response body: ${formatErrorDetails(error)}`;
  }
}

function formatErrorDetails(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const details = new Set<string>([`${error.name}: ${error.message}`]);
  appendErrorProperties(details, error);

  const cause = error.cause;
  if (cause) {
    details.add(`cause=${formatCause(cause)}`);
  }

  if (error.stack) {
    details.add(`stack=${error.stack.split("\n").slice(0, 4).join(" | ")}`);
  }

  return Array.from(details).join("; ");
}

function formatCause(cause: unknown): string {
  if (!(cause instanceof Error)) {
    return String(cause);
  }

  const details = new Set<string>([`${cause.name}: ${cause.message}`]);
  appendErrorProperties(details, cause);
  return Array.from(details).join(", ");
}

function appendErrorProperties(details: Set<string>, error: Error): void {
  const errorWithProperties = error as Error & Record<string, unknown>;

  for (const property of ["code", "errno", "syscall", "address", "port", "hostname"] as const) {
    const value = errorWithProperties[property];
    if (value !== undefined) {
      details.add(`${property}=${String(value)}`);
    }
  }
}

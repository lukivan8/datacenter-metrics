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
      return {
        status: "failed",
        message: `[${payload.deviceId}] POST failed: ${response.status} ${response.statusText}`,
      };
    }

    return { status: "sent" };
  } catch (error) {
    if (signal.aborted) {
      return { status: "aborted" };
    }

    const message = error instanceof Error ? error.message : String(error);
    return { status: "failed", message: `[${payload.deviceId}] request error: ${message}` };
  }
}

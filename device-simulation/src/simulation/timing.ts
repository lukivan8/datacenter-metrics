const JITTER_PERCENT = 0.1;

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomIntervalWithJitter(baseIntervalMs: number): number {
  const jitterRange = baseIntervalMs * JITTER_PERCENT;
  const jitter = Math.random() * jitterRange * 2 - jitterRange;
  return Math.max(1, Math.round(baseIntervalMs + jitter));
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

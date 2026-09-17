export interface Throttle {
  schedule<T>(fn: () => Promise<T>): Promise<T>;
}

export interface ThrottleOptions {
  minIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export const MIN_REQUEST_INTERVAL_MS = 350;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Single FIFO queue. Request starts are spaced at least `minIntervalMs` apart
 * (350 ms keeps one browser under NCBI's 3 requests per second).
 */
export function createThrottle(options: ThrottleOptions = {}): Throttle {
  const minIntervalMs = options.minIntervalMs ?? MIN_REQUEST_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? defaultSleep;
  let tail: Promise<unknown> = Promise.resolve();
  let lastStart: number | null = null;

  return {
    schedule<T>(fn: () => Promise<T>): Promise<T> {
      const run = tail.then(async () => {
        if (lastStart !== null) {
          const wait = lastStart + minIntervalMs - now();
          if (wait > 0) await sleep(wait);
        }
        lastStart = now();
        return fn();
      });
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createThrottle } from '../../src/pubmed/throttle';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('spaces request starts at least 350 ms apart and keeps order', async () => {
    const throttle = createThrottle({ minIntervalMs: 350, now: () => Date.now() });
    const starts: { name: string; at: number }[] = [];
    const task = (name: string) => async () => {
      starts.push({ name, at: Date.now() });
      return name;
    };

    const results = Promise.all([
      throttle.schedule(task('a')),
      throttle.schedule(task('b')),
      throttle.schedule(task('c')),
    ]);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(results).resolves.toEqual(['a', 'b', 'c']);
    expect(starts.map((s) => s.name)).toEqual(['a', 'b', 'c']);
    for (let i = 1; i < starts.length; i += 1) {
      const gap = (starts[i]?.at ?? 0) - (starts[i - 1]?.at ?? 0);
      expect(gap).toBeGreaterThanOrEqual(350);
    }
  });

  it('does not wait when the previous start was long ago', async () => {
    const throttle = createThrottle({ minIntervalMs: 350, now: () => Date.now() });
    await throttle.schedule(async () => 1);
    await vi.advanceTimersByTimeAsync(1000);
    const fn = vi.fn(async () => 2);
    const pending = throttle.schedule(fn);
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(pending).resolves.toBe(2);
  });

  it('keeps the queue going after a task rejects', async () => {
    const throttle = createThrottle({ minIntervalMs: 350, now: () => Date.now() });
    const failed = throttle.schedule(async () => {
      throw new Error('boom');
    });
    const next = throttle.schedule(async () => 'ok');
    const failedCheck = expect(failed).rejects.toThrow('boom');
    await vi.advanceTimersByTimeAsync(1000);
    await failedCheck;
    await expect(next).resolves.toBe('ok');
  });
});
